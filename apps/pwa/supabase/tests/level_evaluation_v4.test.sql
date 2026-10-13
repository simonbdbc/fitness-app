begin;

create extension if not exists pgtap with schema extensions;
select plan(24);

insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
  confirmation_token, email_change, email_change_token_new, recovery_token
)
select
  '00000000-0000-0000-0000-000000000000'::uuid,
  account.id,
  'authenticated',
  'authenticated',
  account.email,
  '',
  now(),
  '{"provider":"email","providers":["email"]}'::jsonb,
  '{}'::jsonb,
  now(),
  now(),
  '', '', '', ''
from (values
  ('00000000-0000-4000-8000-000000000201'::uuid, 'evaluation-v4-owner@test.local'),
  ('00000000-0000-4000-8000-000000000202'::uuid, 'evaluation-v4-other@test.local')
) account(id, email)
on conflict (id) do nothing;

insert into public.acrea_profiles (
  user_id, name, objective, objective_code, equipment_mode,
  weekly_frequency, average_session_minutes, renforcement_level,
  cardio_level, proprioception_level, session_minutes_min,
  session_minutes_max, weekly_novelty_percent
)
select account.id, 'Évaluation V4', 'Complet', 'complete', 'aucun',
       3, 35, 1, 1, 1, 30, 45, 50
from (values
  ('00000000-0000-4000-8000-000000000201'::uuid),
  ('00000000-0000-4000-8000-000000000202'::uuid)
) account(id)
on conflict (user_id) do nothing;

select has_table(
  'public',
  'acrea_level_evaluation_exercise_mappings',
  'canonical V4 evaluation mappings table exists'
);
select has_function(
  'public',
  'finalize_acrea_level_evaluation_v4',
  array['bigint'],
  'V4 evaluation finalizer exists'
);
select ok(
  (select relrowsecurity from pg_class where oid = 'public.acrea_level_evaluation_attempts'::regclass),
  'evaluation attempts RLS is enabled'
);
select ok(
  (select relrowsecurity from pg_class where oid = 'public.acrea_level_evaluation_sessions'::regclass),
  'evaluation sessions RLS is enabled'
);
select ok(
  (select relrowsecurity from pg_class where oid = 'public.acrea_level_evaluation_results'::regclass),
  'evaluation results RLS is enabled'
);
select ok(
  (select relrowsecurity from pg_class where oid = 'public.acrea_level_evaluation_preferences'::regclass),
  'evaluation preferences RLS is enabled'
);
select ok(
  (select relrowsecurity from pg_class where oid = 'public.acrea_level_evaluation_exercise_mappings'::regclass),
  'canonical V4 mappings RLS is enabled'
);
select is(
  (select count(*) from public.acrea_level_evaluation_exercise_mappings where protocol_version = 4),
  6::bigint,
  'exactly six V4 evaluation mappings are published'
);
select is(
  (
    select count(*)
    from public.acrea_level_evaluation_exercise_mappings
    where protocol_version = 4 and validated_at is not null
  ),
  6::bigint,
  'every V4 evaluation mapping is validated'
);
select is(
  (
    select array_agg(distinct pillar order by pillar)
    from public.acrea_level_evaluation_exercise_mappings
    where protocol_version = 4
  ),
  array['cardio', 'proprioception', 'strength']::text[],
  'V4 mappings use the three canonical pillars'
);
select is(
  (
    select prosecdef
    from pg_proc
    where oid = 'public.finalize_acrea_level_evaluation_v4(bigint)'::regprocedure
  ),
  false,
  'V4 finalizer is security invoker'
);
select is(
  (
    select has_function_privilege('anon', oid, 'execute')
    from pg_proc
    where oid = 'public.finalize_acrea_level_evaluation_v4(bigint)'::regprocedure
  ),
  false,
  'anonymous clients cannot execute the V4 finalizer'
);
select is(
  (
    select has_function_privilege('authenticated', oid, 'execute')
    from pg_proc
    where oid = 'public.finalize_acrea_level_evaluation_v4(bigint)'::regprocedure
  ),
  true,
  'authenticated clients can execute the V4 finalizer'
);

set local role authenticated;
set local "request.jwt.claim.sub" = '00000000-0000-4000-8000-000000000201';

select lives_ok(
  $$
    insert into public.acrea_level_evaluation_attempts (
      user_id, protocol_version, attempt_kind, status
    ) values (
      '00000000-0000-4000-8000-000000000201', 4, 'initial', 'in_progress'
    )
  $$,
  'owner can create a V4 evaluation attempt'
);

