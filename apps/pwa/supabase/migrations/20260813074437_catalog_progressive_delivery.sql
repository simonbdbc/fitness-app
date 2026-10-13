-- Progressive offline catalogue delivery.  These functions deliberately use
-- SECURITY INVOKER: callers remain subject to the catalogue RLS policies and
-- the functions never expose administration-only rows.
begin;

-- The mobile SQLite cache already stores this provenance metadata.  The
-- normalized Supabase V2 schema deliberately kept only the compact search
-- columns, so make the RPC source compatible before referring to it below.
-- Existing releases are backfilled deterministically from their category and
-- locale; future imports may supply the original values directly.
alter table public.catalog_exercises
  add column if not exists source_category text not null default '',
  add column if not exists source_language text not null default 'fr',
  add column if not exists locale text not null default 'fr',
  add column if not exists archived_at timestamptz,
  add column if not exists admin_overridden_at timestamptz;

update public.catalog_exercises exercise
set source_category = coalesce(nullif(exercise.source_category, ''), exercise.category_slug, ''),
    source_language = coalesce(nullif(exercise.source_language, ''), release.locale, 'fr'),
    locale = coalesce(nullif(exercise.locale, ''), release.locale, 'fr')
from public.catalog_releases release
where release.id = exercise.release_id;

create or replace function public.get_active_catalog_index()
returns jsonb
language sql
stable
security invoker
set search_path = ''
as $$
  with active_release as (
    select release.*
    from public.catalog_releases release
    where release.status = 'active'
    limit 1
  ),
  active_exercises as (
    select exercise.*
    from public.catalog_exercises exercise
    join active_release release on release.id = exercise.release_id
    where exercise.is_active
  )
  select jsonb_build_object(
    'releases', coalesce((
      select jsonb_agg(jsonb_build_object(
        'code', release.code, 'source', release.source,
        'sourceRevision', release.source_revision, 'locale', release.locale,
        'expectedExerciseCount', release.expected_exercise_count,
        'status', release.status, 'licenseId', release.license_id,
        'activationBackupReference', release.activation_backup_reference,
        'activationDiffReference', release.activation_diff_reference,
        'createdAt', release.created_at, 'activatedAt', release.activated_at,
        'archivedAt', release.archived_at, 'updatedAt', release.updated_at
      )) from active_release release
    ), '[]'::jsonb),
    'pillars', coalesce((select jsonb_agg(jsonb_build_object('code', code, 'label', label) order by id) from public.catalog_pillars), '[]'::jsonb),
    'impacts', coalesce((select jsonb_agg(jsonb_build_object('code', code, 'label', label) order by id) from public.catalog_impacts), '[]'::jsonb),
    'families', coalesce((select jsonb_agg(jsonb_build_object('code', code, 'label', label) order by id) from public.catalog_families), '[]'::jsonb),
    'types', coalesce((select jsonb_agg(jsonb_build_object('code', code, 'label', label) order by id) from public.catalog_types), '[]'::jsonb),
    'muscleGroups', coalesce((select jsonb_agg(jsonb_build_object('code', code, 'label', label) order by id) from public.catalog_muscle_groups), '[]'::jsonb),
    'equipment', coalesce((select jsonb_agg(jsonb_build_object('code', code, 'label', label, 'category', category) order by id) from public.catalog_equipment), '[]'::jsonb),
    'exercises', coalesce((
      select jsonb_agg(jsonb_build_object(
        'slug', exercise.slug, 'sourceKey', exercise.source_key,
        'labelFr', exercise.label_fr, 'labelEn', exercise.label_en,
        'categorySlug', exercise.category_slug, 'equipmentSlug', exercise.equipment_slug,
        'code', exercise.code, 'label', exercise.label,
        'pillarCode', pillar.code, 'difficulty', exercise.difficulty,
        'impactCode', impact.code, 'familyCode', family.code, 'typeCode', type.code,
        'equipmentCode', coalesce(equipment.code, 'no-equipment'),
        'regressionExerciseCode', null, 'progressionExerciseCode', null,
        'movementDescription', '', 'startPosition', '',
        'outboundExecution', '', 'returnExecution', '', 'adaptedVersion', '',
        'tips', '', 'errors', '',
        'muscleGroupCodes', coalesce(muscles.codes, '[]'::jsonb),
        'releaseCode', release.code, 'sourceCategory', exercise.source_category,
        'sourceLanguage', exercise.source_language, 'locale', exercise.locale,
        'isActive', exercise.is_active, 'reviewStatus', exercise.review_status,
        'translationStatus', exercise.translation_status,
        'programmingStatus', exercise.programming_status,
        'archivedAt', exercise.archived_at, 'adminOverriddenAt', exercise.admin_overridden_at,
        'media', '[]'::jsonb
      ) order by exercise.label_fr)
      from active_exercises exercise
      join active_release release on release.id = exercise.release_id
      join public.catalog_pillars pillar on pillar.id = exercise.pillar_id
      join public.catalog_impacts impact on impact.id = exercise.impact_id
      join public.catalog_families family on family.id = exercise.family_id
      join public.catalog_types type on type.id = exercise.type_id
      left join public.catalog_equipment equipment on equipment.id = exercise.equipment_id
      left join lateral (
        select jsonb_agg(group_row.code order by group_row.code) as codes
        from public.catalog_exercise_muscle_groups link
        join public.catalog_muscle_groups group_row on group_row.id = link.muscle_group_id
        where link.exercise_id = exercise.id
      ) muscles on true
    ), '[]'::jsonb),
    -- Formats are compact, canonical prescriptions. They allow local weekly
    -- selection without downloading an exercise sheet or a WebP file.
    'series', coalesce((select jsonb_agg(jsonb_build_object('code', code, 'label', label, 'series', series, 'updatedAt', updated_at) order by id) from public.catalog_series), '[]'::jsonb),
    'repetitions', coalesce((select jsonb_agg(jsonb_build_object('code', code, 'label', label, 'reps', reps, 'updatedAt', updated_at) order by id) from public.catalog_repetitions), '[]'::jsonb),
    'rests', coalesce((select jsonb_agg(jsonb_build_object('code', code, 'label', label, 'restSeconds', rest_seconds, 'updatedAt', updated_at) order by id) from public.catalog_rests), '[]'::jsonb),
    'intervals', coalesce((select jsonb_agg(jsonb_build_object('code', code, 'label', label, 'effortSeconds', effort_seconds, 'updatedAt', updated_at) order by id) from public.catalog_intervals), '[]'::jsonb),
    'formats', coalesce((
      select jsonb_agg(jsonb_build_object(
        'code', format.code, 'formatType', format.format_type,
        'seriesCode', series.code, 'repetitionsCode', repetitions.code,
        'restCode', rest.code, 'intervalCode', interval.code,
        'label', format.label, 'description', '',
        'sourceStatus', format.source_status, 'updatedAt', format.updated_at
      ) order by format.id)
      from public.catalog_formats format
      join public.catalog_series series on series.id = format.series_id
      left join public.catalog_repetitions repetitions on repetitions.id = format.repetitions_id
      join public.catalog_rests rest on rest.id = format.rest_id
      left join public.catalog_intervals interval on interval.id = format.interval_id
    ), '[]'::jsonb),
    'sessionTemplates', coalesce((
      select jsonb_agg(jsonb_build_object(
        'code', template.code, 'title', template.title, 'description', '',
        'exerciseCode', exercise.code, 'phase', template.phase,
        'isActive', template.is_active, 'sourceStatus', template.source_status,
        'updatedAt', template.updated_at
      ) order by template.id)
      from public.catalog_session_templates template
      join active_exercises exercise on exercise.id = template.exercise_id
    ), '[]'::jsonb),
    'sessionTemplateLevels', coalesce((
      select jsonb_agg(jsonb_build_object(
        'sessionTemplateCode', template.code, 'level', level_link.level,
        'updatedAt', level_link.updated_at
      ) order by template.id, level_link.level)
      from public.catalog_session_template_levels level_link
      join public.catalog_session_templates template on template.id = level_link.session_template_id
      join active_exercises exercise on exercise.id = template.exercise_id
    ), '[]'::jsonb)
  );
