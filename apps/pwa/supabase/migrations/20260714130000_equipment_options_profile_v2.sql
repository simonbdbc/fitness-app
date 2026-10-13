begin;

set local lock_timeout = '10s';
set local statement_timeout = '5min';

create temporary table weekly_equipment_requirements (
  legacy_code text primary key,
  options jsonb not null check (jsonb_typeof(options) = 'array')
) on commit drop;

insert into weekly_equipment_requirements (legacy_code, options) values
  ('aucun', '[[]]'::jsonb), ('course', '[[]]'::jsonb),
  ('aucun-parallettes', '[[],["parallettes"]]'::jsonb),
  ('aucun-support', '[[],["chaise"],["table"],["banc"],["box"]]'::jsonb),
  ('anneaux', '[["anneaux"]]'::jsonb), ('barre', '[["barre-traction"]]'::jsonb),
  ('barre-anneaux', '[["barre-traction"],["anneaux"]]'::jsonb),
  ('barre-basse-anneaux', '[["barre-basse"],["anneaux"]]'::jsonb),
  ('barre-elastique', '[["barre-traction","elastique"]]'::jsonb),
  ('barre-verticale', '[["barre-verticale"]]'::jsonb),
  ('barres-support', '[["barres-paralleles"],["parallettes"]]'::jsonb),
  ('barres-supports', '[["barres-paralleles"],["parallettes"]]'::jsonb),
  ('box-step', '[["box"],["step"]]'::jsonb),
  ('chaise', '[["chaise"]]'::jsonb), ('chaise-stable', '[["chaise"]]'::jsonb),
  ('corde', '[["corde-a-sauter"]]'::jsonb),
  ('kettlebell', '[["kettlebell"]]'::jsonb),
  ('marche-step', '[["marche"],["step"]]'::jsonb),
  ('mur', '[["mur"]]'::jsonb), ('mur-aucun', '[[],["mur"]]'::jsonb),
  ('mur-optionnel', '[[],["mur"]]'::jsonb),
  ('mur-support', '[["mur"],["chaise"],["table"],["banc"]]'::jsonb),
  ('parallettes-support', '[["parallettes"],["barres-paralleles"]]'::jsonb),
  ('rameur', '[["rameur"]]'::jsonb),
  ('serviette-porte', '[["serviette","porte"]]'::jsonb),
  ('serviette-support', '[["serviette","porte"],["serviette","barre-traction"]]'::jsonb),
  ('support', '[["chaise"],["table"],["plan-de-travail"],["banc"],["box"]]'::jsonb),
  ('support-stable', '[["chaise"],["table"],["plan-de-travail"],["banc"],["box"]]'::jsonb),
  ('support-optionnel', '[[],["chaise"],["table"],["banc"],["box"]]'::jsonb),
  ('support-barre-table', '[["barre-basse","banc"],["anneaux","banc"],["table","chaise"]]'::jsonb),
  ('table-barre-basse', '[["table"],["barre-basse"]]'::jsonb),
  ('table-stable', '[["table"]]'::jsonb),
  ('tapis-de-course', '[["tapis-de-course"]]'::jsonb),
  ('tapis-optionnel', '[[],["tapis-de-sol"]]'::jsonb),
  ('velo', '[["velo"]]'::jsonb);

do $$
declare
  exercise_count bigint;
  mapping_count bigint;
  unmapped_codes text;
  duplicate_labels text;
begin
  select count(*) into mapping_count from weekly_equipment_requirements;
  if mapping_count <> 35 then
    raise exception 'equipment v2 migration: expected 35 historical mappings, found %', mapping_count;
  end if;

  select count(*) into exercise_count from public.catalog_exercises;
  if exercise_count <> 236 then
    raise exception 'equipment v2 migration: expected 236 exercises, found %', exercise_count;
  end if;

  select string_agg(code, ', ' order by code) into unmapped_codes
  from (
    select distinct equipment.code
    from public.catalog_exercises exercise
    join public.catalog_equipment equipment on equipment.id = exercise.equipment_id
    left join weekly_equipment_requirements requirement
      on requirement.legacy_code = equipment.code
    where requirement.legacy_code is null
  ) missing;
  if unmapped_codes is not null then
    raise exception 'equipment v2 migration: unmapped legacy equipment codes: %', unmapped_codes;
  end if;

  select string_agg(normalized_label, ', ' order by normalized_label)
  into duplicate_labels
  from (
    select lower(trim(label)) as normalized_label
    from public.catalog_equipment
    group by lower(trim(label))
    having count(*) > 1
  ) duplicates;
  if duplicate_labels is not null then
    raise exception 'equipment v2 migration: duplicate normalized labels: %', duplicate_labels;
  end if;
