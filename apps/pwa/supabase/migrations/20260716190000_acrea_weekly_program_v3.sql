begin;

set local lock_timeout = '10s';
set local statement_timeout = '5min';

do $$
begin
  if to_regclass('public.acrea_profiles') is null
     or to_regclass('public.programs') is null
     or to_regclass('public.session_feedback') is null then
    raise exception 'ACREA v3 requires the weekly runtime v2 schema';
  end if;
end $$;

alter table public.catalog_session_templates
  add column if not exists phase text not null default 'main';
alter table public.catalog_session_templates
  drop constraint if exists catalog_session_templates_phase_check;
alter table public.catalog_session_templates
  add constraint catalog_session_templates_phase_check
  check (phase in ('warmup', 'main', 'cooldown'));

update public.catalog_session_templates set phase = 'main';
update public.catalog_session_templates template
set phase = 'warmup'
from public.catalog_exercises exercise
where exercise.id = template.exercise_id
  and exercise.code in (
    'proprioception-mobilite-epaules',
    'proprioception-mobilite-hanches',
    'proprioception-mobilite-poignets'
  );
update public.catalog_session_templates template
set phase = 'cooldown'
from public.catalog_exercises exercise
where exercise.id = template.exercise_id
  and exercise.code in (
    'proprioception-mobilite-poignets-epaules-hanches',
    'renforcement-mobilite-colonne-douce'
  );

alter table public.acrea_profiles
  add column if not exists session_minutes_min smallint,
  add column if not exists session_minutes_max smallint,
  add column if not exists weekly_novelty_percent smallint not null default 50,
  add column if not exists level_test_status text not null default 'required',
  add column if not exists level_test_version integer not null default 0,
  add column if not exists level_test_completed_at timestamptz;

update public.acrea_profiles
set session_minutes_min = greatest(20, floor((average_session_minutes - 5) / 5.0)::integer * 5),
    session_minutes_max = least(
      180,
      greatest(
        greatest(20, floor((average_session_minutes - 5) / 5.0)::integer * 5) + 5,
        ceil((average_session_minutes + 10) / 5.0)::integer * 5
      )
    )
where session_minutes_min is null or session_minutes_max is null;

alter table public.acrea_profiles
  alter column session_minutes_min set not null,
  alter column session_minutes_max set not null;
alter table public.acrea_profiles drop constraint if exists acrea_profiles_session_minutes_check;
alter table public.acrea_profiles add constraint acrea_profiles_session_minutes_check check (
  session_minutes_min between 20 and 175
  and session_minutes_max between 25 and 180
  and session_minutes_min % 5 = 0
  and session_minutes_max % 5 = 0
  and session_minutes_max >= session_minutes_min + 5
);
alter table public.acrea_profiles drop constraint if exists acrea_profiles_weekly_novelty_check;
alter table public.acrea_profiles add constraint acrea_profiles_weekly_novelty_check check (
  weekly_novelty_percent between 0 and 100 and weekly_novelty_percent % 10 = 0
);
alter table public.acrea_profiles drop constraint if exists acrea_profiles_level_test_status_check;
alter table public.acrea_profiles add constraint acrea_profiles_level_test_status_check check (
  level_test_status in ('required', 'completed', 'retest')
  and level_test_version >= 0
  and (level_test_status <> 'completed' or (level_test_version > 0 and level_test_completed_at is not null))
);

-- Programs are reproducible snapshots. V2 is retained only through its feedback history.
update public.session_feedback
set program_id = null, training_id = null, session_id = null
where program_id in (select id from public.programs where schema_version <> 3);
delete from public.programs where schema_version <> 3;
alter table public.programs drop constraint if exists programs_schema_version_check;
alter table public.programs alter column schema_version set default 3;
alter table public.programs add constraint programs_schema_version_check check (schema_version = 3);

alter table public.seances
  add column if not exists phase text not null default 'main';
alter table public.seances alter column pillar drop not null;
alter table public.seances drop constraint if exists seances_phase_check;
alter table public.seances drop constraint if exists seances_phase_pillar_check;
alter table public.seances add constraint seances_phase_check
  check (phase in ('warmup', 'main', 'cooldown'));
