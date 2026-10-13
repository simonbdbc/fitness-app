-- Entirely synthetic accounts on reserved example.test domains.
-- Known test passwords are for isolated local development only; never seed production.
-- Local development accounts only. This file is loaded by `supabase db reset`.
do $$
declare
  local_account record;
begin
  for local_account in
    select *
    from (
      values
        (
          '00000000-0000-4000-8000-000000000001'::uuid,
          'basic@example.test'::text,
          'demo-session'::text,
          'Profil demo'::text,
          'basic'::public.user_account_type
        ),
        (
          '00000000-0000-4000-8000-000000000002'::uuid,
          'premium@example.test'::text,
          'premium-session'::text,
          'Profil premium'::text,
          'premium'::public.user_account_type
        ),
        (
          '00000000-0000-4000-8000-000000000003'::uuid,
          'admin@example.test'::text,
          'admin-session'::text,
          'Profil administrateur'::text,
          'admin'::public.user_account_type
        )
    ) as accounts(user_id, email, password, display_name, account_type)
  loop
    insert into auth.users (
      instance_id,
      id,
      aud,
      role,
      email,
      encrypted_password,
      email_confirmed_at,
      raw_app_meta_data,
      raw_user_meta_data,
      created_at,
      updated_at,
      confirmation_token,
      email_change,
      email_change_token_new,
      recovery_token
    )
    values (
      '00000000-0000-0000-0000-000000000000',
      local_account.user_id,
      'authenticated',
      'authenticated',
      local_account.email,
      extensions.crypt(local_account.password, extensions.gen_salt('bf')),
      now(),
      '{"provider":"email","providers":["email"]}'::jsonb,
      jsonb_build_object('name', local_account.display_name),
      now(),
      now(),
      '',
      '',
      '',
      ''
    )
    on conflict (id) do update set
      email = excluded.email,
      encrypted_password = excluded.encrypted_password,
      email_confirmed_at = excluded.email_confirmed_at,
      raw_app_meta_data = excluded.raw_app_meta_data,
      raw_user_meta_data = excluded.raw_user_meta_data,
      updated_at = excluded.updated_at;

    insert into auth.identities (
      provider_id,
      user_id,
      identity_data,
      provider,
      last_sign_in_at,
      created_at,
      updated_at
    )
    values (
      local_account.user_id::text,
      local_account.user_id,
      jsonb_build_object(
        'sub', local_account.user_id::text,
        'email', local_account.email,
        'email_verified', true,
        'phone_verified', false
      ),
      'email',
      now(),
      now(),
      now()
    )
    on conflict (provider_id, provider) do update set
      user_id = excluded.user_id,
      identity_data = excluded.identity_data,
      updated_at = excluded.updated_at;

    update public.user_profiles
    set
      email = local_account.email,
      display_name = local_account.display_name,
      account_type = local_account.account_type
    where id = local_account.user_id;
  end loop;
end
$$;
