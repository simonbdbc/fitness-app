import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import path from "node:path";
import { fileURLToPath } from "node:url";

const appRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = (relativePath) => readFileSync(path.join(appRoot, relativePath), "utf8");
const evaluationMappings = [
  ["renforcement-pompe-stricte", "renforcement-strict-pushups", "push-up"],
  ["renforcement-squat-poids-du-corps", "renforcement-bodyweight-squats", "air-squat"],
  ["cardio-burpee-sans-pompe", "cardio-burpee-sans-pompe", "burpee"],
  ["cardio-mountain-climber-classique", "cardio-mountain-climber-controle", "mountain-climber"],
  ["proprioception-releve-de-jambes-au-sol", "proprioception-leg-raise", "lying-leg-raise"],
  ["proprioception-planche-lean", "proprioception-planche-lean", "lean-planche"],
];

test("beta reset migration preserves identity while replacing the business graph", () => {
  const migration = read("supabase/migrations/20260811100000_exercise_library_v2.sql");

  for (const fragment of [
    "create table if not exists public.catalog_releases",
    "create table if not exists public.catalog_exercise_media",
    "update public.acrea_profiles",
    "add column if not exists is_active boolean not null default true",
    "add column if not exists review_status text not null default 'a_verifier'",
    "add column if not exists translation_status text not null default 'pending'",
    "add column if not exists programming_status text not null default 'ineligible'",
    "add column if not exists updated_at timestamptz not null default now()",
    "truncate table public.session_feedback",
    "public.catalog_session_templates",
    "rename to _acrea_level_evaluation_preferences_pre_beta",
    "create table if not exists public._acrea_level_evaluation_preferences_pre_beta",
  ]) {
    assert.match(migration, new RegExp(fragment.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  }
  assert.match(
    migration,
    /where level_test_status is distinct from 'completed'/u,
  );
  assert.doesNotMatch(migration, /(?:renforcement|cardio|proprioception)_level\s*=\s*null/u);
  assert.doesNotMatch(migration, /truncate table public\.acrea_profiles/u);
  assert.doesNotMatch(
    migration,
    /truncate table[\s\S]*?public\.acrea_level_evaluation_(?:results|sessions|attempts)/u,
  );
  assert.doesNotMatch(migration, /auth\.users/u);
});

test("V4 finalization and the generated beta catalogue migration are present", () => {
  const v4 = read("supabase/migrations/20260812083749_beta_catalog_release_v4.sql");
  const seed = read("supabase/exercise_library_v2_seed.sql");
  const deploymentMigration = read(
    "supabase/migrations/20260812105130_beta_catalog_v2_seed.sql",
  );
  const mappingGrantPatch = read("supabase/migrations/20260812145000_beta_revoke_anon_v4_mapping_select.sql");
  const artifact = JSON.parse(
    read("src/features/catalog/data/exerciseLibrary.json"),
  );

  assert.match(v4, /create or replace function public\.finalize_acrea_level_evaluation_v4/u);
  assert.match(v4, /grant execute on function public\.finalize_acrea_level_evaluation_v4/u);
  assert.match(v4, /Historical completed attempts stay readable/u);
  assert.match(
    v4,
    /Completed historical evaluations contain an exercise without an approved V4 mapping/u,
  );
  for (const [legacyCode, evaluationCode, exerciseSlug] of evaluationMappings) {
    assert.match(
      v4,
      new RegExp(`'${legacyCode}', '${evaluationCode}'`, "u"),
    );
    assert.match(
      seed,
      new RegExp(`'${legacyCode}', '${evaluationCode}', '${exerciseSlug}'`, "u"),
    );
  }
  assert.match(seed, /insert into public\.catalog_session_templates/u);
  assert.match(seed, /insert into public\.catalog_session_template_levels/u);
  assert.match(
    seed,
    /"translationStatus" text, media jsonb\n\)\n\)\ninsert into public\.catalog_exercises/u,
  );
  assert.match(
    seed,
    /"updatedAt" timestamptz, levels jsonb\n\)\n\)\ninsert into public\.catalog_session_templates/u,
  );
  assert.match(seed, /from public\._acrea_level_evaluation_preferences_pre_beta/u);
  assert.match(seed, /drop table public\._acrea_level_evaluation_preferences_pre_beta/u);
  assert.match(deploymentMigration, new RegExp(`set source_revision = '${artifact.revision}'`, "u"));
  assert.match(
    mappingGrantPatch,
    /revoke select on public\.acrea_level_evaluation_exercise_mappings from anon/u,
  );
  assert.equal(artifact.summary.exerciseCount, 6);
  assert.equal(artifact.summary.templateCount, 8);
  assert.equal(artifact.summary.sessionTemplateLevelCount, artifact.sessionTemplates.reduce((n, item) => n + item.levels.length, 0));
  assert.deepEqual(new Set(artifact.exercises.map(item => item.slug)), new Set(evaluationMappings.map(item => item[2])));
});

test("production foreign keys to the exercise catalogue have supporting indexes", () => {
  const migration = read(
    "supabase/migrations/20260812181410_add_catalog_foreign_key_indexes.sql",
  );

  for (const fragment of [
    "acrea_exercise_progressions_exercise_id_idx",
    "acrea_level_evaluation_mappings_exercise_slug_idx",
    "acrea_level_evaluation_preferences_exercise_slug_idx",
    "acrea_profile_excluded_exercises_exercise_id_idx",
    "catalog_exercises_progression_exercise_id_idx",
    "catalog_exercises_regression_exercise_id_idx",
  ]) {
    assert.match(migration, new RegExp(fragment, "u"));
  }
});

