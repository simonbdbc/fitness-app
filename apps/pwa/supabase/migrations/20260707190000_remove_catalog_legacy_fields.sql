drop table if exists public.catalog_exercise_variants cascade;
drop table if exists public.catalog_exercise_families cascade;
drop table if exists public.catalog_exercise_levels cascade;
drop table if exists public.catalog_exercise_level_formats cascade;
drop table if exists public.catalog_session_exercises cascade;
drop table if exists public.catalog_level_sessions cascade;
drop table if exists public.catalog_sessions cascade;

drop index if exists public.catalog_families_pillar_sort_idx;
drop index if exists public.catalog_types_sort_idx;
drop index if exists public.catalog_muscle_groups_region_sort_idx;
drop index if exists public.catalog_exercise_variants_exercise_idx;
drop index if exists public.catalog_exercise_families_family_idx;
drop index if exists public.catalog_exercise_levels_exercise_idx;
drop index if exists public.catalog_exercise_level_formats_format_idx;
drop index if exists public.catalog_session_exercises_exercise_idx;
drop index if exists public.catalog_level_sessions_session_idx;
drop index if exists public.catalog_sessions_pillar_idx;

alter table if exists public.catalog_pillars
    drop column if exists sort_order,
    drop column if exists source_path;

alter table if exists public.catalog_families
    drop constraint if exists catalog_families_pillar_id_slug_key,
    drop constraint if exists catalog_families_pillar_id_label_key,
    drop column if exists pillar_id,
    drop column if exists slug,
    drop column if exists sort_order,
    drop column if exists source_path;

alter table if exists public.catalog_types
    drop column if exists sort_order,
    drop column if exists source_path;

alter table if exists public.catalog_muscle_groups
    drop column if exists body_region,
    drop column if exists sort_order,
    drop column if exists source_path;

alter table if exists public.catalog_exercises
    drop column if exists primary_family_id,
    drop column if exists level,
    drop column if exists assessment_levels,
    drop column if exists protocols_compatibility,
    drop column if exists technical_points,
    drop column if exists adapted_version,
    drop column if exists success_criteria,
    drop column if exists summary,
    drop column if exists source_path;

create index if not exists catalog_families_label_idx
on public.catalog_families (label);

create index if not exists catalog_types_label_idx
on public.catalog_types (label);

create index if not exists catalog_muscle_groups_label_idx
on public.catalog_muscle_groups (label);