end $$;

alter table public.catalog_equipment
  add column if not exists category text;

insert into public.catalog_equipment (code, label, category) values
  ('mur', 'Mur', 'maison'), ('chaise', 'Chaise', 'maison'),
  ('table', 'Table', 'maison'), ('plan-de-travail', 'Plan de travail', 'maison'),
  ('canape', 'Canapé', 'maison'), ('marche', 'Marche', 'maison'),
  ('porte', 'Porte', 'maison'), ('serviette', 'Serviette', 'maison'),
  ('anneaux', 'Anneaux', 'sport'), ('barre-traction', 'Barre de traction', 'sport'),
  ('barre-basse', 'Barre basse', 'sport'), ('barre-verticale', 'Barre verticale', 'sport'),
  ('barres-paralleles', 'Barres parallèles', 'sport'), ('parallettes', 'Parallettes', 'sport'),
  ('banc', 'Banc', 'sport'), ('box', 'Box', 'sport'), ('step', 'Step', 'sport'),
  ('elastique', 'Élastique', 'sport'), ('corde-a-sauter', 'Corde à sauter', 'sport'),
  ('kettlebell', 'Kettlebell', 'sport'), ('rameur', 'Rameur', 'sport'),
  ('tapis-de-course', 'Tapis de course', 'sport'), ('tapis-de-sol', 'Tapis de sol', 'sport'),
  ('velo', 'Vélo', 'sport')
on conflict (code) do update set label = excluded.label, category = excluded.category;

alter table public.catalog_exercises alter column equipment_id drop not null;

create table if not exists public.catalog_exercise_equipment_options (
  id bigint generated by default as identity primary key,
  exercise_id bigint not null references public.catalog_exercises(id) on delete cascade,
  option_index integer not null check (option_index >= 0),
  kind text not null check (kind in ('bodyweight', 'equipment')),
  unique (exercise_id, option_index)
);

create table if not exists public.catalog_exercise_equipment_option_items (
  option_id bigint not null references public.catalog_exercise_equipment_options(id) on delete cascade,
  equipment_id bigint not null references public.catalog_equipment(id) on delete restrict,
  primary key (option_id, equipment_id)
);

delete from public.catalog_exercise_equipment_option_items;
delete from public.catalog_exercise_equipment_options;

with expanded as (
  select exercise.id as exercise_id, option_value,
         option_index::integer - 1 as option_index
  from public.catalog_exercises exercise
  join public.catalog_equipment legacy on legacy.id = exercise.equipment_id
  join weekly_equipment_requirements requirement on requirement.legacy_code = legacy.code
  cross join lateral jsonb_array_elements(requirement.options)
    with ordinality as option_row(option_value, option_index)
)
insert into public.catalog_exercise_equipment_options (exercise_id, option_index, kind)
select exercise_id, option_index,
       case when jsonb_array_length(option_value) = 0 then 'bodyweight' else 'equipment' end
from expanded;

with expanded as (
  select exercise.id as exercise_id, option_value, option_index::integer - 1 as option_index
  from public.catalog_exercises exercise
  join public.catalog_equipment legacy on legacy.id = exercise.equipment_id
  join weekly_equipment_requirements requirement on requirement.legacy_code = legacy.code
  cross join lateral jsonb_array_elements(requirement.options) with ordinality as option_row(option_value, option_index)
)
insert into public.catalog_exercise_equipment_option_items (option_id, equipment_id)
select option_row.id, equipment.id
from expanded
join public.catalog_exercise_equipment_options option_row
  on option_row.exercise_id = expanded.exercise_id and option_row.option_index = expanded.option_index
cross join lateral jsonb_array_elements_text(expanded.option_value) as required(code)
join public.catalog_equipment equipment on equipment.code = required.code;

update public.catalog_exercises exercise set equipment_id = (
  select items.equipment_id
  from public.catalog_exercise_equipment_options options
  join public.catalog_exercise_equipment_option_items items on items.option_id = options.id
  where options.exercise_id = exercise.id
  order by options.option_index, items.equipment_id limit 1
);

