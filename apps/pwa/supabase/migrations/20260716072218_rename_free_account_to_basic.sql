-- Rename the entry-level account without recreating the enum or rewriting rows.
-- PostgreSQL keeps existing user_profiles values attached to the renamed label.
do $$
declare
  has_basic boolean;
  has_free boolean;
begin
  select
    bool_or(enum_value.enumlabel = 'basic'),
    bool_or(enum_value.enumlabel = 'free')
  into has_basic, has_free
  from pg_type as enum_type
  join pg_namespace as enum_namespace
    on enum_namespace.oid = enum_type.typnamespace
  join pg_enum as enum_value
    on enum_value.enumtypid = enum_type.oid
  where enum_namespace.nspname = 'public'
    and enum_type.typname = 'user_account_type';

  if coalesce(has_free, false) and not coalesce(has_basic, false) then
    alter type public.user_account_type rename value 'free' to 'basic';
  elsif coalesce(has_free, false) and coalesce(has_basic, false) then
    raise exception 'user_account_type contains both free and basic';
  elsif not coalesce(has_basic, false) then
    raise exception 'user_account_type is missing the basic value';
  end if;
end $$;

alter table public.user_profiles
  alter column account_type set default 'basic';

create or replace function private.sync_auth_user_profile()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.user_profiles (id, email, display_name, account_type)
  values (
    new.id,
    new.email,
    coalesce(
      nullif(btrim(new.raw_user_meta_data ->> 'name'), ''),
      nullif(split_part(coalesce(new.email, ''), '@', 1), '')
    ),
    'basic'
  )
  on conflict (id) do update set
    email = excluded.email,
    display_name = coalesce(public.user_profiles.display_name, excluded.display_name);

  return new;
end;
$$;

revoke all on function private.sync_auth_user_profile() from public;
