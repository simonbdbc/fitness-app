begin;

set local lock_timeout = '10s';
set local statement_timeout = '5min';

create temporary table auto_initialized_acrea_profiles
on commit drop
as
select profile.user_id
from public.acrea_profiles profile
where profile.objective = 'Développer le renforcement au poids du corps sans se blesser.'
  and profile.objective_code = 'complete'
  and profile.equipment_mode = 'aucun'
  and profile.weekly_frequency = 3
  and profile.session_minutes_min = 30
  and profile.session_minutes_max = 45
  and profile.weekly_novelty_percent = 50
  and profile.level_test_status = 'required'
  and profile.level_test_version = 0
  and profile.renforcement_level = 2
  and profile.cardio_level = 2
  and profile.proprioception_level = 1
  and profile.preferred_weekdays = array[1, 3, 5]::smallint[]
  and not exists (
    select 1 from public.programs where programs.profile_id = profile.user_id
  )
  and not exists (
    select 1
    from public.acrea_level_evaluation_attempts attempt
    where attempt.user_id = profile.user_id
  );

alter table public.acrea_profiles
  alter column objective drop not null,
  alter column objective_code drop not null,
  alter column equipment_mode drop not null,
  alter column weekly_frequency drop not null,
  alter column average_session_minutes drop not null,
  alter column session_minutes_min drop not null,
  alter column session_minutes_max drop not null,
  alter column weekly_novelty_percent drop default,
  alter column weekly_novelty_percent drop not null,
  alter column renforcement_level drop not null,
  alter column cardio_level drop not null,
  alter column proprioception_level drop not null;

alter table public.acrea_profiles
  drop constraint if exists acrea_profiles_level_test_status_check;
alter table public.acrea_profiles
  add constraint acrea_profiles_level_test_status_check check (
    level_test_status in ('required', 'completed', 'retest')
    and level_test_version >= 0
    and (
      level_test_status <> 'completed'
      or (
        level_test_version > 0
        and level_test_completed_at is not null
        and renforcement_level is not null
        and cardio_level is not null
        and proprioception_level is not null
      )
    )
  );

update public.acrea_profiles profile
set objective = null,
    objective_code = null,
    equipment_mode = null,
    weekly_frequency = null,
    average_session_minutes = null,
    session_minutes_min = null,
    session_minutes_max = null,
    weekly_novelty_percent = null,
    renforcement_level = null,
    cardio_level = null,
    proprioception_level = null,
    preferred_weekdays = '{}',
    updated_at = now()
where profile.user_id in (
  select user_id from auto_initialized_acrea_profiles
);

delete from public.acrea_profile_restrictions restriction
where restriction.user_id in (
    select user_id from auto_initialized_acrea_profiles
  )
  and restriction.restriction_type = 'impactLimit'
  and restriction.payload ->> 'maximumImpact' = 'faible';

comment on table public.acrea_profiles is
  'Profil ACREA. Les préférences restent nulles tant que l utilisateur ne les a pas choisies; les niveaux restent nuls jusqu à une évaluation validée.';

commit;