create table if not exists private.acrea_profile_equipment_migration_archive (
  user_id uuid not null,
  equipment_code text not null,
  archived_at timestamptz not null default now(),
  primary key (user_id, equipment_code)
);
alter table public.acrea_profile_equipment
  add column equipment_id bigint references public.catalog_equipment(id) on delete restrict;
update public.acrea_profile_equipment inventory
set equipment_id = equipment.id
from public.catalog_equipment equipment
where equipment.code = case inventory.equipment_code
  when 'barre' then 'barre-traction'
  when 'corde' then 'corde-a-sauter'
  when 'chaise-stable' then 'chaise'
  when 'table-stable' then 'table'
  else inventory.equipment_code
end;
insert into private.acrea_profile_equipment_migration_archive (user_id, equipment_code)
select user_id, equipment_code
from public.acrea_profile_equipment
where equipment_id is null
on conflict do nothing;
delete from public.acrea_profile_equipment where equipment_id is null;
alter table public.acrea_profile_equipment
  drop constraint if exists acrea_profile_equipment_pkey;
alter table public.acrea_profile_equipment alter column equipment_id set not null;
alter table public.acrea_profile_equipment drop column equipment_code;
alter table public.acrea_profile_equipment
  add primary key (user_id, equipment_id);
create index if not exists acrea_profile_equipment_equipment_idx
  on public.acrea_profile_equipment (equipment_id);

delete from public.catalog_equipment
where code not in (
  'mur', 'chaise', 'table', 'plan-de-travail', 'canape', 'marche', 'porte',
  'serviette', 'anneaux', 'barre-traction', 'barre-basse', 'barre-verticale',
  'barres-paralleles', 'parallettes', 'banc', 'box', 'step', 'elastique',
  'corde-a-sauter', 'kettlebell', 'rameur', 'tapis-de-course',
  'tapis-de-sol', 'velo'
);

update public.acrea_profiles set objective_code = case objective_code
  when 'strength' then 'renforcement' when 'balance_mobility' then 'proprioception'
  when 'general_fitness' then 'complete' else objective_code end;
update public.acrea_profiles set equipment_mode = case
  when equipment_mode = 'strict' and not exists (
    select 1 from public.acrea_profile_equipment e where e.user_id = acrea_profiles.user_id
  ) then 'aucun' else 'mixte' end;
alter table public.acrea_profiles drop constraint if exists acrea_profiles_objective_code_check;
alter table public.acrea_profiles drop constraint if exists acrea_profiles_equipment_mode_check;
alter table public.acrea_profiles add constraint acrea_profiles_objective_code_check
  check (objective_code in ('complete', 'renforcement', 'cardio', 'proprioception'));
alter table public.acrea_profiles add constraint acrea_profiles_equipment_mode_check
  check (equipment_mode in ('aucun', 'mixte'));

alter table public.catalog_equipment alter column category set not null;
alter table public.catalog_equipment
  drop constraint if exists catalog_equipment_category_check;
alter table public.catalog_equipment add constraint catalog_equipment_category_check
  check (category in ('maison', 'sport'));
create unique index if not exists catalog_equipment_label_unique
  on public.catalog_equipment (lower(trim(label)));
create index if not exists catalog_exercise_equipment_options_exercise_idx
  on public.catalog_exercise_equipment_options (exercise_id);
create index if not exists catalog_exercise_equipment_option_items_equipment_idx
  on public.catalog_exercise_equipment_option_items (equipment_id);

alter table public.catalog_exercise_equipment_options enable row level security;
alter table public.catalog_exercise_equipment_option_items enable row level security;
grant select on public.catalog_exercise_equipment_options, public.catalog_exercise_equipment_option_items to anon, authenticated;
grant insert, update, delete on public.catalog_exercise_equipment_options, public.catalog_exercise_equipment_option_items to authenticated;
grant insert, update, delete on public.catalog_exercises to authenticated;
grant insert, update, delete on public.catalog_exercise_muscle_groups to authenticated;

drop policy if exists "Equipment options are readable" on public.catalog_exercise_equipment_options;
create policy "Equipment options are readable"
on public.catalog_exercise_equipment_options for select to anon, authenticated
using (true);
drop policy if exists "Equipment option items are readable" on public.catalog_exercise_equipment_option_items;
create policy "Equipment option items are readable"
on public.catalog_exercise_equipment_option_items for select to anon, authenticated
using (true);

