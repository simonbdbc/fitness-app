begin;

alter table public.acrea_level_evaluation_attempts
  add column if not exists superseded_at timestamptz;

alter table public.acrea_exercise_progressions
  add column if not exists level_evaluation_version integer not null default 0;
alter table public.acrea_exercise_progressions
  drop constraint if exists acrea_exercise_progressions_level_evaluation_version_check;
alter table public.acrea_exercise_progressions
  add constraint acrea_exercise_progressions_level_evaluation_version_check
  check (level_evaluation_version >= 0);

update public.acrea_exercise_progressions progression
set level_evaluation_version = profile.level_test_version
from public.acrea_profiles profile
where profile.user_id = progression.user_id
  and progression.level_evaluation_version = 0;

update public.acrea_level_evaluation_attempts
set superseded_at = coalesce(superseded_at, now())
where protocol_version < 3 and status = 'in_progress';

update public.acrea_profiles
set level_test_status = 'required', updated_at = now();

create table public.acrea_level_evaluation_preferences (
  user_id uuid not null references public.acrea_profiles(user_id) on delete cascade,
  protocol_version integer not null check (protocol_version >= 3),
  evaluation_exercise_code text not null check (btrim(evaluation_exercise_code) <> ''),
  catalog_exercise_code text not null references public.catalog_exercises(code) on delete restrict,
  appreciation_average numeric(3, 2) not null check (appreciation_average between 1 and 5),
  sample_count smallint not null check (sample_count > 0),
  evaluated_at timestamptz not null,
  primary key (user_id, protocol_version, catalog_exercise_code)
);

create index acrea_level_evaluation_preferences_user_idx
  on public.acrea_level_evaluation_preferences (user_id, protocol_version, evaluated_at desc);

alter table public.acrea_level_evaluation_preferences enable row level security;
revoke all on public.acrea_level_evaluation_preferences from anon;
grant select, insert, update, delete on public.acrea_level_evaluation_preferences to authenticated;

create policy "Users select own level evaluation preferences"
on public.acrea_level_evaluation_preferences for select to authenticated
using (user_id = (select auth.uid()) or (select private.is_admin()));
create policy "Users insert own level evaluation preferences"
on public.acrea_level_evaluation_preferences for insert to authenticated
with check (user_id = (select auth.uid()) or (select private.is_admin()));
create policy "Users update own level evaluation preferences"
on public.acrea_level_evaluation_preferences for update to authenticated
using (user_id = (select auth.uid()) or (select private.is_admin()))
with check (user_id = (select auth.uid()) or (select private.is_admin()));
create policy "Users delete own level evaluation preferences"
on public.acrea_level_evaluation_preferences for delete to authenticated
using (user_id = (select auth.uid()) or (select private.is_admin()));

-- Les anciennes formes restent referencables par l'historique, mais seules les
-- 2 219 formes canoniques ci-dessous restent selectionnables.
update public.catalog_formats
set source_status = 'historique'
where source_status = 'seed base formats metier';

with values_list(seconds) as (
  values (10), (20), (30), (40), (50), (60), (90), (120),
         (150), (180), (210), (240), (270), (300)
)
insert into public.catalog_rests (code, label, rest_seconds, updated_at)
select 'rest-' || seconds || 's',
       case
         when seconds < 60 then seconds || ' s de repos'
         when mod(seconds, 60) = 0 then (seconds / 60) || ' min de repos'
         else floor(seconds / 60) || '.' || lpad(mod(seconds, 60)::text, 2, '0') || ' min de repos'
       end,
       seconds,
       '2026-07-08T00:00:00.000Z'::timestamptz
from values_list
on conflict (code) do update set
  label = excluded.label,
  rest_seconds = excluded.rest_seconds,
  updated_at = excluded.updated_at;

insert into public.catalog_series (code, label, series, updated_at)
select 'series-' || lpad(value::text, 2, '0'),
       value || case when value = 1 then ' serie' else ' series' end,
       value,
       '2026-07-08T00:00:00.000Z'::timestamptz
