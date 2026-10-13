-- Synthetic-only fixture for the beta V1.00 migration replay.
-- This fixture is deliberately independent from production data. It gives the
-- replay a completed V3 evaluation, declared equipment and stable timestamps
-- whose preservation and V4 remapping are checked after the migration.
begin;

do $$
declare
  fixture_user constant uuid := '00000000-0000-4000-8000-000000000001';
  fixture_completed_at constant timestamptz := '2026-01-15T10:30:00.000Z';
  fixture_equipment_id bigint;
  fixture_attempt_id bigint;
  fixture_session_id bigint;
begin
  if not exists (select 1 from public.user_profiles where id = fixture_user) then
    raise exception 'Synthetic qualification user is missing';
  end if;

  insert into public.acrea_profiles (
    user_id, name, objective, objective_code, equipment_mode,
    weekly_frequency, average_session_minutes, session_minutes_min,
    session_minutes_max, weekly_novelty_percent, level_test_status,
    level_test_version, level_test_completed_at, renforcement_level,
    cardio_level, proprioception_level, preferred_weekdays, created_at, updated_at
  ) values (
    fixture_user, 'Qualification synthétique', 'Condition physique générale',
    'complete', 'mixte', 3, 45, 40, 55, 50, 'completed', 3,
    fixture_completed_at, 2, 2, 2, array[1, 3, 5]::smallint[],
    fixture_completed_at, fixture_completed_at
  )
  on conflict (user_id) do update set
    name = excluded.name,
    objective = excluded.objective,
    objective_code = excluded.objective_code,
    equipment_mode = excluded.equipment_mode,
    weekly_frequency = excluded.weekly_frequency,
    average_session_minutes = excluded.average_session_minutes,
    session_minutes_min = excluded.session_minutes_min,
    session_minutes_max = excluded.session_minutes_max,
    weekly_novelty_percent = excluded.weekly_novelty_percent,
    level_test_status = excluded.level_test_status,
    level_test_version = excluded.level_test_version,
    level_test_completed_at = excluded.level_test_completed_at,
    renforcement_level = excluded.renforcement_level,
    cardio_level = excluded.cardio_level,
    proprioception_level = excluded.proprioception_level,
    preferred_weekdays = excluded.preferred_weekdays,
    updated_at = excluded.updated_at;

  select id into fixture_equipment_id
  from public.catalog_equipment
  where code = 'tapis-de-sol'
  limit 1;
  if fixture_equipment_id is null then
    raise exception 'Synthetic qualification equipment is missing';
  end if;
  insert into public.acrea_profile_equipment (user_id, equipment_id)
  values (fixture_user, fixture_equipment_id)
  on conflict do nothing;

  delete from public.acrea_level_evaluation_attempts where user_id = fixture_user;
  insert into public.acrea_level_evaluation_attempts (
    user_id, protocol_version, attempt_kind, status, started_at, completed_at, superseded_at
  ) values (
    fixture_user, 3, 'initial', 'completed',
    fixture_completed_at - interval '15 minutes', fixture_completed_at, null
  ) returning id into fixture_attempt_id;

  insert into public.acrea_level_evaluation_sessions (
    attempt_id, phase, run_number, status, active_step_index, started_at, completed_at
  ) values (
    fixture_attempt_id, 3, 1, 'passed', 6,
    fixture_completed_at - interval '10 minutes', fixture_completed_at
  ) returning id into fixture_session_id;

  insert into public.acrea_level_evaluation_results (
    evaluation_session_id, exercise_code, pillar, exercise_order, target_series,
    target_repetitions, maximum_repetitions, technical_valid, appreciation_rating,
    prescription, timer_plan_code, total_seconds, completed_seconds, attempted_at
  ) values
    (fixture_session_id, 'renforcement-pompe-stricte', 'renforcement', 1, 1, null, 18, true, 4, '{}'::jsonb, 'synthetic', 60, 60, fixture_completed_at),
    (fixture_session_id, 'renforcement-squat-poids-du-corps', 'renforcement', 2, 1, null, 32, true, 4, '{}'::jsonb, 'synthetic', 60, 60, fixture_completed_at),
    (fixture_session_id, 'cardio-burpee-sans-pompe', 'cardio', 3, 1, null, 24, true, 4, '{}'::jsonb, 'synthetic', 60, 60, fixture_completed_at),
    (fixture_session_id, 'cardio-mountain-climber-classique', 'cardio', 4, 1, null, 48, true, 4, '{}'::jsonb, 'synthetic', 60, 60, fixture_completed_at),
    (fixture_session_id, 'proprioception-releve-de-jambes-au-sol', 'proprioception', 5, 1, null, 18, true, 4, '{}'::jsonb, 'synthetic', 60, 60, fixture_completed_at),
    (fixture_session_id, 'proprioception-planche-lean', 'proprioception', 6, 1, null, 14, true, 4, '{}'::jsonb, 'synthetic', 60, 60, fixture_completed_at);

  delete from public.acrea_level_evaluation_preferences where user_id = fixture_user;
  insert into public.acrea_level_evaluation_preferences (
    user_id, protocol_version, evaluation_exercise_code, catalog_exercise_code,
    appreciation_average, sample_count, evaluated_at
  ) values
    (fixture_user, 3, 'renforcement-strict-pushups', 'renforcement-pompe-stricte', 4, 3, fixture_completed_at),
    (fixture_user, 3, 'renforcement-bodyweight-squats', 'renforcement-squat-poids-du-corps', 4, 3, fixture_completed_at),
    (fixture_user, 3, 'cardio-burpee-sans-pompe', 'cardio-burpee-sans-pompe', 4, 3, fixture_completed_at),
    (fixture_user, 3, 'cardio-mountain-climber-controle', 'cardio-mountain-climber-classique', 4, 3, fixture_completed_at),
    (fixture_user, 3, 'proprioception-leg-raise', 'proprioception-releve-de-jambes-au-sol', 4, 3, fixture_completed_at),
    (fixture_user, 3, 'proprioception-planche-lean', 'proprioception-planche-lean', 4, 3, fixture_completed_at);
end $$;

commit;