drop policy if exists "Admins manage equipment options" on public.catalog_exercise_equipment_options;
drop policy if exists "Admins insert equipment options" on public.catalog_exercise_equipment_options;
create policy "Admins insert equipment options"
on public.catalog_exercise_equipment_options for insert to authenticated
with check ((select private.is_admin()));
drop policy if exists "Admins update equipment options" on public.catalog_exercise_equipment_options;
create policy "Admins update equipment options"
on public.catalog_exercise_equipment_options for update to authenticated
using ((select private.is_admin())) with check ((select private.is_admin()));
drop policy if exists "Admins delete equipment options" on public.catalog_exercise_equipment_options;
create policy "Admins delete equipment options"
on public.catalog_exercise_equipment_options for delete to authenticated
using ((select private.is_admin()));

drop policy if exists "Admins manage equipment option items" on public.catalog_exercise_equipment_option_items;
drop policy if exists "Admins insert equipment option items" on public.catalog_exercise_equipment_option_items;
create policy "Admins insert equipment option items"
on public.catalog_exercise_equipment_option_items for insert to authenticated
with check ((select private.is_admin()));
drop policy if exists "Admins update equipment option items" on public.catalog_exercise_equipment_option_items;
create policy "Admins update equipment option items"
on public.catalog_exercise_equipment_option_items for update to authenticated
using ((select private.is_admin())) with check ((select private.is_admin()));
drop policy if exists "Admins delete equipment option items" on public.catalog_exercise_equipment_option_items;
create policy "Admins delete equipment option items"
on public.catalog_exercise_equipment_option_items for delete to authenticated
using ((select private.is_admin()));

drop policy if exists "Admins insert catalog exercises" on public.catalog_exercises;
create policy "Admins insert catalog exercises"
on public.catalog_exercises for insert to authenticated
with check ((select private.is_admin()));
drop policy if exists "Admins update catalog exercises" on public.catalog_exercises;
create policy "Admins update catalog exercises"
on public.catalog_exercises for update to authenticated
using ((select private.is_admin())) with check ((select private.is_admin()));
drop policy if exists "Admins delete catalog exercises" on public.catalog_exercises;
create policy "Admins delete catalog exercises"
on public.catalog_exercises for delete to authenticated
using ((select private.is_admin()));

drop policy if exists "Admins insert catalog exercise muscle groups" on public.catalog_exercise_muscle_groups;
create policy "Admins insert catalog exercise muscle groups"
on public.catalog_exercise_muscle_groups for insert to authenticated
with check ((select private.is_admin()));
drop policy if exists "Admins update catalog exercise muscle groups" on public.catalog_exercise_muscle_groups;
create policy "Admins update catalog exercise muscle groups"
on public.catalog_exercise_muscle_groups for update to authenticated
using ((select private.is_admin())) with check ((select private.is_admin()));
drop policy if exists "Admins delete catalog exercise muscle groups" on public.catalog_exercise_muscle_groups;
create policy "Admins delete catalog exercise muscle groups"
on public.catalog_exercise_muscle_groups for delete to authenticated
using ((select private.is_admin()));

create or replace function public.admin_upsert_catalog_exercise_v2(
  p_id bigint,
  p_code text,
  p_label text,
  p_pillar_id bigint,
  p_difficulty integer,
  p_impact_code text,
  p_family_id bigint,
  p_type_id bigint,
  p_muscle_group_ids bigint[],
  p_equipment_options jsonb,
  p_movement_description text,
  p_start_position text,
  p_outbound_execution text,
  p_return_execution text,
  p_tips text,
  p_errors text
) returns bigint
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_exercise_id bigint;
  v_impact_id bigint;
  v_primary_equipment_id bigint;
  v_option jsonb;
  v_option_id bigint;
  v_option_index integer;
  v_equipment_code text;