test("progressive catalogue RPCs expose an index and bounded detail batches", () => {
  const migration = read(
    "supabase/migrations/20260813074437_catalog_progressive_delivery.sql",
  );

  for (const fragment of [
    "add column if not exists source_category text not null default ''",
    "add column if not exists source_language text not null default 'fr'",
    "add column if not exists locale text not null default 'fr'",
    "add column if not exists archived_at timestamptz",
    "add column if not exists admin_overridden_at timestamptz",
    "source_category = coalesce(nullif(exercise.source_category, ''), exercise.category_slug, '')",
    "source_language = coalesce(nullif(exercise.source_language, ''), release.locale, 'fr')",
    "locale = coalesce(nullif(exercise.locale, ''), release.locale, 'fr')",
    "create or replace function public.get_active_catalog_index()",
    "create or replace function public.get_active_catalog_details(p_slugs text[])",
    "security invoker",
    "cardinality(p_slugs) > 25",
    "grant execute on function public.get_active_catalog_index() to authenticated",
    "grant execute on function public.get_active_catalog_details(text[]) to authenticated",
    "library/' || release.source_revision",
  ]) {
    assert.match(
      migration,
      new RegExp(fragment.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")),
    );
  }
  assert.doesNotMatch(migration, /security definer/u);
  assert.match(
    migration,
    /revoke all on function public\.get_active_catalog_index\(\) from public, anon/u,
  );
  assert.match(migration, /'movementDescription', ''/u);
  assert.match(migration, /'media', '\[\]'::jsonb/u);
});

test("the progressive Supabase preflight remains a manual verification", () => {
  const pipeline = read("../../.gitlab-ci.yml");
  const localIntegration = read(
    "scripts/verify-catalog-progressive-schema-local.mjs",
  );
  const contract = JSON.parse(
    read("public/catalog-progressive-schema-contract.json"),
  );

  assert.equal(contract.schemaContractVersion, 1);
  assert.equal(contract.productionProjectRef, "vnsisuhlaxxldpwjhgcm");
  assert.equal(contract.rpc.index, "get_active_catalog_index");
  assert.equal(contract.rpc.details, "get_active_catalog_details");
  assert.deepEqual(contract.requiredMediaKinds, ["poster", "animation"]);
  assert.doesNotMatch(pipeline, /production_schema_preflight:/u);
  assert.match(localIntegration, /catalog-progressive-\$\{randomUUID\(\)\}/u);
  assert.match(localIntegration, /oversizedResponse\.status !== 400/u);
  assert.match(
    localIntegration,
    /Le test d'intégration est réservé à une cible Supabase locale/u,
  );
  const packageDefinition = JSON.parse(read("package.json"));
  assert.equal(
    packageDefinition.scripts["catalog:progressive:preflight"],
    "node scripts/verify-catalog-progressive-schema.mjs",
  );
  assert.equal(
    packageDefinition.scripts["catalog:progressive:local"],
    "node scripts/verify-catalog-progressive-schema-local.mjs",
  );
});

test("the production dry-run guard includes the progressive catalogue migration", () => {
  const guard = read("scripts/verify-production-migration-plan.mjs");
  assert.match(
    guard,
    /"20260812181410_add_catalog_foreign_key_indexes\.sql"/u,
  );
  assert.match(
    guard,
    /"20260813074437_catalog_progressive_delivery\.sql"/u,
  );
});

test("the anonymized-copy export excludes every user-owned evaluation row", () => {
  const exporter = read("scripts/prepare-anonymized-production-copy.mjs");
  const validator = read("scripts/validate-anonymized-production-copy.mjs");
  const before = read("supabase/audits/beta_v1_00_synthetic_history_before.sql");
  const after = read("supabase/audits/beta_v1_00_synthetic_history_after.sql");
  const redactedState = read("supabase/audits/beta_v1_00_redacted_user_state.sql");

  for (const table of [
    "user_profiles",
    "acrea_profiles",
    "acrea_profile_equipment",
    "acrea_profile_restrictions",
    "acrea_level_test_attempts",
    "acrea_level_test_stage_results",
    "acrea_level_evaluation_attempts",
    "acrea_level_evaluation_sessions",
    "acrea_level_evaluation_results",
    "acrea_level_evaluation_preferences",
    "acrea_exercise_progressions",
    "acrea_profile_excluded_exercises",
    "programs",
    "trainings",
    "seances",
    "sessions",
    "session_feedback",
  ]) {
    assert.match(exporter, new RegExp(`public\\.${table}`));
  }
  assert.match(exporter, /synthetic qualification fixture/u);
  assert.match(
    exporter,
    /userOwnedTables\.flatMap\(\(table\) => \["--exclude", table\]\)/u,
  );
  assert.doesNotMatch(exporter, /\]\.join\(","\)/u);
  assert.ok(
    validator.indexOf("beta_v1_00_synthetic_history_before.sql") <
      validator.indexOf('"db", "push", "--local", "--yes"'),
    "the synthetic history must exist before the beta migration replay",
  );
  assert.match(validator, /"20260813074437"/u);
  assert.ok(
    validator.indexOf("beta_v1_00_synthetic_history_after.sql") >
      validator.indexOf('"db", "push", "--local", "--yes"'),
    "the synthetic history must be asserted after the beta migration replay",
  );
  assert.match(before, /fixture_completed_at constant timestamptz/u);
  assert.match(before, /'proprioception-planche-lean'/u);
  assert.match(after, /Synthetic historical V4 evaluation remapping/u);
  assert.match(after, /protocol_version = 4/u);
  assert.match(redactedState, /aggregate-only state capture/u);
  assert.match(redactedState, /md5\(coalesce\(string_agg/u);
  assert.match(redactedState, /completed_evaluation_results/u);
});
