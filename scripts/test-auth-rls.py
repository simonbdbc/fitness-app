#!/usr/bin/env python3
"""Replay migrations and verify RLS/RPC in an owned disposable PostgreSQL.

PG_BINDIR or initdb/pg_ctl/psql on PATH; no connection URL or production target.
Auth identities are simulated locally, not real Supabase Auth/PostgREST.
"""
import os
from pathlib import Path
import shutil
import subprocess
import tempfile

ROOT = Path(__file__).resolve().parents[1]


def main():
    tools = {}
    for name in ('initdb', 'pg_ctl', 'psql'):
        tools[name] = str(Path(os.environ['PG_BINDIR']) / name) if os.environ.get('PG_BINDIR') else shutil.which(name)
        if not tools[name]:
            raise SystemExit(f'Missing PostgreSQL tool: {name}')
    env = {k: v for k, v in os.environ.items() if not k.startswith('PG')}

    with tempfile.TemporaryDirectory(prefix='fitness-rls-') as tmp:
        tmp = Path(tmp)
        os.chmod(tmp, 0o700)
        data, sock = tmp / 'data', tmp / 'socket'
        sock.mkdir(mode=0o700)
        started = False
        try:
            subprocess.run([tools['initdb'], '-D', str(data), '--auth=trust', '--no-locale', '-E', 'UTF8'], env=env, check=True, stdout=subprocess.DEVNULL)
            subprocess.run([tools['pg_ctl'], '-D', str(data), '-l', str(tmp / 'server.log'), '-o', f"-c listen_addresses='' -k {sock} -p 55439", '-w', 'start'], env=env, check=True, stdout=subprocess.DEVNULL)
            started = True

            def sql(db, statement, role=None, uid=None, check=True):
                prefix = f"SET ROLE {role}; SET request.jwt.claim.sub = '{uid or ''}';\n" if role else ''
                result = subprocess.run([tools['psql'], '-X', '-qAt', '-v', 'ON_ERROR_STOP=1', '-h', str(sock), '-p', '55439', '-d', db], input=prefix + statement, text=True, capture_output=True, env=env)
                if check and result.returncode:
                    raise AssertionError(result.stderr)
                return result

            sql('postgres', 'CREATE ROLE authenticated NOLOGIN; CREATE ROLE anon NOLOGIN; CREATE ROLE service_role NOLOGIN BYPASSRLS;')
            scaffold = """
CREATE SCHEMA auth;
CREATE TABLE auth.users(id UUID PRIMARY KEY, email text, raw_user_meta_data jsonb DEFAULT '{}'::jsonb);
CREATE FUNCTION auth.uid() RETURNS UUID LANGUAGE sql STABLE AS $$
 SELECT NULLIF(current_setting('request.jwt.claim.sub', true), '')::uuid
$$;
GRANT USAGE ON SCHEMA auth TO authenticated, anon;
GRANT EXECUTE ON FUNCTION auth.uid() TO authenticated, anon;
"""
            sql('postgres', scaffold)
            sql('postgres', 'ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO anon, authenticated, service_role; ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO anon, authenticated, service_role;')
            for path in sorted((ROOT / 'apps/pwa/supabase/migrations').glob('*.sql')):
                sql('postgres', path.read_text())
                print('migration applied:', path.name)
            sql('postgres', "INSERT INTO auth.users(id,email,raw_user_meta_data) VALUES ('00000000-0000-4000-8000-000000000001','first@example.invalid','{\"account_type\":\"admin\"}'), ('00000000-0000-4000-8000-000000000002','second@example.invalid','{}');")

            A, B, ADMIN = ('00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000002', '00000000-0000-4000-8000-000000000003')
            sql('postgres', f"INSERT INTO auth.users(id,email) VALUES ('{ADMIN}','admin@example.invalid'); UPDATE user_profiles SET account_type='admin' WHERE id='{ADMIN}';")
            def value(statement, expected, uid=A, role='authenticated'):
                actual = sql('postgres', statement, role, uid).stdout.strip()
                assert actual == expected, (statement, expected, actual)
            def denied(statement, uid=A, role='authenticated', expected=None):
                result = sql('postgres', statement, role, uid, check=False)
                assert result.returncode != 0, 'Expected refusal: ' + statement
                if expected: assert expected in result.stderr, result.stderr
            for uid in (A,B):
                value('SELECT count(*) FROM user_profiles;', '1', uid)
                value('SELECT account_type FROM user_profiles;', 'basic', uid)
                value(f"SELECT count(*) FROM user_profiles WHERE id='{B if uid==A else A}';", '0', uid)
                value(f"WITH changed AS (UPDATE user_profiles SET display_name='Fictif' WHERE id='{uid}' RETURNING id) SELECT count(*) FROM changed;", '1', uid)
                value(f"WITH changed AS (UPDATE user_profiles SET display_name='Interdit' WHERE id='{B if uid==A else A}' RETURNING id) SELECT count(*) FROM changed;", '0', uid)
                denied(f"UPDATE user_profiles SET account_type='admin' WHERE id='{uid}';", uid, expected='permission denied')
                denied(f"UPDATE user_profiles SET email='fake@example.invalid' WHERE id='{uid}';", uid, expected='permission denied')
                denied("INSERT INTO catalog_equipment(category,code,label,label_en) VALUES ('sport','forbidden','Fictif','Fictional');", uid, expected='row-level security')
            denied('SELECT * FROM user_profiles;', role='anon')
            value('SELECT count(*) FROM user_profiles;', '0', uid=None)
            value('SELECT private.is_admin();', 'f')
            value('SELECT private.is_admin();', 't', ADMIN)
            value('SELECT count(*) FROM user_profiles;', '1', ADMIN)
            value("WITH added AS (INSERT INTO catalog_equipment(category,code,label,label_en) VALUES ('sport','phase1-fiction','Fictif','Fictional') RETURNING id) SELECT count(*) FROM added;", '1', ADMIN)
            denied("SELECT public.finalize_acrea_level_evaluation_v4(999999999);", expected='Active V4 level evaluation attempt not found')
            sql('postgres', f"INSERT INTO acrea_profiles(user_id,name) VALUES ('{A}','Profil fictif'); INSERT INTO acrea_level_evaluation_attempts(id,user_id,protocol_version,attempt_kind) VALUES (9001,'{A}',4,'initial');")
            value('SELECT count(*) FROM acrea_level_evaluation_attempts WHERE id=9001;', '1')
            value('SELECT count(*) FROM acrea_level_evaluation_attempts WHERE id=9001;', '0', B)
            denied('SELECT public.finalize_acrea_level_evaluation_v4(9001);', B, expected='Active V4 level evaluation attempt not found')
            value("SELECT status FROM acrea_level_evaluation_attempts WHERE id=9001;", 'in_progress')
            exercise = sql('postgres', 'SELECT min(id) FROM catalog_exercises;').stdout.strip()
            rpc = f"SELECT public.admin_upsert_catalog_session_template(0,'phase1-test','Titre fictif','',{exercise},'main',ARRAY[1,2]::smallint[],true,'synthetic');"
            denied(rpc, expected='Admin role required')
            denied(rpc, role='anon')
            session = sql('postgres', rpc, 'authenticated', ADMIN).stdout.strip()
            assert session.isdigit(), session
            value(f'SELECT count(*) FROM catalog_session_template_levels WHERE session_template_id={session};', '2', ADMIN)
            denied(f"SELECT public.admin_upsert_catalog_session_template({session},'phase1-test','Changed','',{exercise},'main',ARRAY[]::smallint[],true,'synthetic');", ADMIN, expected='At least one level is required')
            value(f'SELECT title FROM catalog_session_templates WHERE id={session};', 'Titre fictif', ADMIN)
            denied('SELECT public.get_active_catalog_index();', role='anon', expected='permission denied')
            value('SELECT jsonb_typeof(public.get_active_catalog_index());', 'object')
            print('PASS: owner/foreign/anonymous profiles, display_name, immutable role/email, metadata escalation refused, admin-only catalogue/RPC, atomic invalid RPC, authenticated catalogue RPC')
        finally:
            if started:
                subprocess.run([tools['pg_ctl'], '-D', str(data), '-m', 'fast', '-w', 'stop'], env=env, check=True, stdout=subprocess.DEVNULL)


if __name__ == '__main__':
    main()