$$;

create or replace function public.get_active_catalog_details(p_slugs text[])
returns jsonb
language plpgsql
stable
security invoker
set search_path = ''
as $$
declare
  payload jsonb;
begin
  if coalesce(cardinality(p_slugs), 0) = 0 then
    return jsonb_build_object('exercises', '[]'::jsonb);
  end if;
  if cardinality(p_slugs) > 25 then
    raise exception 'A detail request is limited to 25 exercise slugs'
      using errcode = '22023';
  end if;

  with active_release as (
    select release.* from public.catalog_releases release
    where release.status = 'active' limit 1
  ), selected_exercises as (
    select exercise.*
    from public.catalog_exercises exercise
    join active_release release on release.id = exercise.release_id
    where exercise.is_active and exercise.slug = any(p_slugs)
  )
  select jsonb_build_object(
    'releases', coalesce((select jsonb_agg(jsonb_build_object(
      'code', release.code, 'source', release.source,
      'sourceRevision', release.source_revision, 'locale', release.locale,
      'expectedExerciseCount', release.expected_exercise_count,
      'status', release.status, 'licenseId', release.license_id,
      'activationBackupReference', release.activation_backup_reference,
      'activationDiffReference', release.activation_diff_reference,
      'createdAt', release.created_at, 'activatedAt', release.activated_at,
      'archivedAt', release.archived_at, 'updatedAt', release.updated_at
    )) from active_release release), '[]'::jsonb),
    'pillars', coalesce((select jsonb_agg(jsonb_build_object('code', code, 'label', label) order by id) from public.catalog_pillars), '[]'::jsonb),
    'impacts', coalesce((select jsonb_agg(jsonb_build_object('code', code, 'label', label) order by id) from public.catalog_impacts), '[]'::jsonb),
    'families', coalesce((select jsonb_agg(jsonb_build_object('code', code, 'label', label) order by id) from public.catalog_families), '[]'::jsonb),
    'types', coalesce((select jsonb_agg(jsonb_build_object('code', code, 'label', label) order by id) from public.catalog_types), '[]'::jsonb),
    'muscleGroups', coalesce((select jsonb_agg(jsonb_build_object('code', code, 'label', label) order by id) from public.catalog_muscle_groups), '[]'::jsonb),
    'equipment', coalesce((select jsonb_agg(jsonb_build_object('code', code, 'label', label, 'category', category) order by id) from public.catalog_equipment), '[]'::jsonb),
    'series', '[]'::jsonb, 'repetitions', '[]'::jsonb,
    'rests', '[]'::jsonb, 'intervals', '[]'::jsonb, 'formats', '[]'::jsonb,
    'sessionTemplates', '[]'::jsonb, 'sessionTemplateLevels', '[]'::jsonb,
    'exercises', coalesce((
      select jsonb_agg(jsonb_build_object(
        'slug', exercise.slug, 'sourceKey', exercise.source_key,
        'labelFr', exercise.label_fr, 'labelEn', exercise.label_en,
        'categorySlug', exercise.category_slug, 'equipmentSlug', exercise.equipment_slug,
        'code', exercise.code, 'label', exercise.label,
        'pillarCode', pillar.code, 'difficulty', exercise.difficulty,
        'impactCode', impact.code, 'familyCode', family.code, 'typeCode', type.code,
        'equipmentCode', coalesce(equipment.code, 'no-equipment'),
        'regressionExerciseCode', regression.code, 'progressionExerciseCode', progression.code,
        'movementDescription', exercise.movement_description,
        'startPosition', exercise.start_position,
        'outboundExecution', exercise.outbound_execution,
        'returnExecution', exercise.return_execution,
        'adaptedVersion', exercise.adapted_version, 'tips', exercise.tips,
        'errors', exercise.errors, 'muscleGroupCodes', coalesce(muscles.codes, '[]'::jsonb),
        'releaseCode', release.code, 'sourceCategory', exercise.source_category,
        'sourceLanguage', exercise.source_language, 'locale', exercise.locale,
        'isActive', exercise.is_active, 'reviewStatus', exercise.review_status,
        'translationStatus', exercise.translation_status,
        'programmingStatus', exercise.programming_status,
        'archivedAt', exercise.archived_at, 'adminOverriddenAt', exercise.admin_overridden_at,
        'media', coalesce(media.items, '[]'::jsonb)
      ) order by exercise.label_fr)
      from selected_exercises exercise
      join active_release release on release.id = exercise.release_id
      join public.catalog_pillars pillar on pillar.id = exercise.pillar_id
      join public.catalog_impacts impact on impact.id = exercise.impact_id
      join public.catalog_families family on family.id = exercise.family_id
      join public.catalog_types type on type.id = exercise.type_id
      left join public.catalog_equipment equipment on equipment.id = exercise.equipment_id
      left join public.catalog_exercises regression on regression.id = exercise.regression_exercise_id
      left join public.catalog_exercises progression on progression.id = exercise.progression_exercise_id
      left join lateral (
        select jsonb_agg(group_row.code order by group_row.code) as codes
        from public.catalog_exercise_muscle_groups link
        join public.catalog_muscle_groups group_row on group_row.id = link.muscle_group_id
        where link.exercise_id = exercise.id
      ) muscles on true
      left join lateral (
        select jsonb_agg(jsonb_build_object(
          'kind', item.kind,
          'uri', 'library/' || release.source_revision || '/' ||
            regexp_replace(item.uri, '^docs/bibliotheque/', ''),
          'fileName', item.file_name,
          'mimeType', item.mime_type, 'width', item.width, 'height', item.height,
          'frameCount', item.frame_count, 'loopCount', item.loop_count,
          'sha256', item.sha256, 'status', item.status, 'updatedAt', item.updated_at
        ) order by item.kind) as items
        from public.catalog_exercise_media item where item.exercise_id = exercise.id
      ) media on true
    ), '[]'::jsonb)
  ) into payload;

  return payload;
end;
$$;

revoke all on function public.get_active_catalog_index() from public, anon;
revoke all on function public.get_active_catalog_details(text[]) from public, anon;
grant execute on function public.get_active_catalog_index() to authenticated;
grant execute on function public.get_active_catalog_details(text[]) to authenticated;

commit;
