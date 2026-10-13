do $$
declare
  missing_tables text;
  invalid_count bigint;
  pending_constraints text;
begin
  select string_agg(expected.table_name, ', ' order by expected.table_name)
  into missing_tables
  from (
    values
      ('acrea_profiles'), ('acrea_profile_equipment'),
      ('acrea_profile_restrictions'), ('programs'), ('trainings'),
      ('seances'), ('sessions'), ('session_feedback'),
      ('catalog_exercise_equipment_options'),
      ('catalog_exercise_equipment_option_items')
  ) expected(table_name)
  where to_regclass('public.' || expected.table_name) is null;
  if missing_tables is not null then
    raise exception 'weekly AI v2 audit: missing tables: %', missing_tables;
  end if;

  select count(*) into invalid_count
  from (
    values
      ('programs', 'profile_fingerprint'),
      ('programs', 'profile_effective_from'),
      ('trainings', 'scheduled_date'),
      ('trainings', 'generation_profile_fingerprint')
  ) expected(table_name, column_name)
  where not exists (
    select 1 from information_schema.columns column_row
    where column_row.table_schema = 'public'
      and column_row.table_name = expected.table_name
      and column_row.column_name = expected.column_name
  );
  if invalid_count <> 0 then
    raise exception 'weekly AI v2 audit: % partial regeneration column(s) missing', invalid_count;
  end if;

  select string_agg(conname, ', ' order by conname)
  into pending_constraints
  from pg_constraint
  where connamespace = 'public'::regnamespace and not convalidated;
  if pending_constraints is not null then
    raise exception 'weekly AI v2 audit: unvalidated constraints: %', pending_constraints;
  end if;

  select count(*) into invalid_count
  from pg_class
  where oid in (
      'public.acrea_profiles'::regclass,
      'public.acrea_profile_equipment'::regclass,
      'public.acrea_profile_restrictions'::regclass,
      'public.programs'::regclass,
      'public.trainings'::regclass,
      'public.seances'::regclass,
      'public.sessions'::regclass,
      'public.session_feedback'::regclass,
      'public.catalog_exercise_equipment_options'::regclass,
      'public.catalog_exercise_equipment_option_items'::regclass
    )
    and not relrowsecurity;
  if invalid_count <> 0 then
    raise exception 'weekly AI v2 audit: % exposed table(s) have RLS disabled', invalid_count;
  end if;

  if (select count(*) from public.catalog_exercises) <> 236 then
    raise exception 'weekly AI v2 audit: catalog must contain 236 exercises';
  end if;
  if (select count(*) from public.catalog_equipment) <> 24 then
    raise exception 'weekly AI v2 audit: catalog must contain 24 equipment rows';
  end if;

  select count(*) into invalid_count
  from public.catalog_exercises exercise
  where not exists (
    select 1 from public.catalog_exercise_equipment_options option_row
    where option_row.exercise_id = exercise.id
  );
  if invalid_count <> 0 then
    raise exception 'weekly AI v2 audit: % exercise(s) have no equipment option', invalid_count;
  end if;

  select count(*) into invalid_count
  from public.catalog_equipment
  where category not in ('maison', 'sport')
     or lower(trim(label)) ~ '[/]'
     or lower(trim(label)) like '%optionnel%'
     or lower(trim(label)) in ('aucun', 'support', 'support stable');
  if invalid_count <> 0 then
    raise exception 'weekly AI v2 audit: % invalid equipment row(s)', invalid_count;
  end if;

  if not exists (
    select 1 from pg_indexes
    where schemaname = 'public' and indexname = 'programs_profile_iso_week_unique'
  ) then
    raise exception 'weekly AI v2 audit: ISO week unique index is missing';
  end if;
  if not exists (
    select 1 from pg_indexes
    where schemaname = 'public' and indexname = 'session_feedback_execution_unique'
  ) then
    raise exception 'weekly AI v2 audit: feedback execution unique index is missing';
  end if;

  if (
    select count(*)
    from supabase_migrations.schema_migrations
    where version in ('20260714090000', '20260714130000', '20260715100000')
  ) <> 3 then
    raise exception 'weekly AI v2 audit: expected migrations are missing from history';
  end if;
end $$;