begin
  if not (select private.is_admin()) then
    raise exception 'Accès administrateur requis';
  end if;
  if jsonb_typeof(p_equipment_options) <> 'array'
     or jsonb_array_length(p_equipment_options) = 0 then
    raise exception 'Au moins une option équipement est requise';
  end if;
  if coalesce(array_length(p_muscle_group_ids, 1), 0) = 0 then
    raise exception 'Au moins un groupe musculaire est requis';
  end if;
  if exists (
    select 1
    from jsonb_array_elements(p_equipment_options) option_row(value)
    where jsonb_typeof(option_row.value) <> 'object'
       or option_row.value ->> 'kind' not in ('bodyweight', 'equipment')
       or jsonb_typeof(coalesce(option_row.value -> 'equipmentCodes', '[]'::jsonb)) <> 'array'
  ) then
    raise exception 'Structure option équipement invalide';
  end if;
  if exists (
    select 1
    from jsonb_array_elements(p_equipment_options) option_row(value)
    group by option_row.value
    having count(*) > 1
  ) then
    raise exception 'Les options équipement dupliquées sont interdites';
  end if;
  if exists (
    select 1
    from jsonb_array_elements(p_equipment_options) option_row(value)
    cross join lateral jsonb_array_elements_text(
      coalesce(option_row.value -> 'equipmentCodes', '[]'::jsonb)
    ) equipment_code(value)
    group by option_row.value, equipment_code.value
    having count(*) > 1
  ) then
    raise exception 'Un équipement ne peut apparaître deux fois dans une option';
  end if;
  if exists (
    select 1
    from jsonb_array_elements(p_equipment_options) option_row(value)
    cross join lateral jsonb_array_elements_text(
      coalesce(option_row.value -> 'equipmentCodes', '[]'::jsonb)
    ) equipment_code(value)
    left join public.catalog_equipment equipment on equipment.code = equipment_code.value
    where equipment.id is null
  ) then
    raise exception 'Une option référence un équipement catalogue inconnu';
  end if;
  if exists (
    select 1
    from unnest(p_muscle_group_ids) muscle_group_id
    left join public.catalog_muscle_groups muscle_group on muscle_group.id = muscle_group_id
    where muscle_group.id is null
  ) then
    raise exception 'Un groupe musculaire catalogue est inconnu';
  end if;

  select id into v_impact_id
  from public.catalog_impacts
  where code = p_impact_code or lower(label) = lower(p_impact_code)
  order by code = p_impact_code desc
  limit 1;
  if v_impact_id is null then
    raise exception 'Impact catalogue inconnu: %', p_impact_code;
  end if;

  select equipment.id into v_primary_equipment_id
  from jsonb_array_elements(p_equipment_options) with ordinality as option_row(value, position)
  cross join lateral jsonb_array_elements_text(option_row.value -> 'equipmentCodes') as code(value)
  join public.catalog_equipment equipment on equipment.code = code.value
  order by option_row.position, equipment.id
  limit 1;

  if p_id is null then
    insert into public.catalog_exercises (
      code, label, pillar_id, difficulty, impact_id, family_id, type_id,
      equipment_id, movement_description, start_position, outbound_execution,
      return_execution, adapted_version, tips, errors
    ) values (
      p_code, p_label, p_pillar_id, p_difficulty, v_impact_id, p_family_id,
      p_type_id, v_primary_equipment_id, p_movement_description,
      p_start_position, p_outbound_execution, p_return_execution, '', p_tips,
      p_errors
    ) returning id into v_exercise_id;
  else
    update public.catalog_exercises set
      code = p_code, label = p_label, pillar_id = p_pillar_id,
      difficulty = p_difficulty, impact_id = v_impact_id,
      family_id = p_family_id, type_id = p_type_id,
      equipment_id = v_primary_equipment_id,
      movement_description = p_movement_description,
      start_position = p_start_position,
      outbound_execution = p_outbound_execution,
      return_execution = p_return_execution,
      tips = p_tips, errors = p_errors
    where id = p_id returning id into v_exercise_id;
    if v_exercise_id is null then
      raise exception 'Exercice catalogue introuvable: %', p_id;
    end if;
  end if;

  delete from public.catalog_exercise_muscle_groups where exercise_id = v_exercise_id;
  insert into public.catalog_exercise_muscle_groups (exercise_id, muscle_group_id)
  select v_exercise_id, muscle_group_id
  from unnest(p_muscle_group_ids) as muscle_group_id;

  delete from public.catalog_exercise_equipment_options where exercise_id = v_exercise_id;
  v_option_index := 0;
  for v_option in select value from jsonb_array_elements(p_equipment_options)
  loop
    if v_option ->> 'kind' not in ('bodyweight', 'equipment') then
      raise exception 'Type option équipement invalide';
    end if;
    if v_option ->> 'kind' = 'bodyweight'
       and jsonb_array_length(coalesce(v_option -> 'equipmentCodes', '[]'::jsonb)) <> 0 then
      raise exception 'Une option sans matériel ne peut pas contenir un équipement';
    end if;
    if v_option ->> 'kind' = 'equipment'
       and jsonb_array_length(coalesce(v_option -> 'equipmentCodes', '[]'::jsonb)) = 0 then
      raise exception 'Une option avec équipement ne peut pas être vide';
    end if;

    insert into public.catalog_exercise_equipment_options (
      exercise_id, option_index, kind
    ) values (v_exercise_id, v_option_index, v_option ->> 'kind')
    returning id into v_option_id;

    for v_equipment_code in
      select value from jsonb_array_elements_text(
        coalesce(v_option -> 'equipmentCodes', '[]'::jsonb)
      )
    loop
      insert into public.catalog_exercise_equipment_option_items (option_id, equipment_id)
      select v_option_id, id from public.catalog_equipment where code = v_equipment_code;
      if not found then
        raise exception 'Équipement catalogue inconnu: %', v_equipment_code;
      end if;
    end loop;
    v_option_index := v_option_index + 1;
  end loop;

  return v_exercise_id;
