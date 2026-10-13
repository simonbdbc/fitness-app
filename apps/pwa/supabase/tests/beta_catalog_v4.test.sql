begin;

create extension if not exists pgtap with schema extensions;
select plan(23);

select has_table('public', 'catalog_releases', 'catalog releases table exists');
select has_table('public', 'catalog_exercise_media', 'catalog media table exists');
select has_table('public', 'catalog_session_templates', 'catalog templates table exists');
select has_table('public', 'catalog_session_template_levels', 'catalog template levels table exists');
select has_table(
  'public',
  'acrea_level_evaluation_exercise_mappings',
  'canonical V4 evaluation mappings table exists'
);
select ok(
  (select relrowsecurity from pg_class where oid = 'public.catalog_releases'::regclass),
  'catalog releases RLS is enabled'
);
select ok(
  (select relrowsecurity from pg_class where oid = 'public.catalog_exercise_media'::regclass),
  'catalog media RLS is enabled'
);
select ok(
  (select relrowsecurity from pg_class where oid = 'public.catalog_exercises'::regclass),
  'catalog exercises RLS is enabled'
);
select ok(
  (select relrowsecurity from pg_class where oid = 'public.acrea_level_evaluation_exercise_mappings'::regclass),
  'canonical mappings RLS is enabled'
);
select is(
  (
    select source_revision
    from public.catalog_releases
    where code = 'exercise-library-v2'
  ),
  '1de8bc8353e79697',
  'the active beta release has the qualified source revision'
);
select is(
  (
    select count(*)
    from public.catalog_exercises exercise
    join public.catalog_releases release on release.id = exercise.release_id
    where release.code = 'exercise-library-v2' and exercise.is_active
  ),
  707::bigint,
  'the beta release publishes 707 active exercises'
);
select is(
  (
    select count(*)
    from public.catalog_exercise_media media
    join public.catalog_exercises exercise on exercise.id = media.exercise_id
    join public.catalog_releases release on release.id = exercise.release_id
    where release.code = 'exercise-library-v2' and media.status = 'ready'
  ),
  1414::bigint,
  'the beta release publishes 1,414 ready media assets'
);
select is(
  (
    select count(*)
    from public.catalog_session_templates template
    join public.catalog_exercises exercise on exercise.id = template.exercise_id
    join public.catalog_releases release on release.id = exercise.release_id
    where release.code = 'exercise-library-v2' and template.is_active
  ),
  455::bigint,
  'the beta release publishes 455 active templates'
);
select is(
  (
    select count(*)
    from public.catalog_session_template_levels template_level
    join public.catalog_session_templates template on template.id = template_level.session_template_id
    join public.catalog_exercises exercise on exercise.id = template.exercise_id
    join public.catalog_releases release on release.id = exercise.release_id
    where release.code = 'exercise-library-v2'
  ),
  1533::bigint,
  'the beta release publishes 1,533 template-level links'
);
select is(
  (
    select count(*)
    from public.acrea_level_evaluation_exercise_mappings
    where protocol_version = 4 and validated_at is not null
  ),
  6::bigint,
  'the beta release exposes six validated V4 evaluation mappings'
);
select is(
  (
    select array_agg(pillar || ':' || mapping_count order by pillar)
    from (
      select pillar, count(*)::text as mapping_count
      from public.acrea_level_evaluation_exercise_mappings
      where protocol_version = 4
      group by pillar
    ) mapping_counts
  ),
  array['cardio:2', 'proprioception:2', 'strength:2']::text[],
  'V4 maps exactly two exercises to each programming pillar'
);
select is(
  (
    select count(*)
    from public.catalog_session_templates template
    join public.catalog_exercises exercise on exercise.id = template.exercise_id
    join public.catalog_releases release on release.id = exercise.release_id
    join public.catalog_equipment equipment on equipment.id = exercise.equipment_id
    join public.catalog_impacts impact on impact.id = exercise.impact_id
    where release.code = 'exercise-library-v2'
      and template.is_active
      and template.phase in ('warmup', 'cooldown')
      and equipment.code = 'no-equipment'
      and impact.code = 'faible'
  ),
  2::bigint,
  'fixed warmup and cooldown remain usable without equipment at low impact'
);
select is(
  (
    select array_agg(pillar order by pillar)
    from (
      select distinct pillar.code as pillar
      from public.catalog_session_templates template
      join public.catalog_session_template_levels template_level
        on template_level.session_template_id = template.id
      join public.catalog_exercises exercise on exercise.id = template.exercise_id
      join public.catalog_releases release on release.id = exercise.release_id
      join public.catalog_pillars pillar on pillar.id = exercise.pillar_id
      join public.catalog_equipment equipment on equipment.id = exercise.equipment_id
      join public.catalog_impacts impact on impact.id = exercise.impact_id
      where release.code = 'exercise-library-v2'
        and template.is_active
        and template.phase = 'main'
        and template_level.level = 1
        and pillar.code in ('strength', 'cardio', 'proprioception')
        and equipment.code = 'no-equipment'
        and impact.code = 'faible'
    ) fallbacks
  ),
  array['cardio', 'proprioception', 'strength']::text[],
  'each programming pillar has a level-one low-impact fallback without equipment'
);
select is(
  (
    select count(*)
    from public.catalog_exercises exercise
    join public.catalog_releases release on release.id = exercise.release_id
    where release.code = 'exercise-library-v2'
      and exercise.slug in (
        'push-up', 'air-squat', 'burpee', 'mountain-climber',
        'lying-leg-raise', 'lean-planche'
      )
  ),
  6::bigint,
  'all canonical V4 evaluation exercise slugs are present in the beta catalogue'
);

set local role anon;

select is(
  (
    select count(*)
    from public.catalog_exercises exercise
    join public.catalog_releases release on release.id = exercise.release_id
    where release.code = 'exercise-library-v2' and exercise.is_active
  ),
  707::bigint,
  'anonymous clients can read the published beta catalogue'
);
select throws_ok(
  $$select count(*) from public.acrea_level_evaluation_exercise_mappings$$,
  '42501',
  null,
  'anonymous clients cannot read canonical V4 mappings'
);

reset role;
set local role authenticated;
set local "request.jwt.claim.sub" = '00000000-0000-4000-8000-000000000201';

select is(
  (
    select count(*)
    from public.acrea_level_evaluation_exercise_mappings
    where protocol_version = 4
  ),
  6::bigint,
  'authenticated clients can read canonical V4 mappings'
);
select throws_ok(
  $$
    update public.catalog_exercises
    set label = label
    where slug = 'push-up'
  $$,
  '42501',
  null,
  'authenticated clients cannot mutate the generated beta catalogue'
);

reset role;
select * from finish();
rollback;
