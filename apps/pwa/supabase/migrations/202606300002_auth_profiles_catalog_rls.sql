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

create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists user_profiles_set_updated_at on public.user_profiles;
create trigger user_profiles_set_updated_at
before update on public.user_profiles
for each row
execute function public.set_updated_at();

create or replace function private.handle_new_user_profile()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.user_profiles (id, email, display_name, account_type)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data ->> 'name', split_part(new.email, '@', 1)),
    'free'
  )
  on conflict (id) do update set
    email = excluded.email,
    display_name = coalesce(public.user_profiles.display_name, excluded.display_name);

  return new;
end;
$$;

drop trigger if exists on_auth_user_created_create_profile on auth.users;
create trigger on_auth_user_created_create_profile
after insert on auth.users
for each row
execute function private.handle_new_user_profile();

create or replace function private.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.user_profiles
    where id = (select auth.uid())
      and account_type = 'admin'
  );
$$;

revoke all on function public.set_updated_at() from public;
revoke all on function private.handle_new_user_profile() from public;
revoke all on function private.is_admin() from public;
grant usage on schema public to anon, authenticated;
grant usage on schema private to authenticated;
grant execute on function private.is_admin() to authenticated;

alter table public.user_profiles enable row level security;
alter table public.catalog_pillars enable row level security;
alter table public.catalog_families enable row level security;
alter table public.catalog_exercises enable row level security;
alter table public.catalog_exercise_muscle_groups enable row level security;
alter table public.catalog_session_definitions enable row level security;
alter table public.catalog_series enable row level security;
alter table public.catalog_repetitions enable row level security;
alter table public.catalog_rests enable row level security;
alter table public.catalog_intervals enable row level security;
alter table public.catalog_formats enable row level security;
alter table public.catalog_seance_templates enable row level security;
alter table public.catalog_level_seance_templates enable row level security;
alter table public.catalog_seance_template_sessions enable row level security;
alter table public.catalog_session_definitions enable row level security;

grant select on table public.user_profiles to authenticated;
grant update (display_name) on table public.user_profiles to authenticated;

grant select, insert, update, delete on table public.catalog_pillars to authenticated;
grant select, insert, update, delete on table public.catalog_families to authenticated;
grant select, insert, update, delete on table public.catalog_exercises to authenticated;
grant select, insert, update, delete on table public.catalog_exercise_muscle_groups to authenticated;
grant select, insert, update, delete on table public.catalog_session_definitions to authenticated;
grant select, insert, update, delete on table public.catalog_series to authenticated;
grant select, insert, update, delete on table public.catalog_repetitions to authenticated;
grant select, insert, update, delete on table public.catalog_rests to authenticated;
grant select, insert, update, delete on table public.catalog_intervals to authenticated;
grant select, insert, update, delete on table public.catalog_formats to authenticated;
grant select, insert, update, delete on table public.catalog_seance_templates to authenticated;
grant select, insert, update, delete on table public.catalog_level_seance_templates to authenticated;
grant select, insert, update, delete on table public.catalog_seance_template_sessions to authenticated;
grant select, insert, update, delete on table public.catalog_session_definitions to authenticated;
grant usage, select on all sequences in schema public to authenticated;

drop policy if exists "Users can read their own profile" on public.user_profiles;
create policy "Users can read their own profile"
on public.user_profiles
for select
to authenticated
using (
  id = (select auth.uid())
  or (select private.is_admin())
);

drop policy if exists "Users can update their display name" on public.user_profiles;
create policy "Users can update their display name"
on public.user_profiles
for update
to authenticated
using (id = (select auth.uid()))
with check (id = (select auth.uid()));

drop policy if exists "Authenticated users can read catalog pillars" on public.catalog_pillars;
create policy "Authenticated users can read catalog pillars"
on public.catalog_pillars
for select
to authenticated
using (true);

drop policy if exists "Admins can mutate catalog pillars" on public.catalog_pillars;
create policy "Admins can mutate catalog pillars"
on public.catalog_pillars
for all
to authenticated
using ((select private.is_admin()))
with check ((select private.is_admin()));

drop policy if exists "Authenticated users can read catalog families" on public.catalog_families;
create policy "Authenticated users can read catalog families"
on public.catalog_families
for select
to authenticated
using (true);

drop policy if exists "Admins can mutate catalog families" on public.catalog_families;
create policy "Admins can mutate catalog families"
on public.catalog_families
for all
to authenticated
using ((select private.is_admin()))
with check ((select private.is_admin()));

drop policy if exists "Authenticated users can read catalog exercises" on public.catalog_exercises;
create policy "Authenticated users can read catalog exercises"
on public.catalog_exercises
for select
to authenticated
using (true);

drop policy if exists "Admins can mutate catalog exercises" on public.catalog_exercises;
create policy "Admins can mutate catalog exercises"
on public.catalog_exercises
for all
to authenticated
using ((select private.is_admin()))
with check ((select private.is_admin()));

drop policy if exists "Authenticated users can read catalog exercise families" on public.catalog_exercise_muscle_groups;
create policy "Authenticated users can read catalog exercise families"
on public.catalog_exercise_muscle_groups
for select
to authenticated
using (true);

