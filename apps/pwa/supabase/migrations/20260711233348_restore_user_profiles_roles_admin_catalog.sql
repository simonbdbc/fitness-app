-- Restore application account roles after the destructive catalogue reset.
-- Catalogue mutations remain restricted to the current admin scope; exercises
-- and their muscle-group links stay read-only through the Data API.

do $$
begin
  create type public.user_account_type as enum ('admin', 'premium', 'free');
exception
  when duplicate_object then null;
end $$;

create schema if not exists private;

create table if not exists public.user_profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text,
  display_name text,
  account_type public.user_account_type not null default 'free',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create or replace function private.set_user_profile_updated_at()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create or replace function private.sync_auth_user_profile()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.user_profiles (
    id,
    email,
    display_name,
    account_type
  )
  values (
    new.id,
    new.email,
    coalesce(
      nullif(btrim(new.raw_user_meta_data ->> 'name'), ''),
      nullif(split_part(coalesce(new.email, ''), '@', 1), '')
    ),
    'free'
  )
  on conflict (id) do update set
    email = excluded.email,
    display_name = coalesce(
      public.user_profiles.display_name,
      excluded.display_name
    );

  return new;
end;
$$;

create or replace function private.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.user_profiles
    where id = (select auth.uid())
      and account_type = 'admin'
  );
$$;

revoke all on function private.set_user_profile_updated_at() from public;
revoke all on function private.sync_auth_user_profile() from public;
revoke all on function private.is_admin() from public;

drop trigger if exists user_profiles_set_updated_at on public.user_profiles;
create trigger user_profiles_set_updated_at
before update on public.user_profiles
for each row
execute function private.set_user_profile_updated_at();

drop trigger if exists on_auth_user_created_create_profile on auth.users;
drop trigger if exists on_auth_user_changed_sync_profile on auth.users;
create trigger on_auth_user_changed_sync_profile
after insert or update of email, raw_user_meta_data on auth.users
for each row
execute function private.sync_auth_user_profile();

insert into public.user_profiles (
  id,
  email,
  display_name,
  account_type
)
select
  users.id,
  users.email,
  coalesce(
    nullif(btrim(users.raw_user_meta_data ->> 'name'), ''),
    nullif(split_part(coalesce(users.email, ''), '@', 1), '')
  ),
  'free'
from auth.users as users
on conflict (id) do update set
  email = excluded.email,
  display_name = coalesce(
    public.user_profiles.display_name,
    excluded.display_name
  );

alter table public.user_profiles enable row level security;

revoke all privileges on table public.user_profiles from anon, authenticated;
grant select on table public.user_profiles to authenticated;
grant update (display_name) on table public.user_profiles to authenticated;

drop policy if exists "Users can read their own profile" on public.user_profiles;
create policy "Users can read their own profile"
on public.user_profiles
for select
to authenticated
using (id = (select auth.uid()));

drop policy if exists "Users can update their display name" on public.user_profiles;
create policy "Users can update their display name"
on public.user_profiles
for update
to authenticated
using (id = (select auth.uid()))
with check (id = (select auth.uid()));

grant usage on schema private to authenticated;
grant execute on function private.is_admin() to authenticated;

grant insert, update, delete on table public.catalog_equipment to authenticated;
grant insert, update, delete on table public.catalog_rests to authenticated;
grant insert, update, delete on table public.catalog_series to authenticated;
grant insert, update, delete on table public.catalog_repetitions to authenticated;
grant insert, update, delete on table public.catalog_intervals to authenticated;
grant insert, update, delete on table public.catalog_formats to authenticated;
grant insert, update, delete on table public.catalog_session_templates to authenticated;
grant insert, update, delete on table public.catalog_session_template_levels to authenticated;

drop policy if exists "Admins can mutate catalog_equipment" on public.catalog_equipment;
create policy "Admins can mutate catalog_equipment" on public.catalog_equipment
for all to authenticated
using ((select private.is_admin()))
with check ((select private.is_admin()));

drop policy if exists "Admins can mutate catalog_rests" on public.catalog_rests;
create policy "Admins can mutate catalog_rests" on public.catalog_rests
for all to authenticated
using ((select private.is_admin()))
with check ((select private.is_admin()));

