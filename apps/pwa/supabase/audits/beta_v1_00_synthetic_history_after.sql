-- Post-migration assertions for beta_v1_00_synthetic_history_before.sql.
-- The expected values are public test data, never extracted user data.
do $$
declare
  fixture_user constant uuid := '00000000-0000-4000-8000-000000000001';
  fixture_completed_at constant timestamptz := '2026-01-15T10:30:00.000Z';
  expected_result_count integer := 6;
  actual_result_count integer;
begin
  if not exists (
    select 1 from public.acrea_profiles
    where user_id = fixture_user
      and level_test_status = 'completed'
      and level_test_version = 3
      and level_test_completed_at = fixture_completed_at
      and renforcement_level = 2 and cardio_level = 2 and proprioception_level = 2
  ) then
    raise exception 'Synthetic historical profile levels or completion date changed';
  end if;

  if (select count(*) from public.acrea_profile_equipment where user_id = fixture_user) <> 1 then
    raise exception 'Synthetic historical equipment declaration was not preserved';
  end if;

  select count(*) into actual_result_count
  from public.acrea_level_evaluation_results result
  join public.acrea_level_evaluation_sessions session
    on session.id = result.evaluation_session_id
  join public.acrea_level_evaluation_attempts attempt
    on attempt.id = session.attempt_id
  where attempt.user_id = fixture_user
    and attempt.status = 'completed'
    and attempt.completed_at = fixture_completed_at;
  if actual_result_count <> expected_result_count then
    raise exception 'Synthetic historical results changed: expected %, found %', expected_result_count, actual_result_count;
  end if;

  if exists (
    select 1
    from (values
      ('renforcement-strict-pushups', 'strength', 18),
      ('renforcement-bodyweight-squats', 'strength', 32),
      ('cardio-burpee-sans-pompe', 'cardio', 24),
      ('cardio-mountain-climber-controle', 'cardio', 48),
      ('proprioception-leg-raise', 'proprioception', 18),
      ('proprioception-planche-lean', 'proprioception', 14)
    ) as expected(exercise_code, pillar, maximum_repetitions)
    full join (
      select result.exercise_code, result.pillar, result.maximum_repetitions
      from public.acrea_level_evaluation_results result
      join public.acrea_level_evaluation_sessions session
        on session.id = result.evaluation_session_id
      join public.acrea_level_evaluation_attempts attempt
        on attempt.id = session.attempt_id
      where attempt.user_id = fixture_user
        and attempt.status = 'completed'
        and attempt.completed_at = fixture_completed_at
    ) actual using (exercise_code, pillar, maximum_repetitions)
    where expected.exercise_code is null or actual.exercise_code is null
  ) then
    raise exception 'Synthetic historical V4 evaluation remapping is incomplete or changed scores';
  end if;

  if (select count(*) from public.acrea_level_evaluation_preferences
      where user_id = fixture_user and protocol_version = 4) <> 6 then
    raise exception 'Synthetic historical V4 preferences were not remapped';
  end if;
end $$;