alter table public.seances add constraint seances_phase_pillar_check check (
  (phase = 'main' and pillar in ('renforcement', 'cardio', 'proprioception'))
  or (phase in ('warmup', 'cooldown') and pillar is null)
);

alter table public.sessions
  add column if not exists phase text not null default 'main',
  add column if not exists prescription jsonb not null default '{}'::jsonb;
alter table public.sessions drop constraint if exists sessions_phase_check;
alter table public.sessions drop constraint if exists sessions_prescription_check;
alter table public.sessions add constraint sessions_phase_check
  check (phase in ('warmup', 'main', 'cooldown'));
alter table public.sessions add constraint sessions_prescription_check check (
  prescription ?& array[
    'kind', 'series', 'repetitions', 'effortSeconds', 'restSeconds',
    'estimatedDurationSeconds', 'adaptable'
  ]
);

alter table public.session_feedback
  add column if not exists appreciation_rating smallint,
  add column if not exists session_phase text not null default 'main',
  add column if not exists executed_prescription jsonb;
alter table public.session_feedback drop constraint if exists session_feedback_appreciation_check;
alter table public.session_feedback drop constraint if exists session_feedback_session_phase_check;
alter table public.session_feedback add constraint session_feedback_appreciation_check
  check (appreciation_rating is null or appreciation_rating between 1 and 5);
alter table public.session_feedback add constraint session_feedback_session_phase_check
  check (session_phase in ('warmup', 'main', 'cooldown'));

create or replace function public.require_main_session_appreciation()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if new.session_phase = 'main' and new.appreciation_rating is null then
    raise exception 'main session appreciation is required' using errcode = '23514';
  end if;
  return new;
end;
$$;
drop trigger if exists session_feedback_require_appreciation on public.session_feedback;
create trigger session_feedback_require_appreciation
before insert or update of appreciation_rating, session_phase on public.session_feedback
for each row execute function public.require_main_session_appreciation();

create table if not exists public.acrea_level_test_attempts (
  id bigint generated by default as identity primary key,
  user_id uuid not null references public.acrea_profiles(user_id) on delete cascade,
  protocol_version integer not null check (protocol_version > 0),
  attempt_kind text not null check (attempt_kind in ('initial', 'retest')),
  status text not null default 'in_progress' check (status in ('in_progress', 'completed')),
  started_at timestamptz not null default now(),
  completed_at timestamptz
);

create table if not exists public.acrea_level_test_stage_results (
  id bigint generated by default as identity primary key,
  attempt_id bigint not null references public.acrea_level_test_attempts(id) on delete cascade,
  exercise_code text not null,
  pillar text not null check (pillar in ('renforcement', 'cardio', 'proprioception')),
  exercise_order smallint not null check (exercise_order between 1 and 6),
  stage smallint not null check (stage between 1 and 3),
  attempt_number integer not null check (attempt_number > 0),
  target_series smallint,
  target_repetitions smallint,
  maximum_repetitions integer,
  technical_valid boolean not null,
  attempted_at timestamptz not null default now(),
  unique (attempt_id, exercise_code, stage, attempt_number)
);

create table if not exists public.acrea_exercise_progressions (
  user_id uuid not null references public.acrea_profiles(user_id) on delete cascade,
  exercise_id bigint not null references public.catalog_exercises(id) on delete cascade,
  prescription jsonb not null,
  reached_maximum boolean not null default false,
  pending_direction text check (pending_direction in ('easier', 'harder')),
  last_progression_at timestamptz,
  updated_at timestamptz not null default now(),
  primary key (user_id, exercise_id)
);

create table if not exists public.acrea_profile_excluded_exercises (
  user_id uuid not null references public.acrea_profiles(user_id) on delete cascade,
  exercise_id bigint not null references public.catalog_exercises(id) on delete cascade,
  reason text not null check (reason in ('appreciation', 'manual')),
  excluded_at timestamptz not null default now(),
  primary key (user_id, exercise_id)
);

create index if not exists acrea_level_test_attempts_user_idx
  on public.acrea_level_test_attempts (user_id, status, started_at desc);