from generate_series(1, 12) value
on conflict (code) do update set
  label = excluded.label,
  series = excluded.series,
  updated_at = excluded.updated_at;

with values_list(reps) as (
  select value from generate_series(4, 12) value
  union all select 16
)
insert into public.catalog_repetitions (code, label, reps, updated_at)
select 'reps-' || lpad(reps::text, 2, '0'),
       reps || case when reps = 1 then ' repetition' else ' repetitions' end,
       reps,
       '2026-07-08T00:00:00.000Z'::timestamptz
from values_list
on conflict (code) do update set
  label = excluded.label,
  reps = excluded.reps,
  updated_at = excluded.updated_at;

insert into public.catalog_repetitions (code, label, reps, updated_at)
values ('reps-maximum', 'Maximum', null, '2026-07-08T00:00:00.000Z'::timestamptz)
on conflict (code) do update set
  label = excluded.label,
  reps = excluded.reps,
  updated_at = excluded.updated_at;

with values_list(seconds) as (
  values (10), (20), (30), (40), (50), (60), (90), (120),
         (150), (180), (210), (240), (270), (300)
)
insert into public.catalog_intervals (code, label, effort_seconds, updated_at)
select 'interval-' || seconds || 's',
       case
         when seconds < 60 then seconds || ' s d''effort'
         when mod(seconds, 60) = 0 then (seconds / 60) || ' min d''effort'
         else floor(seconds / 60) || '.' || lpad(mod(seconds, 60)::text, 2, '0') || ' min d''effort'
       end,
       seconds,
       '2026-07-08T00:00:00.000Z'::timestamptz
from values_list
on conflict (code) do update set
  label = excluded.label,
  effort_seconds = excluded.effort_seconds,
  updated_at = excluded.updated_at;

with repetition_shapes as (
  select series_count, reps, rest_seconds
  from generate_series(1, 12) series_count
  cross join generate_series(4, 12) reps
  cross join unnest(array[30, 60, 90, 120, 150, 180]) rest_seconds
  union all values (2, 16, 90), (3, 16, 90)
), formatted as (
  select
    'format-reps-s' || lpad(series_count::text, 2, '0') || '-r' ||
      lpad(reps::text, 2, '0') || '-rest' || rest_seconds || 's' as code,
    series_count || case when series_count = 1 then ' serie' else ' series' end ||
      ' de ' || reps || case when reps = 1 then ' repetition' else ' repetitions' end ||
      ' avec ' || case
        when rest_seconds < 60 then rest_seconds || ' s'
        when mod(rest_seconds, 60) = 0 then (rest_seconds / 60) || ' min'
        else floor(rest_seconds / 60) || '.' || lpad(mod(rest_seconds, 60)::text, 2, '0') || ' min'
      end || ' de repos' as label,
    series_count, reps, rest_seconds
  from repetition_shapes
)
insert into public.catalog_formats (
  code, format_type, series_id, repetitions_id, rest_id, interval_id,
  label, description, source_status, updated_at
)
select formatted.code, 'repetitions', series_row.id, repetitions_row.id,
       rest_row.id, null, formatted.label, formatted.label,
       'seed base formats metier', '2026-07-08T00:00:00.000Z'::timestamptz
from formatted
join public.catalog_series series_row
  on series_row.code = 'series-' || lpad(formatted.series_count::text, 2, '0')
join public.catalog_repetitions repetitions_row
  on repetitions_row.code = 'reps-' || lpad(formatted.reps::text, 2, '0')
join public.catalog_rests rest_row
  on rest_row.code = 'rest-' || formatted.rest_seconds || 's'
on conflict (code) do update set
  format_type = excluded.format_type, series_id = excluded.series_id,
  repetitions_id = excluded.repetitions_id, rest_id = excluded.rest_id,
  interval_id = excluded.interval_id, label = excluded.label,
  description = excluded.description, source_status = excluded.source_status,
  updated_at = excluded.updated_at;

