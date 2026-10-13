begin;

alter table public.programs
  add column if not exists profile_fingerprint text,
  add column if not exists profile_effective_from date;

alter table public.trainings
  add column if not exists scheduled_date date,
  add column if not exists generation_profile_fingerprint text;

update public.trainings as training
set scheduled_date =
  to_date(
    program.iso_week_year::text || lpad(program.iso_week_number::text, 2, '0'),
    'IYYYIW'
  ) +
  case training.day_label
    when 'Lundi' then 0 when 'Mardi' then 1 when 'Mercredi' then 2
    when 'Jeudi' then 3 when 'Vendredi' then 4 when 'Samedi' then 5
    when 'Dimanche' then 6
  end
from public.programs as program
where program.id = training.program_id
  and training.scheduled_date is null
  and training.day_label in (
    'Lundi', 'Mardi', 'Mercredi', 'Jeudi',
    'Vendredi', 'Samedi', 'Dimanche'
  );

do $$
begin
  if exists (select 1 from public.trainings where scheduled_date is null) then
    raise exception 'partial regeneration migration: unresolved training dates';
  end if;
end
$$;

alter table public.trainings alter column scheduled_date set not null;

alter table public.programs
  add constraint programs_profile_fingerprint_check
  check (profile_fingerprint is null or profile_fingerprint ~ '^[0-9a-f]{64}$')
  not valid;
alter table public.programs validate constraint programs_profile_fingerprint_check;

alter table public.trainings
  add constraint trainings_generation_fingerprint_check
  check (
    generation_profile_fingerprint is null
    or generation_profile_fingerprint ~ '^[0-9a-f]{64}$'
  ) not valid;
alter table public.trainings validate constraint trainings_generation_fingerprint_check;

create index if not exists trainings_program_scheduled_date_idx
  on public.trainings (program_id, scheduled_date, sort_order);

commit;