select lives_ok(
  $$
    do $evaluation$
    declare
      v_attempt_id bigint;
    begin
      select id into v_attempt_id
      from public.acrea_level_evaluation_attempts
      where user_id = '00000000-0000-4000-8000-000000000201'
      order by id desc
      limit 1;

      insert into public.acrea_level_evaluation_sessions (
        attempt_id, phase, run_number, status, active_step_index, completed_at
      )
      select v_attempt_id, phase.value, 1, 'passed', 12, now()
      from generate_series(1, 3) phase(value);

      insert into public.acrea_level_evaluation_results (
        evaluation_session_id, exercise_code, pillar, exercise_order,
        target_series, target_repetitions, maximum_repetitions,
        technical_valid, appreciation_rating, prescription,
        timer_plan_code, total_seconds, completed_seconds
      )
      select
        evaluation_session.id,
        mapping.evaluation_exercise_code,
        mapping.pillar,
        row_number() over (
          partition by evaluation_session.id
          order by mapping.pillar, mapping.evaluation_exercise_code
        )::smallint,
        case evaluation_session.phase
          when 1 then mapping.phase_1_series
          when 2 then mapping.phase_2_series
          else mapping.phase_3_series
        end::smallint,
        case evaluation_session.phase
          when 1 then mapping.phase_1_repetitions
          when 2 then mapping.phase_2_repetitions
          else null
        end::smallint,
        case when evaluation_session.phase = 3 then mapping.level_2_minimum end,
        true,
        4,
        jsonb_build_object(
          'series', case evaluation_session.phase
            when 1 then mapping.phase_1_series
            when 2 then mapping.phase_2_series
            else mapping.phase_3_series
          end,
          'repetitions', case evaluation_session.phase
            when 1 then mapping.phase_1_repetitions
            when 2 then mapping.phase_2_repetitions
            else null
          end,
          'restSeconds', case when evaluation_session.phase < 3 then 90 else 30 end
        ),
        'format-reps-s' || lpad(
          (case evaluation_session.phase
            when 1 then mapping.phase_1_series
            when 2 then mapping.phase_2_series
            else mapping.phase_3_series
          end)::text,
          2,
          '0'
        ) || '-' || case when evaluation_session.phase = 3 then 'maximum'
          else 'r' || lpad(
            (case evaluation_session.phase
              when 1 then mapping.phase_1_repetitions
              else mapping.phase_2_repetitions
            end)::text,
            2,
            '0'
          ) end || '-rest' || case when evaluation_session.phase < 3 then '90' else '30' end || 's',
        case when evaluation_session.phase = 1 then 90 when evaluation_session.phase = 2 then 180 else 0 end,
        240
      from public.acrea_level_evaluation_sessions evaluation_session
      cross join public.acrea_level_evaluation_exercise_mappings mapping
      where evaluation_session.attempt_id = v_attempt_id
        and mapping.protocol_version = 4
        and mapping.validated_at is not null;
    end
    $evaluation$;
  $$,
  'owner can persist the exact three-session V4 exercise protocol'
);

select lives_ok(
  $$
    select * from public.finalize_acrea_level_evaluation_v4(
      (select id from public.acrea_level_evaluation_attempts
       where user_id = '00000000-0000-4000-8000-000000000201'
       order by id desc limit 1)
    )
  $$,
  'complete V4 evaluation finalizes atomically'
);

select results_eq(
  $$
    select renforcement_level, cardio_level, proprioception_level,
           level_test_status, level_test_version
    from public.acrea_profiles
    where user_id = '00000000-0000-4000-8000-000000000201'
  $$,
  $$ values (2::smallint, 2::smallint, 2::smallint, 'completed'::text, 4::integer) $$,
  'V4 thresholds set the three assessed levels and protocol version'
);
select is(
  (
    select count(*)
    from public.acrea_level_evaluation_preferences
    where user_id = '00000000-0000-4000-8000-000000000201'
      and protocol_version = 4
  ),
  6::bigint,
  'V4 finalization stores one preference summary per exact exercise'
);
select is(
  (
    select status
    from public.acrea_level_evaluation_attempts
    where user_id = '00000000-0000-4000-8000-000000000201'
    order by id desc limit 1
  ),
  'completed',
  'V4 finalization completes the owned attempt'
);
select throws_ok(
  $$
    insert into public.acrea_level_evaluation_attempts (
      user_id, protocol_version, attempt_kind, status
    ) values (
      '00000000-0000-4000-8000-000000000202', 4, 'initial', 'in_progress'
    )
  $$,
  '42501',
  null,
  'owner cannot create another user V4 evaluation attempt'
);

set local "request.jwt.claim.sub" = '00000000-0000-4000-8000-000000000202';

select is(
  (
    select count(*)
    from public.acrea_level_evaluation_preferences
    where user_id = '00000000-0000-4000-8000-000000000201'
  ),
  0::bigint,
  'another authenticated user cannot read V4 preferences'
);
select is(
  (
    select count(*)
    from public.acrea_level_evaluation_exercise_mappings
    where protocol_version = 4
  ),
  6::bigint,
  'another authenticated user can read canonical V4 mappings'
);
select lives_ok(
  $$
    insert into public.acrea_level_evaluation_attempts (
      user_id, protocol_version, attempt_kind, status
    ) values (
      '00000000-0000-4000-8000-000000000202', 4, 'initial', 'in_progress'
    )
  $$,
  'another user can create their own V4 attempt'
);

-- The finalizer intentionally uses on-commit temporary tables. pgTAP catches
-- the following expected exception inside this outer transaction, so emulate
-- the commit boundary that separates normal RPC calls before invoking it again.
drop table if exists pg_temp.expected_evaluation_results;
drop table if exists pg_temp.selected_evaluation_sessions;

select throws_ok(
  $$
    select * from public.finalize_acrea_level_evaluation_v4(
      (select id from public.acrea_level_evaluation_attempts
       where user_id = '00000000-0000-4000-8000-000000000202'
       order by id desc limit 1)
    )
  $$,
  '23514',
  'Three passed V4 evaluation sessions are required',
  'V4 finalization rejects an incomplete attempt'
);

select * from finish();
rollback;