insert into public.catalog_formats (
  code, format_type, series_id, repetitions_id, rest_id, interval_id,
  label, description, source_status, updated_at
)
select 'format-reps-s01-maximum-rest30s', 'repetitions', series_row.id,
       repetitions_row.id, rest_row.id, null,
       '1 serie du maximum de repetitions avec 30 s de repos',
       '1 serie du maximum de repetitions avec 30 s de repos',
       'seed base formats metier', '2026-07-08T00:00:00.000Z'::timestamptz
from public.catalog_series series_row
cross join public.catalog_repetitions repetitions_row
cross join public.catalog_rests rest_row
where series_row.code = 'series-01'
  and repetitions_row.code = 'reps-maximum'
  and rest_row.code = 'rest-30s'
on conflict (code) do update set
  format_type = excluded.format_type, series_id = excluded.series_id,
  repetitions_id = excluded.repetitions_id, rest_id = excluded.rest_id,
  interval_id = excluded.interval_id, label = excluded.label,
  description = excluded.description, source_status = excluded.source_status,
  updated_at = excluded.updated_at;

with seconds(value) as (
  values (10), (20), (30), (40), (50), (60), (90), (120),
         (150), (180), (210), (240), (270), (300)
), interval_shapes as (
  select series_count, effort.value as effort_seconds, rest.value as rest_seconds
  from generate_series(1, 8) series_count
  cross join seconds effort
  cross join seconds rest
), formatted as (
  select
    'format-interval-' || effort_seconds || 's-s' ||
      lpad(series_count::text, 2, '0') || '-rest' || rest_seconds || 's' as code,
    series_count || case when series_count = 1 then ' serie' else ' series' end ||
      ' de ' || case
        when effort_seconds < 60 then effort_seconds || ' s'
        when mod(effort_seconds, 60) = 0 then (effort_seconds / 60) || ' min'
        else floor(effort_seconds / 60) || '.' || lpad(mod(effort_seconds, 60)::text, 2, '0') || ' min'
      end || ' d''effort avec ' || case
        when rest_seconds < 60 then rest_seconds || ' s'
        when mod(rest_seconds, 60) = 0 then (rest_seconds / 60) || ' min'
        else floor(rest_seconds / 60) || '.' || lpad(mod(rest_seconds, 60)::text, 2, '0') || ' min'
      end || ' de repos' as label,
    series_count, effort_seconds, rest_seconds
  from interval_shapes
)
insert into public.catalog_formats (
  code, format_type, series_id, repetitions_id, rest_id, interval_id,
  label, description, source_status, updated_at
)
select formatted.code, 'intervalles', series_row.id, null, rest_row.id,
       interval_row.id, formatted.label, formatted.label,
       'seed base formats metier', '2026-07-08T00:00:00.000Z'::timestamptz
from formatted
join public.catalog_series series_row
  on series_row.code = 'series-' || lpad(formatted.series_count::text, 2, '0')
join public.catalog_rests rest_row
  on rest_row.code = 'rest-' || formatted.rest_seconds || 's'
join public.catalog_intervals interval_row
  on interval_row.code = 'interval-' || formatted.effort_seconds || 's'
on conflict (code) do update set
  format_type = excluded.format_type, series_id = excluded.series_id,
  repetitions_id = excluded.repetitions_id, rest_id = excluded.rest_id,
  interval_id = excluded.interval_id, label = excluded.label,
  description = excluded.description, source_status = excluded.source_status,
  updated_at = excluded.updated_at;

do $$
declare
  canonical_count bigint;
begin
  select count(*) into canonical_count
  from public.catalog_formats
  where source_status = 'seed base formats metier';
  if canonical_count <> 2219 then
    raise exception 'ACREA V3 expected 2219 canonical formats, found %', canonical_count;
  end if;
end $$;