create index if not exists acrea_level_test_results_attempt_idx
  on public.acrea_level_test_stage_results (attempt_id, exercise_order, stage, attempt_number desc);
create index if not exists acrea_exercise_progressions_user_idx
  on public.acrea_exercise_progressions (user_id, updated_at desc);
create index if not exists session_feedback_user_exercise_idx
  on public.session_feedback (profile_id, exercise_id, performed_at desc);

alter table public.acrea_level_test_attempts enable row level security;
alter table public.acrea_level_test_stage_results enable row level security;
alter table public.acrea_exercise_progressions enable row level security;
alter table public.acrea_profile_excluded_exercises enable row level security;

grant select, insert, update, delete on public.acrea_level_test_attempts to authenticated;
grant select, insert, update, delete on public.acrea_level_test_stage_results to authenticated;
grant select, insert, update, delete on public.acrea_exercise_progressions to authenticated;
grant select, insert, update, delete on public.acrea_profile_excluded_exercises to authenticated;
grant usage, select on all sequences in schema public to authenticated;

drop policy if exists "Users own ACREA level test attempts" on public.acrea_level_test_attempts;
create policy "Users own ACREA level test attempts" on public.acrea_level_test_attempts
for all to authenticated
using (user_id = (select auth.uid()) or (select private.is_admin()))
with check (user_id = (select auth.uid()) or (select private.is_admin()));

drop policy if exists "Users own ACREA level test results" on public.acrea_level_test_stage_results;
create policy "Users own ACREA level test results" on public.acrea_level_test_stage_results
for all to authenticated
using (exists (
  select 1 from public.acrea_level_test_attempts attempt
  where attempt.id = acrea_level_test_stage_results.attempt_id
    and (attempt.user_id = (select auth.uid()) or (select private.is_admin()))
))
with check (exists (
  select 1 from public.acrea_level_test_attempts attempt
  where attempt.id = acrea_level_test_stage_results.attempt_id
    and (attempt.user_id = (select auth.uid()) or (select private.is_admin()))
));

drop policy if exists "Users own ACREA exercise progressions" on public.acrea_exercise_progressions;
create policy "Users own ACREA exercise progressions" on public.acrea_exercise_progressions
for all to authenticated
using (user_id = (select auth.uid()) or (select private.is_admin()))
with check (user_id = (select auth.uid()) or (select private.is_admin()));

drop policy if exists "Users own ACREA excluded exercises" on public.acrea_profile_excluded_exercises;
create policy "Users own ACREA excluded exercises" on public.acrea_profile_excluded_exercises
for all to authenticated
using (user_id = (select auth.uid()) or (select private.is_admin()))
with check (user_id = (select auth.uid()) or (select private.is_admin()));

drop trigger if exists acrea_exercise_progressions_set_updated_at on public.acrea_exercise_progressions;
create trigger acrea_exercise_progressions_set_updated_at
before update on public.acrea_exercise_progressions
for each row execute function public.set_updated_at();

create or replace function public.finalize_acrea_level_test(p_attempt_id bigint)
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
  v_protocol_version integer;
  v_completed_at timestamptz := now();
  v_renforcement smallint;
  v_cardio smallint;
  v_proprioception smallint;