drop policy if exists "Admins can mutate catalog exercise families" on public.catalog_exercise_muscle_groups;
create policy "Admins can mutate catalog exercise families"
on public.catalog_exercise_muscle_groups
for all
to authenticated
using ((select private.is_admin()))
with check ((select private.is_admin()));

drop policy if exists "Authenticated users can read catalog exercise levels" on public.catalog_session_definitions;
create policy "Authenticated users can read catalog exercise levels"
on public.catalog_session_definitions
for select
to authenticated
using (true);

drop policy if exists "Admins can mutate catalog exercise levels" on public.catalog_session_definitions;
create policy "Admins can mutate catalog exercise levels"
on public.catalog_session_definitions
for all
to authenticated
using ((select private.is_admin()))
with check ((select private.is_admin()));

drop policy if exists "Authenticated users can read catalog series" on public.catalog_series;
create policy "Authenticated users can read catalog series"
on public.catalog_series
for select
to authenticated
using (true);

drop policy if exists "Admins can mutate catalog series" on public.catalog_series;
create policy "Admins can mutate catalog series"
on public.catalog_series
for all
to authenticated
using ((select private.is_admin()))
with check ((select private.is_admin()));

drop policy if exists "Authenticated users can read catalog repetitions" on public.catalog_repetitions;
create policy "Authenticated users can read catalog repetitions"
on public.catalog_repetitions
for select
to authenticated
using (true);

drop policy if exists "Admins can mutate catalog repetitions" on public.catalog_repetitions;
create policy "Admins can mutate catalog repetitions"
on public.catalog_repetitions
for all
to authenticated
using ((select private.is_admin()))
with check ((select private.is_admin()));

drop policy if exists "Authenticated users can read catalog rests" on public.catalog_rests;
create policy "Authenticated users can read catalog rests"
on public.catalog_rests
for select
to authenticated
using (true);

drop policy if exists "Admins can mutate catalog rests" on public.catalog_rests;
create policy "Admins can mutate catalog rests"
on public.catalog_rests
for all
to authenticated
using ((select private.is_admin()))
with check ((select private.is_admin()));

drop policy if exists "Authenticated users can read catalog intervals" on public.catalog_intervals;
create policy "Authenticated users can read catalog intervals"
on public.catalog_intervals
for select
to authenticated
using (true);

drop policy if exists "Admins can mutate catalog intervals" on public.catalog_intervals;
create policy "Admins can mutate catalog intervals"
on public.catalog_intervals
for all
to authenticated
using ((select private.is_admin()))
with check ((select private.is_admin()));

drop policy if exists "Authenticated users can read catalog formats" on public.catalog_formats;
create policy "Authenticated users can read catalog formats"
on public.catalog_formats
for select
to authenticated
using (true);

drop policy if exists "Admins can mutate catalog formats" on public.catalog_formats;
create policy "Admins can mutate catalog formats"
on public.catalog_formats
for all
to authenticated
using ((select private.is_admin()))
with check ((select private.is_admin()));

drop policy if exists "Authenticated users can read catalog sessions" on public.catalog_seance_templates;
create policy "Authenticated users can read catalog sessions"
on public.catalog_seance_templates
for select
to authenticated
using (true);

drop policy if exists "Admins can mutate catalog sessions" on public.catalog_seance_templates;
create policy "Admins can mutate catalog sessions"
on public.catalog_seance_templates
for all
to authenticated
using ((select private.is_admin()))
with check ((select private.is_admin()));

drop policy if exists "Authenticated users can read catalog level sessions" on public.catalog_level_seance_templates;
create policy "Authenticated users can read catalog level sessions"
on public.catalog_level_seance_templates
for select
to authenticated
using (true);

drop policy if exists "Admins can mutate catalog level sessions" on public.catalog_level_seance_templates;
create policy "Admins can mutate catalog level sessions"
on public.catalog_level_seance_templates
for all
to authenticated
using ((select private.is_admin()))
with check ((select private.is_admin()));

drop policy if exists "Authenticated users can read catalog session exercises" on public.catalog_seance_template_sessions;
create policy "Authenticated users can read catalog session exercises"
on public.catalog_seance_template_sessions
for select
to authenticated
using (true);

drop policy if exists "Admins can mutate catalog session exercises" on public.catalog_seance_template_sessions;
create policy "Admins can mutate catalog session exercises"
on public.catalog_seance_template_sessions
for all
to authenticated
using ((select private.is_admin()))
with check ((select private.is_admin()));

drop policy if exists "Authenticated users can read catalog exercise level formats" on public.catalog_session_definitions;
create policy "Authenticated users can read catalog exercise level formats"
on public.catalog_session_definitions
for select
to authenticated
using (true);

drop policy if exists "Admins can mutate catalog exercise level formats" on public.catalog_session_definitions;
create policy "Admins can mutate catalog exercise level formats"
on public.catalog_session_definitions
for all
to authenticated
using ((select private.is_admin()))
with check ((select private.is_admin()));

comment on table public.user_profiles is
  'Application user profile. Promote first admin manually: update public.user_profiles set account_type = ''admin'' where email = ''admin@example.com'';';
