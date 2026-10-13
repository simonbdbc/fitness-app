alter table public.catalog_exercises
  add column if not exists is_active boolean,
  add column if not exists review_status text;

update public.catalog_exercises
set is_active = coalesce(is_active, true),
    review_status = coalesce(nullif(review_status, ''), 'a_verifier');

alter table public.catalog_exercises
  alter column is_active set default true,
  alter column is_active set not null,
  alter column review_status set default 'a_verifier',
  alter column review_status set not null;

alter table public.catalog_exercises
  drop constraint if exists catalog_exercises_review_status_check;

alter table public.catalog_exercises
  add constraint catalog_exercises_review_status_check
  check (review_status in ('a_verifier', 'valide', 'a_revoir'));

create index if not exists catalog_exercises_active_review_idx
  on public.catalog_exercises (is_active, review_status, pillar_id, level_min, name);

drop policy if exists "Authenticated users can read catalog exercises"
on public.catalog_exercises;

create policy "Authenticated users can read catalog exercises"
on public.catalog_exercises
for select
to authenticated
using (
  is_active
  or (select private.is_admin())
);

drop policy if exists "Authenticated users can read catalog exercise families"
on public.catalog_exercise_muscle_groups;

create policy "Authenticated users can read catalog exercise families"
on public.catalog_exercise_muscle_groups
for select
to authenticated
using (
  exists (
    select 1
    from public.catalog_exercises exercise
    where exercise.id = catalog_exercise_muscle_groups.exercise_id
      and (
        exercise.is_active
        or (select private.is_admin())
      )
  )
);

drop policy if exists "Admins can mutate catalog pillars"
on public.catalog_pillars;

drop policy if exists "Admins can insert catalog pillars"
on public.catalog_pillars;

create policy "Admins can insert catalog pillars"
on public.catalog_pillars
for insert
to authenticated
with check ((select private.is_admin()));

drop policy if exists "Admins can update catalog pillars"
on public.catalog_pillars;

create policy "Admins can update catalog pillars"
on public.catalog_pillars
for update
to authenticated
using ((select private.is_admin()))
with check ((select private.is_admin()));

drop policy if exists "Admins can delete catalog pillars"
on public.catalog_pillars;

create policy "Admins can delete catalog pillars"
on public.catalog_pillars
for delete
to authenticated
using ((select private.is_admin()));

drop policy if exists "Admins can mutate catalog families"
on public.catalog_families;

drop policy if exists "Admins can insert catalog families"
on public.catalog_families;

create policy "Admins can insert catalog families"
on public.catalog_families
for insert
to authenticated
with check ((select private.is_admin()));

drop policy if exists "Admins can update catalog families"
on public.catalog_families;

create policy "Admins can update catalog families"
on public.catalog_families
for update
to authenticated
using ((select private.is_admin()))
with check ((select private.is_admin()));

drop policy if exists "Admins can delete catalog families"
on public.catalog_families;

create policy "Admins can delete catalog families"
on public.catalog_families
for delete
to authenticated
using ((select private.is_admin()));

drop policy if exists "Admins can mutate catalog exercises"
on public.catalog_exercises;

drop policy if exists "Admins can insert catalog exercises"
on public.catalog_exercises;

create policy "Admins can insert catalog exercises"
on public.catalog_exercises
for insert
to authenticated
with check ((select private.is_admin()));

drop policy if exists "Admins can update catalog exercises"
on public.catalog_exercises;

create policy "Admins can update catalog exercises"
on public.catalog_exercises
for update
to authenticated
using ((select private.is_admin()))
with check ((select private.is_admin()));

drop policy if exists "Admins can delete catalog exercises"
on public.catalog_exercises;

create policy "Admins can delete catalog exercises"
on public.catalog_exercises
for delete
to authenticated
using ((select private.is_admin()));

drop policy if exists "Admins can mutate catalog exercise families"
on public.catalog_exercise_muscle_groups;

drop policy if exists "Admins can insert catalog exercise families"
on public.catalog_exercise_muscle_groups;

create policy "Admins can insert catalog exercise families"
on public.catalog_exercise_muscle_groups
for insert
to authenticated
with check ((select private.is_admin()));

drop policy if exists "Admins can update catalog exercise families"
on public.catalog_exercise_muscle_groups;

create policy "Admins can update catalog exercise families"
on public.catalog_exercise_muscle_groups
for update
to authenticated
using ((select private.is_admin()))
with check ((select private.is_admin()));

drop policy if exists "Admins can delete catalog exercise families"
on public.catalog_exercise_muscle_groups;

create policy "Admins can delete catalog exercise families"
on public.catalog_exercise_muscle_groups
for delete
to authenticated
using ((select private.is_admin()));
