-- Release beta v1.00: the production catalogue is intentionally replaced.
-- It follows the V2 reset migration and keeps the runtime protocol unchanged.
begin;

alter table public.acrea_level_evaluation_results
  drop constraint if exists acrea_level_evaluation_results_pillar_check;

-- Historical completed attempts stay readable after the beta reset. Some V3
-- rows use legacy catalogue codes and French pillar codes; normalize both to
-- the V4 mapping without changing attempts, scores or timestamps.
update public.acrea_level_evaluation_results result
set exercise_code = mapping.evaluation_exercise_code,
    pillar = mapping.pillar
from (values
  ('renforcement-pompe-stricte', 'renforcement-strict-pushups', 'strength'),
  ('renforcement-strict-pushups', 'renforcement-strict-pushups', 'strength'),
  ('renforcement-squat-poids-du-corps', 'renforcement-bodyweight-squats', 'strength'),
  ('renforcement-bodyweight-squats', 'renforcement-bodyweight-squats', 'strength'),
  ('cardio-burpee-sans-pompe', 'cardio-burpee-sans-pompe', 'cardio'),
  ('cardio-mountain-climber-classique', 'cardio-mountain-climber-controle', 'cardio'),
  ('cardio-mountain-climber-controle', 'cardio-mountain-climber-controle', 'cardio'),
  ('proprioception-releve-de-jambes-au-sol', 'proprioception-leg-raise', 'proprioception'),
  ('proprioception-leg-raise', 'proprioception-leg-raise', 'proprioception'),
  ('proprioception-planche-lean', 'proprioception-planche-lean', 'proprioception')
) as mapping(legacy_exercise_code, evaluation_exercise_code, pillar)
where result.exercise_code = mapping.legacy_exercise_code;

-- A completed historical evaluation is user data. Never silently retain an
-- exercise that cannot be represented by the V4 protocol: stop the release
-- so an explicit, reviewed mapping can be added first. Incomplete attempts
-- remain readable historical data and are not used by the V4 finalization.
do $$
begin
  if exists (
    select 1
    from public.acrea_level_evaluation_results result
    join public.acrea_level_evaluation_sessions session
      on session.id = result.evaluation_session_id
    join public.acrea_level_evaluation_attempts attempt
      on attempt.id = session.attempt_id
    where attempt.status = 'completed'
      and result.exercise_code not in (
        'renforcement-strict-pushups',
        'renforcement-bodyweight-squats',
        'cardio-burpee-sans-pompe',
        'cardio-mountain-climber-controle',
        'proprioception-leg-raise',
        'proprioception-planche-lean'
      )
  ) then
    raise exception
      'Completed historical evaluations contain an exercise without an approved V4 mapping'
      using errcode = '23514';
  end if;
end $$;

alter table public.acrea_level_evaluation_results
  add constraint acrea_level_evaluation_results_pillar_check
  check (pillar in ('strength', 'cardio', 'proprioception'));

create or replace function public.finalize_acrea_level_evaluation_v4(
  p_attempt_id bigint
)
returns table (
  renforcement_level smallint,
  cardio_level smallint,
  proprioception_level smallint,
  completed_at timestamptz
)
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_user_id uuid;
  v_phase_three_session_id bigint;
  v_completed_at timestamptz := now();
  v_renforcement smallint;
  v_cardio smallint;
  v_proprioception smallint;