end;
$$;
revoke all on function public.admin_upsert_catalog_exercise_v2(
  bigint, text, text, bigint, integer, text, bigint, bigint, bigint[], jsonb,
  text, text, text, text, text, text
) from public, anon;
grant execute on function public.admin_upsert_catalog_exercise_v2(
  bigint, text, text, bigint, integer, text, bigint, bigint, bigint[], jsonb,
  text, text, text, text, text, text
) to authenticated;

do $$
declare
  equipment_count bigint;
  exercise_count bigint;
  invalid_count bigint;
begin
  select count(*) into equipment_count from public.catalog_equipment;
  if equipment_count <> 24 then
    raise exception 'equipment v2 migration: expected 24 canonical equipment rows, found %', equipment_count;
  end if;

  select count(*) into exercise_count from public.catalog_exercises;
  if exercise_count <> 236 then
    raise exception 'equipment v2 migration: expected 236 exercises after migration, found %', exercise_count;
  end if;

  select count(*) into invalid_count
  from public.catalog_exercises exercise
  where not exists (
    select 1 from public.catalog_exercise_equipment_options option_row
    where option_row.exercise_id = exercise.id
  );
  if invalid_count <> 0 then
    raise exception 'equipment v2 migration: % exercise(s) have no equipment option', invalid_count;
  end if;

  select count(*) into invalid_count
  from public.catalog_exercise_equipment_options option_row
  where (option_row.kind = 'bodyweight' and exists (
      select 1 from public.catalog_exercise_equipment_option_items item
      where item.option_id = option_row.id
    ))
    or (option_row.kind = 'equipment' and not exists (
      select 1 from public.catalog_exercise_equipment_option_items item
      where item.option_id = option_row.id
    ));
  if invalid_count <> 0 then
    raise exception 'equipment v2 migration: % malformed equipment option(s)', invalid_count;
  end if;

  select count(*) into invalid_count
  from public.catalog_equipment
  where category not in ('maison', 'sport')
     or lower(trim(label)) ~ '[/]'
     or lower(trim(label)) like '%optionnel%'
     or lower(trim(label)) in ('aucun', 'support', 'support stable');
  if invalid_count <> 0 then
    raise exception 'equipment v2 migration: % ambiguous or uncategorized equipment row(s)', invalid_count;
  end if;

  select count(*) into invalid_count
  from public.catalog_exercises exercise
  where exists (
      select 1 from public.catalog_exercise_equipment_options option_row
      where option_row.exercise_id = exercise.id and option_row.kind = 'equipment'
    )
    and (
      exercise.equipment_id is null
      or not exists (
        select 1
        from public.catalog_exercise_equipment_options option_row
        join public.catalog_exercise_equipment_option_items item
          on item.option_id = option_row.id
        where option_row.exercise_id = exercise.id
          and item.equipment_id = exercise.equipment_id
      )
    );
  if invalid_count <> 0 then
    raise exception 'equipment v2 migration: % exercise(s) have an invalid compatibility equipment_id', invalid_count;
  end if;
end $$;

notify pgrst, 'reload schema';

commit;