drop policy if exists "Admins can mutate catalog_series" on public.catalog_series;
create policy "Admins can mutate catalog_series" on public.catalog_series
for all to authenticated
using ((select private.is_admin()))
with check ((select private.is_admin()));

drop policy if exists "Admins can mutate catalog_repetitions" on public.catalog_repetitions;
create policy "Admins can mutate catalog_repetitions" on public.catalog_repetitions
for all to authenticated
using ((select private.is_admin()))
with check ((select private.is_admin()));

drop policy if exists "Admins can mutate catalog_intervals" on public.catalog_intervals;
create policy "Admins can mutate catalog_intervals" on public.catalog_intervals
for all to authenticated
using ((select private.is_admin()))
with check ((select private.is_admin()));

drop policy if exists "Admins can mutate catalog_formats" on public.catalog_formats;
create policy "Admins can mutate catalog_formats" on public.catalog_formats
for all to authenticated
using ((select private.is_admin()))
with check ((select private.is_admin()));

drop policy if exists "Admins can mutate catalog_session_templates" on public.catalog_session_templates;
create policy "Admins can mutate catalog_session_templates" on public.catalog_session_templates
for all to authenticated
using ((select private.is_admin()))
with check ((select private.is_admin()));

drop policy if exists "Admins can mutate catalog_session_template_levels" on public.catalog_session_template_levels;
create policy "Admins can mutate catalog_session_template_levels" on public.catalog_session_template_levels
for all to authenticated
using ((select private.is_admin()))
with check ((select private.is_admin()));

grant usage, select on all sequences in schema public to authenticated;

create or replace function public.admin_upsert_catalog_session_template(
  p_id bigint,
  p_code text,
  p_title text,
  p_description text,
  p_exercise_id bigint,
  p_levels smallint[],
  p_is_active boolean,
  p_source_status text,
  p_updated_at timestamptz default now()
)
returns bigint
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_session_template_id bigint;
  v_normalized_levels smallint[];
begin
  if not (select private.is_admin()) then
    raise exception 'Admin role required' using errcode = '42501';
  end if;

  select array_agg(distinct level order by level)
  into v_normalized_levels
  from unnest(coalesce(p_levels, array[]::smallint[])) as level
  where level between 1 and 10;

  if coalesce(cardinality(v_normalized_levels), 0) = 0 then
    raise exception 'At least one level is required' using errcode = '23514';
  end if;

  if p_id is null or p_id <= 0 then
    insert into public.catalog_session_templates (
      code,
      title,
      description,
      exercise_id,
      is_active,
      source_status,
      updated_at
    )
    values (
      p_code,
      p_title,
      coalesce(p_description, ''),
      p_exercise_id,
      p_is_active,
      p_source_status,
      p_updated_at
    )
    returning id into v_session_template_id;
  else
    update public.catalog_session_templates
    set
      code = p_code,
      title = p_title,
      description = coalesce(p_description, ''),
      exercise_id = p_exercise_id,
      is_active = p_is_active,
      source_status = p_source_status,
      updated_at = p_updated_at
    where id = p_id
    returning id into v_session_template_id;

    if v_session_template_id is null then
      raise exception 'Session template % not found', p_id using errcode = 'P0002';
    end if;
  end if;

  delete from public.catalog_session_template_levels
  where catalog_session_template_levels.session_template_id = v_session_template_id;

  insert into public.catalog_session_template_levels (
    session_template_id,
    level,
    updated_at
  )
  select v_session_template_id, level, p_updated_at
  from unnest(v_normalized_levels) as level;

  return v_session_template_id;
end;
$$;

revoke all on function public.admin_upsert_catalog_session_template(
  bigint,
  text,
  text,
  text,
  bigint,
  smallint[],
  boolean,
  text,
  timestamptz
) from public, anon;
grant execute on function public.admin_upsert_catalog_session_template(
  bigint,
  text,
  text,
  text,
  bigint,
  smallint[],
  boolean,
  text,
  timestamptz
) to authenticated;

notify pgrst, 'reload schema';
