grant usage on schema public to anon, authenticated;

do $$
declare
  catalog_table text;
  catalog_tables text[] := array[
    'catalog_pillars',
    'catalog_families',
    'catalog_types',
    'catalog_muscle_groups',
    'catalog_exercises',
    'catalog_exercise_muscle_groups',
    'catalog_series',
    'catalog_repetitions',
    'catalog_rests',
    'catalog_intervals',
    'catalog_formats',
    'catalog_session_definitions',
    'catalog_seance_templates',
    'catalog_level_seance_templates',
    'catalog_seance_template_sessions'
  ];
begin
  foreach catalog_table in array catalog_tables loop
    execute format('revoke all privileges on table public.%I from anon', catalog_table);
    execute format('revoke all privileges on table public.%I from authenticated', catalog_table);
    execute format('grant select on table public.%I to anon', catalog_table);
    execute format('grant select, insert, update, delete on table public.%I to authenticated', catalog_table);
    execute format('alter table public.%I enable row level security', catalog_table);
  end loop;
end $$;

grant select on table public.catalog_pillars to anon;
grant select on table public.catalog_families to anon;
grant select on table public.catalog_types to anon;
grant select on table public.catalog_muscle_groups to anon;
grant select on table public.catalog_exercises to anon;
grant select on table public.catalog_exercise_muscle_groups to anon;
grant select on table public.catalog_series to anon;
grant select on table public.catalog_repetitions to anon;
grant select on table public.catalog_rests to anon;
grant select on table public.catalog_intervals to anon;
grant select on table public.catalog_formats to anon;
grant select on table public.catalog_session_definitions to anon;
grant select on table public.catalog_seance_templates to anon;
grant select on table public.catalog_level_seance_templates to anon;
grant select on table public.catalog_seance_template_sessions to anon;

do $$
declare
  runtime_table text;
  runtime_tables text[] := array[
    'programs',
    'trainings',
    'seances',
    'sessions',
    'session_feedback'
  ];
begin
  foreach runtime_table in array runtime_tables loop
    execute format('revoke all privileges on table public.%I from anon', runtime_table);
    execute format('grant select, insert, update, delete on table public.%I to authenticated', runtime_table);
    execute format('alter table public.%I enable row level security', runtime_table);
  end loop;
end $$;

grant usage, select on all sequences in schema public to authenticated;

drop policy if exists "Authenticated users can read catalog pillars" on public.catalog_pillars;
drop policy if exists "Catalog pillars are readable" on public.catalog_pillars;
drop policy if exists "Admins can mutate catalog pillars" on public.catalog_pillars;
create policy "Catalog pillars are readable" on public.catalog_pillars for select to anon, authenticated using (true);
create policy "Admins can mutate catalog pillars" on public.catalog_pillars for all to authenticated using ((select private.is_admin())) with check ((select private.is_admin()));

drop policy if exists "Authenticated users can read catalog families" on public.catalog_families;
drop policy if exists "Catalog families are readable" on public.catalog_families;
drop policy if exists "Admins can mutate catalog families" on public.catalog_families;
create policy "Catalog families are readable" on public.catalog_families for select to anon, authenticated using (true);
create policy "Admins can mutate catalog families" on public.catalog_families for all to authenticated using ((select private.is_admin())) with check ((select private.is_admin()));

drop policy if exists "Authenticated users can read catalog types" on public.catalog_types;
drop policy if exists "Catalog types are readable" on public.catalog_types;
drop policy if exists "Admins can mutate catalog types" on public.catalog_types;
create policy "Catalog types are readable" on public.catalog_types for select to anon, authenticated using (true);
create policy "Admins can mutate catalog types" on public.catalog_types for all to authenticated using ((select private.is_admin())) with check ((select private.is_admin()));

drop policy if exists "Authenticated users can read catalog muscle groups" on public.catalog_muscle_groups;
drop policy if exists "Catalog muscle groups are readable" on public.catalog_muscle_groups;
drop policy if exists "Admins can mutate catalog muscle groups" on public.catalog_muscle_groups;
create policy "Catalog muscle groups are readable" on public.catalog_muscle_groups for select to anon, authenticated using (true);
create policy "Admins can mutate catalog muscle groups" on public.catalog_muscle_groups for all to authenticated using ((select private.is_admin())) with check ((select private.is_admin()));

drop policy if exists "Authenticated users can read catalog exercises" on public.catalog_exercises;
drop policy if exists "Catalog exercises are readable" on public.catalog_exercises;
drop policy if exists "Admins can mutate catalog exercises" on public.catalog_exercises;
create policy "Catalog exercises are readable" on public.catalog_exercises for select to anon, authenticated using (true);
create policy "Admins can mutate catalog exercises" on public.catalog_exercises for all to authenticated using ((select private.is_admin())) with check ((select private.is_admin()));

drop policy if exists "Authenticated users can read catalog exercise families" on public.catalog_exercise_muscle_groups;
drop policy if exists "Authenticated users can read catalog exercise muscle groups" on public.catalog_exercise_muscle_groups;
drop policy if exists "Catalog exercise muscle groups are readable" on public.catalog_exercise_muscle_groups;
drop policy if exists "Admins can mutate catalog exercise muscle groups" on public.catalog_exercise_muscle_groups;
create policy "Catalog exercise muscle groups are readable" on public.catalog_exercise_muscle_groups for select to anon, authenticated using (true);
create policy "Admins can mutate catalog exercise muscle groups" on public.catalog_exercise_muscle_groups for all to authenticated using ((select private.is_admin())) with check ((select private.is_admin()));