create or replace function public.finalize_acrea_level_evaluation(p_attempt_id bigint)
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
    and attempt.protocol_version = 3
    and attempt.status = 'in_progress'
    and attempt.superseded_at is null
  for update;
  if v_user_id is null then
    raise exception 'Active V3 level evaluation attempt not found' using errcode = 'P0002';
  end if;

  create temporary table expected_evaluation_results (
    phase smallint,
    exercise_code text,
    catalog_exercise_code text,
    pillar text,
    target_series smallint,
    target_repetitions smallint,
    level_2_minimum integer,
    level_3_minimum integer
  ) on commit drop;
  insert into expected_evaluation_results values
    (1, 'renforcement-strict-pushups', 'renforcement-pompe-stricte', 'renforcement', 2, 8, 20, 50),
    (1, 'renforcement-bodyweight-squats', 'renforcement-squat-poids-du-corps', 'renforcement', 2, 12, 30, 80),
    (1, 'cardio-burpee-sans-pompe', 'cardio-burpee-sans-pompe', 'cardio', 2, 8, 20, 50),
    (1, 'cardio-mountain-climber-controle', 'cardio-mountain-climber-classique', 'cardio', 2, 16, 40, 90),
    (1, 'proprioception-leg-raise', 'proprioception-releve-de-jambes-au-sol', 'proprioception', 2, 8, 20, 50),
    (1, 'proprioception-planche-lean', 'proprioception-planche-lean', 'proprioception', 2, 6, 10, 30),
    (2, 'renforcement-strict-pushups', 'renforcement-pompe-stricte', 'renforcement', 3, 8, 20, 50),
    (2, 'renforcement-bodyweight-squats', 'renforcement-squat-poids-du-corps', 'renforcement', 3, 12, 30, 80),
    (2, 'cardio-burpee-sans-pompe', 'cardio-burpee-sans-pompe', 'cardio', 3, 8, 20, 50),
    (2, 'cardio-mountain-climber-controle', 'cardio-mountain-climber-classique', 'cardio', 3, 16, 40, 90),
    (2, 'proprioception-leg-raise', 'proprioception-releve-de-jambes-au-sol', 'proprioception', 3, 8, 20, 50),
    (2, 'proprioception-planche-lean', 'proprioception-planche-lean', 'proprioception', 3, 6, 10, 30),
    (3, 'renforcement-strict-pushups', 'renforcement-pompe-stricte', 'renforcement', 1, null, 20, 50),
    (3, 'renforcement-bodyweight-squats', 'renforcement-squat-poids-du-corps', 'renforcement', 1, null, 30, 80),
    (3, 'cardio-burpee-sans-pompe', 'cardio-burpee-sans-pompe', 'cardio', 1, null, 20, 50),
    (3, 'cardio-mountain-climber-controle', 'cardio-mountain-climber-classique', 'cardio', 1, null, 40, 90),
    (3, 'proprioception-leg-raise', 'proprioception-releve-de-jambes-au-sol', 'proprioception', 1, null, 20, 50),
    (3, 'proprioception-planche-lean', 'proprioception-planche-lean', 'proprioception', 1, null, 10, 30);

  create temporary table selected_evaluation_sessions on commit drop as
  select distinct on (evaluation_session.phase)
         evaluation_session.id, evaluation_session.phase
  from public.acrea_level_evaluation_sessions evaluation_session
  where evaluation_session.attempt_id = p_attempt_id
    and evaluation_session.status = 'passed'
  order by evaluation_session.phase, evaluation_session.run_number desc,
           evaluation_session.id desc;

  if (select count(*) from selected_evaluation_sessions) <> 3 then
    raise exception 'Three passed V3 evaluation sessions are required' using errcode = '23514';
  end if;

  if exists (
    select 1
    from selected_evaluation_sessions selected
    join public.acrea_level_evaluation_results result
      on result.evaluation_session_id = selected.id
    full join expected_evaluation_results expected
      on expected.phase = selected.phase
     and expected.exercise_code = result.exercise_code
    where result.id is null
       or expected.exercise_code is null
       or not result.technical_valid
       or result.appreciation_rating not between 1 and 5
       or result.pillar <> expected.pillar
       or result.target_series <> expected.target_series
       or result.target_repetitions is distinct from expected.target_repetitions
       or (result.prescription ->> 'series')::integer <> expected.target_series
       or (result.prescription ->> 'repetitions')::integer is distinct from expected.target_repetitions
       or (result.prescription ->> 'restSeconds')::integer <> case when selected.phase < 3 then 90 else 30 end
       or result.timer_plan_code <> 'format-reps-s' || lpad(expected.target_series::text, 2, '0') || '-' ||
          case when expected.target_repetitions is null then 'maximum'
               else 'r' || lpad(expected.target_repetitions::text, 2, '0') end ||
          '-rest' || case when selected.phase < 3 then '90' else '30' end || 's'
       or (selected.phase = 3 and result.maximum_repetitions is null)
       or (selected.phase < 3 and result.maximum_repetitions is not null)
  ) then
    raise exception 'V3 exercise set, prescriptions or feedback are invalid' using errcode = '23514';
  end if;

  select selected.id into v_phase_three_session_id
  from selected_evaluation_sessions selected where selected.phase = 3;

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
      on expected.phase = 3 and expected.exercise_code = result.exercise_code
    where result.evaluation_session_id = v_phase_three_session_id
    group by expected.pillar
  )
  select max(level) filter (where pillar = 'renforcement'),
         max(level) filter (where pillar = 'cardio'),
         max(level) filter (where pillar = 'proprioception')
  into v_renforcement, v_cardio, v_proprioception
  from levels where exercise_count = 2;

  if v_renforcement is null or v_cardio is null or v_proprioception is null then
    raise exception 'Two exact exercises per pillar are required' using errcode = '23514';
  end if;

  insert into public.acrea_level_evaluation_preferences (
    user_id, protocol_version, evaluation_exercise_code,
    catalog_exercise_code, appreciation_average, sample_count, evaluated_at
  )
  select v_user_id, 3, expected.exercise_code, expected.catalog_exercise_code,
         avg(result.appreciation_rating)::numeric(3, 2), count(*)::smallint,
         v_completed_at
  from selected_evaluation_sessions selected
  join public.acrea_level_evaluation_results result
    on result.evaluation_session_id = selected.id
  join expected_evaluation_results expected
    on expected.phase = selected.phase and expected.exercise_code = result.exercise_code
  group by expected.exercise_code, expected.catalog_exercise_code
  having count(*) = 3
  on conflict (user_id, protocol_version, catalog_exercise_code) do update set
    evaluation_exercise_code = excluded.evaluation_exercise_code,
    appreciation_average = excluded.appreciation_average,
    sample_count = excluded.sample_count,
    evaluated_at = excluded.evaluated_at;

  if (
    select count(*) from public.acrea_level_evaluation_preferences preference
    where preference.user_id = v_user_id and preference.protocol_version = 3
  ) <> 6 then
    raise exception 'Six V3 appreciation summaries are required' using errcode = '23514';
  end if;

  update public.acrea_profiles set
    renforcement_level = v_renforcement,
    cardio_level = v_cardio,
    proprioception_level = v_proprioception,
    level_test_status = 'completed',
    level_test_version = 3,
    level_test_completed_at = v_completed_at,
    updated_at = v_completed_at
  where user_id = v_user_id;

  update public.acrea_level_evaluation_attempts set
    status = 'completed', completed_at = v_completed_at
  where id = p_attempt_id;

  return query select v_renforcement, v_cardio, v_proprioception, v_completed_at;
end;
$$;

revoke all on function public.finalize_acrea_level_evaluation(bigint) from public, anon;
grant execute on function public.finalize_acrea_level_evaluation(bigint) to authenticated;

commit;