begin
  select attempt.user_id, attempt.protocol_version
  into v_user_id, v_protocol_version
  from public.acrea_level_test_attempts attempt
  where attempt.id = p_attempt_id
    and attempt.user_id = (select auth.uid())
  for update;
  if v_user_id is null then
    raise exception 'Level test attempt not found' using errcode = 'P0002';
  end if;

  if (
    select count(*)
    from (
      select result.exercise_code
      from public.acrea_level_test_stage_results result
      where result.attempt_id = p_attempt_id and result.technical_valid
      group by result.exercise_code
      having count(distinct result.stage) = 3
         and bool_or(result.stage = 3 and result.maximum_repetitions is not null)
    ) completed_exercise
  ) <> 6 then
    raise exception 'Six completed exercises are required' using errcode = '23514';
  end if;

  with maxima as (
    select distinct on (result.exercise_code)
      result.exercise_code,
      result.pillar,
      result.maximum_repetitions
    from public.acrea_level_test_stage_results result
    where result.attempt_id = p_attempt_id
      and result.stage = 3
      and result.technical_valid
      and result.maximum_repetitions is not null
    order by result.exercise_code, result.attempt_number desc
  ), levels as (
    select pillar,
           min(case
             when maximum_repetitions <= 5 then 1
             when maximum_repetitions <= 10 then 2
             else 3
           end)::smallint as level,
           count(*) as exercise_count
    from maxima
    group by pillar
  )
  select
    max(level) filter (where pillar = 'renforcement'),
    max(level) filter (where pillar = 'cardio'),
    max(level) filter (where pillar = 'proprioception')
  into v_renforcement, v_cardio, v_proprioception
  from levels
  where exercise_count = 2;

  if v_renforcement is null or v_cardio is null or v_proprioception is null then
    raise exception 'Two exercises per pillar are required' using errcode = '23514';
  end if;

  update public.acrea_profiles set
    renforcement_level = v_renforcement,
    cardio_level = v_cardio,
    proprioception_level = v_proprioception,
    level_test_status = 'completed',
    level_test_version = v_protocol_version,
    level_test_completed_at = v_completed_at,
    updated_at = v_completed_at
  where user_id = v_user_id;

  update public.acrea_level_test_attempts set
    status = 'completed', completed_at = v_completed_at
  where id = p_attempt_id;

  return query select v_renforcement, v_cardio, v_proprioception, v_completed_at;
end;
$$;

revoke all on function public.finalize_acrea_level_test(bigint) from public, anon;
grant execute on function public.finalize_acrea_level_test(bigint) to authenticated;

drop function if exists public.admin_upsert_catalog_session_template(
  bigint, text, text, text, bigint, smallint[], boolean, text, timestamptz
);
create or replace function public.admin_upsert_catalog_session_template(
  p_id bigint,
  p_code text,
  p_title text,
  p_description text,
  p_exercise_id bigint,
  p_phase text,
  p_levels smallint[],
  p_is_active boolean,
  p_source_status text,
  p_updated_at timestamptz default now()
)
returns bigint
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_id bigint;
  v_levels smallint[];
begin
  if not (select private.is_admin()) then
    raise exception 'Admin role required' using errcode = '42501';
  end if;
  if p_phase not in ('warmup', 'main', 'cooldown') then
    raise exception 'Invalid session phase' using errcode = '23514';
  end if;
  select array_agg(distinct level order by level) into v_levels
  from unnest(coalesce(p_levels, array[]::smallint[])) level
  where level between 1 and 10;
  if coalesce(cardinality(v_levels), 0) = 0 then
    raise exception 'At least one level is required' using errcode = '23514';
  end if;

  if p_id is null or p_id <= 0 then
    insert into public.catalog_session_templates (
      code, title, description, exercise_id, phase, is_active, source_status, updated_at
    ) values (
      p_code, p_title, coalesce(p_description, ''), p_exercise_id,
      p_phase, p_is_active, p_source_status, p_updated_at
    ) returning id into v_id;
  else
    update public.catalog_session_templates set
      code = p_code, title = p_title, description = coalesce(p_description, ''),
      exercise_id = p_exercise_id, phase = p_phase, is_active = p_is_active,
      source_status = p_source_status, updated_at = p_updated_at
    where id = p_id returning id into v_id;
    if v_id is null then
      raise exception 'Session template % not found', p_id using errcode = 'P0002';
    end if;
  end if;

  delete from public.catalog_session_template_levels where session_template_id = v_id;
  insert into public.catalog_session_template_levels (session_template_id, level, updated_at)
  select v_id, level, p_updated_at from unnest(v_levels) level;
  return v_id;
end;
$$;

revoke all on function public.admin_upsert_catalog_session_template(
  bigint, text, text, text, bigint, text, smallint[], boolean, text, timestamptz
) from public, anon;
grant execute on function public.admin_upsert_catalog_session_template(
  bigint, text, text, text, bigint, text, smallint[], boolean, text, timestamptz
) to authenticated;

notify pgrst, 'reload schema';

commit;
