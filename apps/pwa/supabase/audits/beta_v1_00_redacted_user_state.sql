-- Read-only, aggregate-only state capture for beta V1.00.
-- Save the output before and after a replay. It emits neither identifiers,
-- names nor raw scores; user identifiers are used only inside a checksum.
with completed_profiles as (
  select
    profile.user_id,
    profile.level_test_status,
    profile.level_test_version,
    profile.level_test_completed_at,
    profile.renforcement_level,
    profile.cardio_level,
    profile.proprioception_level
  from public.acrea_profiles profile
  where profile.level_test_status = 'completed'
), profile_lines as (
  select concat_ws(
    '|', user_id::text, level_test_status, level_test_version::text,
    coalesce(to_char(level_test_completed_at at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"'), ''),
    coalesce(renforcement_level::text, ''), coalesce(cardio_level::text, ''),
    coalesce(proprioception_level::text, '')
  ) as line
  from completed_profiles
), equipment_lines as (
  select concat_ws('|', equipment.user_id::text, catalog_equipment.code) as line
  from public.acrea_profile_equipment equipment
  join public.catalog_equipment catalog_equipment on catalog_equipment.id = equipment.equipment_id
), canonical_results as (
  select
    attempt.user_id,
    attempt.completed_at,
    case result.exercise_code
      when 'renforcement-pompe-stricte' then 'renforcement-strict-pushups'
      when 'renforcement-strict-pushups' then 'renforcement-strict-pushups'
      when 'renforcement-squat-poids-du-corps' then 'renforcement-bodyweight-squats'
      when 'renforcement-bodyweight-squats' then 'renforcement-bodyweight-squats'
      when 'cardio-burpee-sans-pompe' then 'cardio-burpee-sans-pompe'
      when 'cardio-mountain-climber-classique' then 'cardio-mountain-climber-controle'
      when 'cardio-mountain-climber-controle' then 'cardio-mountain-climber-controle'
      when 'proprioception-releve-de-jambes-au-sol' then 'proprioception-leg-raise'
      when 'proprioception-leg-raise' then 'proprioception-leg-raise'
      when 'proprioception-planche-lean' then 'proprioception-planche-lean'
      else result.exercise_code
    end as evaluation_exercise_code,
    case result.pillar
      when 'renforcement' then 'strength'
      when 'strength' then 'strength'
      when 'cardio' then 'cardio'
      when 'proprioception' then 'proprioception'
      else result.pillar
    end as pillar,
    result.maximum_repetitions,
    result.technical_valid,
    result.appreciation_rating,
    result.attempted_at
  from public.acrea_level_evaluation_results result
  join public.acrea_level_evaluation_sessions session
    on session.id = result.evaluation_session_id
  join public.acrea_level_evaluation_attempts attempt
    on attempt.id = session.attempt_id
  where attempt.status = 'completed'
), result_lines as (
  select concat_ws(
    '|', user_id::text,
    coalesce(to_char(completed_at at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"'), ''),
    evaluation_exercise_code, pillar, coalesce(maximum_repetitions::text, ''),
    technical_valid::text, appreciation_rating::text,
    to_char(attempted_at at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"')
  ) as line
  from canonical_results
)
select 'user_profiles' as scope, count(*)::bigint as row_count, null::text as checksum
from public.user_profiles
union all
select 'acrea_profiles', count(*), null from public.acrea_profiles
union all
select 'declared_equipment', count(*), md5(coalesce(string_agg(line, E'\n' order by line), ''))
from equipment_lines
union all
select 'completed_profiles', count(*), md5(coalesce(string_agg(line, E'\n' order by line), ''))
from profile_lines
union all
select 'completed_evaluation_results', count(*), md5(coalesce(string_agg(line, E'\n' order by line), ''))
from result_lines
order by scope;