begin
  select attempt.user_id into v_user_id
  from public.acrea_level_evaluation_attempts attempt
  where attempt.id = p_attempt_id
    and attempt.user_id = (select auth.uid())
    and attempt.protocol_version = 4
    and attempt.status = 'in_progress'
    and attempt.superseded_at is null
  for update;
  if v_user_id is null then
    raise exception 'Active V4 level evaluation attempt not found' using errcode = 'P0002';
  end if;

  create temporary table selected_evaluation_sessions on commit drop as
  select distinct on (evaluation_session.phase)
         evaluation_session.id, evaluation_session.phase
  from public.acrea_level_evaluation_sessions evaluation_session
  where evaluation_session.attempt_id = p_attempt_id
    and evaluation_session.status = 'passed'
  order by evaluation_session.phase, evaluation_session.run_number desc,
           evaluation_session.id desc;

  if (select count(*) from selected_evaluation_sessions) <> 3 then
    raise exception 'Three passed V4 evaluation sessions are required' using errcode = '23514';
  end if;

  create temporary table expected_evaluation_results on commit drop as
  select selected.id as evaluation_session_id,
         selected.phase,
         mapping.evaluation_exercise_code as exercise_code,
         mapping.exercise_slug,
         mapping.pillar,
         case selected.phase
           when 1 then mapping.phase_1_series
           when 2 then mapping.phase_2_series
           else mapping.phase_3_series
         end::smallint as target_series,
         case selected.phase
           when 1 then mapping.phase_1_repetitions
           when 2 then mapping.phase_2_repetitions
           else null
         end::smallint as target_repetitions,
         mapping.level_2_minimum,
         mapping.level_3_minimum
  from selected_evaluation_sessions selected
  cross join public.acrea_level_evaluation_exercise_mappings mapping
  where mapping.protocol_version = 4
    and mapping.validated_at is not null;

  if (select count(*) from expected_evaluation_results) <> 18 then
    raise exception 'Six validated V4 exercise mappings are required' using errcode = '23514';
  end if;

  if exists (
    select 1
    from expected_evaluation_results expected
    full join (
      select result.*
      from public.acrea_level_evaluation_results result
      join selected_evaluation_sessions selected
        on selected.id = result.evaluation_session_id
    ) result
      on result.evaluation_session_id = expected.evaluation_session_id
     and result.exercise_code = expected.exercise_code
    where result.id is null
       or expected.exercise_code is null
       or not result.technical_valid
       or result.appreciation_rating not between 1 and 5
       or result.pillar <> expected.pillar
       or result.target_series <> expected.target_series
       or result.target_repetitions is distinct from expected.target_repetitions
       or (result.prescription ->> 'series')::integer <> expected.target_series
       or (result.prescription ->> 'repetitions')::integer is distinct from expected.target_repetitions
       or (result.prescription ->> 'restSeconds')::integer <> case when expected.phase < 3 then 90 else 30 end
       or result.timer_plan_code <> 'format-reps-s' || lpad(expected.target_series::text, 2, '0') || '-' ||
          case when expected.target_repetitions is null then 'maximum'
               else 'r' || lpad(expected.target_repetitions::text, 2, '0') end ||
          '-rest' || case when expected.phase < 3 then '90' else '30' end || 's'
       or (expected.phase = 3 and result.maximum_repetitions is null)
       or (expected.phase < 3 and result.maximum_repetitions is not null)
  ) then
    raise exception 'V4 exercise set, prescriptions or feedback are invalid' using errcode = '23514';
  end if;

  select id into v_phase_three_session_id
  from selected_evaluation_sessions where phase = 3;

  with levels as (
    select expected.pillar,
           min(case
             when result.maximum_repetitions < expected.level_2_minimum then 1
             when result.maximum_repetitions < expected.level_3_minimum then 2
             else 3
           end)::smallint as level,
           count(*) as exercise_count
    from public.acrea_level_evaluation_results result
    join expected_evaluation_results expected
      on expected.evaluation_session_id = result.evaluation_session_id
     and expected.exercise_code = result.exercise_code
    where result.evaluation_session_id = v_phase_three_session_id
    group by expected.pillar
  )
  select max(level) filter (where pillar = 'strength'),
         max(level) filter (where pillar = 'cardio'),
         max(level) filter (where pillar = 'proprioception')
  into v_renforcement, v_cardio, v_proprioception
  from levels where exercise_count = 2;

  if v_renforcement is null or v_cardio is null or v_proprioception is null then
    raise exception 'Two exact exercises per V4 pillar are required' using errcode = '23514';
  end if;

  insert into public.acrea_level_evaluation_preferences (
    user_id, protocol_version, evaluation_exercise_code,
    exercise_slug, appreciation_average, sample_count, evaluated_at
  )
  select v_user_id, 4, expected.exercise_code, expected.exercise_slug,
         avg(result.appreciation_rating)::numeric(3, 2), count(*)::smallint,
         v_completed_at
  from expected_evaluation_results expected
  join public.acrea_level_evaluation_results result
    on result.evaluation_session_id = expected.evaluation_session_id
   and result.exercise_code = expected.exercise_code
  group by expected.exercise_code, expected.exercise_slug
  having count(*) = 3
  on conflict (user_id, protocol_version, exercise_slug) do update set
    evaluation_exercise_code = excluded.evaluation_exercise_code,
    appreciation_average = excluded.appreciation_average,
    sample_count = excluded.sample_count,
    evaluated_at = excluded.evaluated_at,
    sync_status = 'synced';

  if (
    select count(*) from public.acrea_level_evaluation_preferences preference
    where preference.user_id = v_user_id and preference.protocol_version = 4
  ) <> 6 then
    raise exception 'Six V4 appreciation summaries are required' using errcode = '23514';
  end if;

  update public.acrea_profiles set
    renforcement_level = v_renforcement,
    cardio_level = v_cardio,
    proprioception_level = v_proprioception,
    level_test_status = 'completed',
    level_test_version = 4,
    level_test_completed_at = v_completed_at,
    updated_at = v_completed_at
  where user_id = v_user_id;

  update public.acrea_level_evaluation_attempts set
    status = 'completed', completed_at = v_completed_at
  where id = p_attempt_id;

  return query select v_renforcement, v_cardio, v_proprioception, v_completed_at;
end;
$$;

revoke all on function public.finalize_acrea_level_evaluation_v4(bigint) from public, anon;
grant execute on function public.finalize_acrea_level_evaluation_v4(bigint) to authenticated;

commit;