drop policy if exists "Authenticated users can read catalog series" on public.catalog_series;
drop policy if exists "Catalog series are readable" on public.catalog_series;
drop policy if exists "Admins can mutate catalog series" on public.catalog_series;
create policy "Catalog series are readable" on public.catalog_series for select to anon, authenticated using (true);
create policy "Admins can mutate catalog series" on public.catalog_series for all to authenticated using ((select private.is_admin())) with check ((select private.is_admin()));

drop policy if exists "Authenticated users can read catalog repetitions" on public.catalog_repetitions;
drop policy if exists "Catalog repetitions are readable" on public.catalog_repetitions;
drop policy if exists "Admins can mutate catalog repetitions" on public.catalog_repetitions;
create policy "Catalog repetitions are readable" on public.catalog_repetitions for select to anon, authenticated using (true);
create policy "Admins can mutate catalog repetitions" on public.catalog_repetitions for all to authenticated using ((select private.is_admin())) with check ((select private.is_admin()));

drop policy if exists "Authenticated users can read catalog rests" on public.catalog_rests;
drop policy if exists "Catalog rests are readable" on public.catalog_rests;
drop policy if exists "Admins can mutate catalog rests" on public.catalog_rests;
create policy "Catalog rests are readable" on public.catalog_rests for select to anon, authenticated using (true);
create policy "Admins can mutate catalog rests" on public.catalog_rests for all to authenticated using ((select private.is_admin())) with check ((select private.is_admin()));

drop policy if exists "Authenticated users can read catalog intervals" on public.catalog_intervals;
drop policy if exists "Catalog intervals are readable" on public.catalog_intervals;
drop policy if exists "Admins can mutate catalog intervals" on public.catalog_intervals;
create policy "Catalog intervals are readable" on public.catalog_intervals for select to anon, authenticated using (true);
create policy "Admins can mutate catalog intervals" on public.catalog_intervals for all to authenticated using ((select private.is_admin())) with check ((select private.is_admin()));

drop policy if exists "Authenticated users can read catalog formats" on public.catalog_formats;
drop policy if exists "Catalog formats are readable" on public.catalog_formats;
drop policy if exists "Admins can mutate catalog formats" on public.catalog_formats;
create policy "Catalog formats are readable" on public.catalog_formats for select to anon, authenticated using (true);
create policy "Admins can mutate catalog formats" on public.catalog_formats for all to authenticated using ((select private.is_admin())) with check ((select private.is_admin()));

drop policy if exists "Authenticated users can read catalog exercise levels" on public.catalog_session_definitions;
drop policy if exists "Authenticated users can read catalog exercise level formats" on public.catalog_session_definitions;
drop policy if exists "Authenticated users can read catalog session definitions" on public.catalog_session_definitions;
drop policy if exists "Catalog session definitions are readable" on public.catalog_session_definitions;
drop policy if exists "Admins can mutate catalog session definitions" on public.catalog_session_definitions;
create policy "Catalog session definitions are readable" on public.catalog_session_definitions for select to anon, authenticated using (true);
create policy "Admins can mutate catalog session definitions" on public.catalog_session_definitions for all to authenticated using ((select private.is_admin())) with check ((select private.is_admin()));

drop policy if exists "Authenticated users can read catalog sessions" on public.catalog_seance_templates;
drop policy if exists "Authenticated users can read catalog seance templates" on public.catalog_seance_templates;
drop policy if exists "Catalog seance templates are readable" on public.catalog_seance_templates;
drop policy if exists "Admins can mutate catalog seance templates" on public.catalog_seance_templates;
create policy "Catalog seance templates are readable" on public.catalog_seance_templates for select to anon, authenticated using (true);
create policy "Admins can mutate catalog seance templates" on public.catalog_seance_templates for all to authenticated using ((select private.is_admin())) with check ((select private.is_admin()));

drop policy if exists "Authenticated users can read catalog level sessions" on public.catalog_level_seance_templates;
drop policy if exists "Authenticated users can read catalog level seance templates" on public.catalog_level_seance_templates;
drop policy if exists "Catalog level seance templates are readable" on public.catalog_level_seance_templates;
drop policy if exists "Admins can mutate catalog level seance templates" on public.catalog_level_seance_templates;
create policy "Catalog level seance templates are readable" on public.catalog_level_seance_templates for select to anon, authenticated using (true);
create policy "Admins can mutate catalog level seance templates" on public.catalog_level_seance_templates for all to authenticated using ((select private.is_admin())) with check ((select private.is_admin()));

drop policy if exists "Authenticated users can read catalog session exercises" on public.catalog_seance_template_sessions;
drop policy if exists "Authenticated users can read catalog seance template sessions" on public.catalog_seance_template_sessions;
drop policy if exists "Catalog seance template sessions are readable" on public.catalog_seance_template_sessions;
drop policy if exists "Admins can mutate catalog seance template sessions" on public.catalog_seance_template_sessions;
create policy "Catalog seance template sessions are readable" on public.catalog_seance_template_sessions for select to anon, authenticated using (true);
create policy "Admins can mutate catalog seance template sessions" on public.catalog_seance_template_sessions for all to authenticated using ((select private.is_admin())) with check ((select private.is_admin()));

notify pgrst, 'reload schema';
