import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(scriptDir, "..");
const workspaceRoot = path.resolve(projectRoot, "../..");
const errors = [];

const psqlDocPath = "docs/sql/schema-psql.sql";
const sqliteDocPath = "docs/sql/schema-sqlite.sql";
const psqlResetPath = "apps/pwa/supabase/reset-local-format-schema.sql";
const sqliteRuntimePath = "apps/pwa/src/shared/db/migrations.ts";
const activeMigrationDir = "apps/pwa/supabase/migrations";
const roleMigrationSuffix = "_restore_user_profiles_roles_admin_catalog.sql";
const accountTypeRenameMigrationSuffix =
  "_rename_free_account_to_basic.sql";
const historicalDestructiveMigration =
  "20260708180547_reset_catalog_foundation.sql";
const bootstrapMigrationSuffix = "_bootstrap_empty_catalog.sql";
const weeklyAiMigrationSuffix = "_weekly_ai_profiles_iso_week.sql";
const equipmentV2MigrationSuffix = "_equipment_options_profile_v2.sql";
const weeklyAiV3MigrationSuffix = "_acrea_weekly_program_v3.sql";
const levelEvaluationV2MigrationSuffix = "_acrea_level_evaluation_v2.sql";
const levelEvaluationV3MigrationSuffix = "_acrea_level_evaluation_v3.sql";

const tables = {
  catalog_pillars: ["id", "code", "label"],
  catalog_impacts: ["id", "code", "label"],
  catalog_families: ["id", "code", "label"],
  catalog_types: ["id", "code", "label"],
  catalog_muscle_groups: ["id", "code", "label"],
  catalog_equipment: ["id", "code", "label", "category"],
  catalog_exercises: [
    "id",
    "code",
    "label",
    "pillar_id",
    "difficulty",
    "impact_id",
    "family_id",
    "type_id",
    "equipment_id",
    "regression_exercise_id",
    "progression_exercise_id",
    "movement_description",
    "start_position",
    "outbound_execution",
    "return_execution",
    "adapted_version",
    "tips",
    "errors",
  ],
  catalog_exercise_muscle_groups: ["exercise_id", "muscle_group_id"],
  catalog_exercise_equipment_options: [
    "id",
    "exercise_id",
    "option_index",
    "kind",
  ],
  catalog_exercise_equipment_option_items: ["option_id", "equipment_id"],
  catalog_rests: ["id", "code", "label", "rest_seconds", "updated_at"],
  catalog_series: ["id", "code", "label", "series", "updated_at"],
  catalog_repetitions: ["id", "code", "label", "reps", "updated_at"],
  catalog_intervals: ["id", "code", "label", "effort_seconds", "updated_at"],
  catalog_formats: [
    "id",
    "code",
    "format_type",
    "series_id",
    "repetitions_id",
    "rest_id",
    "interval_id",
    "label",
    "description",
    "source_status",
    "updated_at",
  ],
  catalog_session_templates: [
    "id",
    "code",
    "title",
    "description",
    "exercise_id",
    "is_active",
    "source_status",
    "updated_at",
  ],
  catalog_session_template_levels: [
    "session_template_id",
    "level",
    "updated_at",
  ],
};

const userProfileColumns = [
  "id",
  "email",
  "display_name",
  "account_type",
  "created_at",
  "updated_at",
];

const adminMutableCatalogTables = [
  "catalog_equipment",
  "catalog_rests",
  "catalog_series",
  "catalog_repetitions",
  "catalog_intervals",
  "catalog_formats",
  "catalog_session_templates",
  "catalog_session_template_levels",
];

const forbiddenTables = [
  "catalog_exercise_variants",
  "catalog_exercise_families",
  "catalog_exercise_levels",
  "catalog_exercise_level_formats",
  "catalog_sessions",
  "catalog_level_sessions",
  "catalog_session_exercises",
  "catalog_seance_templates",
  "catalog_level_seance_templates",
  "catalog_session_definitions",
  "catalog_seance_template_sessions",
];

const expectedRelations = [
  ["pillar_id", "catalog_pillars(id)"],
  ["impact_id", "catalog_impacts(id)"],
  ["family_id", "catalog_families(id)"],
  ["type_id", "catalog_types(id)"],
  ["equipment_id", "catalog_equipment(id)"],
  ["regression_exercise_id", "catalog_exercises(id)"],
  ["progression_exercise_id", "catalog_exercises(id)"],
  ["exercise_id", "catalog_exercises(id)"],
  ["muscle_group_id", "catalog_muscle_groups(id)"],
  ["series_id", "catalog_series(id)"],
  ["repetitions_id", "catalog_repetitions(id)"],
  ["rest_id", "catalog_rests(id)"],
  ["interval_id", "catalog_intervals(id)"],
  ["session_template_id", "catalog_session_templates(id)"],
  ["option_id", "catalog_exercise_equipment_options(id)"],
];

const expectedIndexes = [
  "catalog_exercises_pillar_difficulty_idx",
  "catalog_exercises_impact_idx",
  "catalog_exercises_family_idx",
  "catalog_exercises_type_idx",
  "catalog_exercises_equipment_idx",
  "catalog_exercise_muscle_groups_group_idx",
  "catalog_series_series_unique",
  "catalog_rests_seconds_unique",
  "catalog_repetitions_reps_unique",
  "catalog_repetitions_maximum_unique",
  "catalog_intervals_seconds_unique",
  "catalog_formats_shape_unique",
  "catalog_formats_type_idx",
  "catalog_formats_series_idx",
  "catalog_formats_repetitions_idx",
  "catalog_formats_intervals_idx",
  "catalog_formats_rests_idx",
  "catalog_session_templates_exercise_idx",
  "catalog_session_template_levels_level_idx",
  "catalog_exercise_equipment_options_exercise_idx",
  "catalog_exercise_equipment_option_items_equipment_idx",
];

const weeklyRuntimeTables = [
  "acrea_profiles",
  "acrea_profile_equipment",
  "acrea_profile_restrictions",
  "programs",
  "trainings",
  "seances",
  "sessions",
  "session_feedback",
  "acrea_level_test_attempts",
  "acrea_level_test_stage_results",
  "acrea_level_evaluation_attempts",
  "acrea_level_evaluation_sessions",
  "acrea_level_evaluation_results",
  "acrea_level_evaluation_preferences",
  "acrea_exercise_progressions",
  "acrea_profile_excluded_exercises",
];

const separatedAdminMutationTables = [
  "catalog_exercise_equipment_options",
  "catalog_exercise_equipment_option_items",
  "catalog_exercises",
  "catalog_exercise_muscle_groups",
];

function readText(relativePath) {
  return fs.readFileSync(path.join(workspaceRoot, relativePath), "utf8");
}

function assert(condition, message) {
  if (!condition) {
    errors.push(message);
  }
}

function normalizedSql(text) {
  return text.toLowerCase().replace(/\s+/g, " ");
}

function escapeRegex(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function createTablePattern(tableName, psql = false) {
  const prefix = psql ? "(public\\.)?" : "";

  return new RegExp(
    `create\\s+table(?:\\s+if\\s+not\\s+exists)?\\s+${prefix}${escapeRegex(tableName)}\\b`,
    "i",
  );
}

function tableBlock(sql, tableName) {
  const match = sql.match(
    new RegExp(
      `create\\s+table(?:\\s+if\\s+not\\s+exists)?\\s+(?:public\\.)?${escapeRegex(tableName)}\\s*\\([\\s\\S]*?\\n\\s*\\);`,
      "i",
    ),
  );

  return match?.[0] ?? "";
}

function validateSchema(label, sql, { psql = false } = {}) {
  const normalized = normalizedSql(sql);

  for (const [tableName, columns] of Object.entries(tables)) {
    assert(
      createTablePattern(tableName, psql).test(sql),
      `${label}: CREATE TABLE missing for ${tableName}`,
    );

    const block = tableBlock(sql, tableName);
    assert(block, `${label}: unable to isolate table block for ${tableName}`);

    for (const column of columns) {
      assert(
        new RegExp(`\\b${escapeRegex(column)}\\b`, "i").test(block),
        `${label}: ${tableName}.${column} missing`,
      );
    }
  }

  for (const [column, reference] of expectedRelations) {
    assert(
      relationPattern(column, reference).test(sql),
      `${label}: relation ${column} -> ${reference} missing`,
    );
  }

  for (const indexName of expectedIndexes) {
    assert(
      new RegExp(
        `create\\s+(?:unique\\s+)?index(?:\\s+if\\s+not\\s+exists)?\\s+${escapeRegex(indexName)}\\b`,
        "i",
      ).test(sql),
      `${label}: index ${indexName} missing`,
    );
  }

  for (const fragment of [
    "code in ('warm-up', 'cardio', 'strength', 'proprioception', 'flexibility')",
    "difficulty between 1 and 10",
    "category in ('maison', 'sport')",
    "kind in ('bodyweight', 'equipment')",
    "format_type in ('repetitions', 'intervalles')",
    "reps is null or reps > 0",
    "level between 1 and 10",
  ]) {
    assert(
      normalized.includes(fragment),
      `${label}: check missing: ${fragment}`,
    );
  }

  for (const forbiddenTable of forbiddenTables) {
    assert(
      !createTablePattern(forbiddenTable, psql).test(sql),
      `${label}: forbidden legacy table still documented: ${forbiddenTable}`,
    );
  }

  const formatBlock = tableBlock(sql, "catalog_formats").toLowerCase();
  assert(
    !/\bpillar_id\b/.test(formatBlock),
    `${label}: catalog_formats must not contain pillar_id`,
  );
  assert(
    !formatBlock.includes("'temps'"),
    `${label}: catalog_formats must not contain legacy format_type temps`,
  );
  for (const column of [
    "series_count",
    "execution_count",
    "rest_series_seconds",
    "series_duration_seconds",
    "execution_duration_seconds",
    "rest_execution_seconds",
  ]) {
    assert(
      !new RegExp(`\\b${column}\\b`, "i").test(formatBlock),
      `${label}: catalog_formats must not contain derived column ${column}`,
    );
  }

  for (const [tableName, column] of [
    ["catalog_repetitions", "repetition_kind"],
    ["catalog_intervals", "interval_kind"],
  ]) {
    assert(
      !new RegExp(`\\b${column}\\b`, "i").test(
        tableBlock(sql, tableName).toLowerCase(),
      ),
      `${label}: ${tableName} must not contain ${column}`,
    );
  }
}

function validateWeeklyAiSchema(label, sql, { psql = false } = {}) {
  const requiredTables = {
    acrea_profiles: psql
      ? ["user_id", "objective_code", "weekly_frequency", "preferred_weekdays", "session_minutes_min", "session_minutes_max", "weekly_novelty_percent", "level_test_status"]
      : [
          "profile_id",
          "objective_code",
          "weekly_frequency",
          "preferred_weekdays_json",
          "sync_status",
          "session_minutes_min",
          "session_minutes_max",
          "weekly_novelty_percent",
          "level_test_status",
        ],
    acrea_profile_equipment: psql
      ? ["user_id", "equipment_id"]
      : ["profile_id", "equipment_id"],
    acrea_profile_restrictions: psql
      ? ["user_id", "restriction_type", "payload"]
      : ["profile_id", "restriction_type", "payload_json"],
    programs: [
      "profile_id",
      "iso_week_year",
      "iso_week_number",
      "schema_version",
      "catalog_version",
      "generated_by",
      "profile_fingerprint",
      "profile_effective_from",
      "level_evaluation_version",
    ],
    trainings: [
      "program_id",
      "status",
      "sort_order",
      "scheduled_date",
      "generation_profile_fingerprint",
    ],
    seances: ["training_id", "phase", "pillar", "sort_order"],
    sessions: [
      "seance_id",
      "session_template_id",
      "exercise_id",
      "format_id",
      psql ? "prescription" : "prescription_json",
      "phase",
      "sort_order",
    ],
    session_feedback: [
      "execution_id",
      "profile_id",
      "program_id",
      "training_id",
      "session_id",
      "session_template_id",
      "exercise_id",
      "format_id",
      "appreciation_rating",
      "session_phase",
    ],
    acrea_level_test_attempts: psql
      ? ["user_id", "protocol_version", "attempt_kind", "status"]
      : ["profile_id", "protocol_version", "attempt_kind", "status"],
    acrea_level_test_stage_results: ["attempt_id", "exercise_code", "stage", "technical_valid"],
    acrea_level_evaluation_attempts: psql
      ? ["user_id", "protocol_version", "attempt_kind", "status", "superseded_at"]
      : ["profile_id", "protocol_version", "attempt_kind", "status", "sync_status", "superseded_at"],
    acrea_level_evaluation_sessions: [
      "attempt_id",
      "phase",
      "run_number",
      "status",
      "active_step_index",
    ],
    acrea_level_evaluation_results: [
      "evaluation_session_id",
      "exercise_code",
      "technical_valid",
      "appreciation_rating",
      psql ? "prescription" : "prescription_json",
      "timer_plan_code",
    ],
    acrea_level_evaluation_preferences: psql
      ? ["user_id", "protocol_version", "evaluation_exercise_code", "catalog_exercise_code", "appreciation_average", "sample_count", "evaluated_at"]
      : ["profile_id", "protocol_version", "evaluation_exercise_code", "exercise_slug", "appreciation_average", "sample_count", "evaluated_at", "sync_status"],
    acrea_exercise_progressions: psql
      ? ["user_id", "exercise_id", "prescription", "level_evaluation_version"]
      : ["profile_id", "exercise_id", "prescription_json", "level_evaluation_version"],
    acrea_profile_excluded_exercises: psql
      ? ["user_id", "exercise_id", "reason"]
      : ["profile_id", "exercise_id", "reason"],
  };

  for (const [tableName, columns] of Object.entries(requiredTables)) {
    assert(
      createTablePattern(tableName, psql).test(sql),
      `${label}: weekly AI table missing: ${tableName}`,
    );
    const block = tableBlock(sql, tableName);
    for (const column of columns) {
      assert(
        new RegExp(`\\b${escapeRegex(column)}\\b`, "i").test(block),
        `${label}: ${tableName}.${column} missing`,
      );
    }
  }

  const normalized = normalizedSql(sql);
  for (const fragment of [
    "iso_week_year between 2000 and 9999",
    "iso_week_number between 1 and 53",
    "schema_version = 3",
    "programs_profile_iso_week_unique",
    "session_feedback_execution_unique",
  ]) {
    assert(
      normalized.includes(fragment),
      `${label}: weekly AI contract missing: ${fragment}`,
    );
  }

  if (psql) {
    for (const fragment of [
      "create or replace function public.finalize_acrea_level_evaluation",
      "attempt.protocol_version = 3",
      "expected_evaluation_results",
      "proprioception-planche-lean",
      "six v3 appreciation summaries are required",
    ]) {
      assert(
        normalized.includes(fragment),
        `${label}: strict V3 evaluation finalization missing: ${fragment}`,
      );
    }
  }

  for (const column of ["session_template_id", "exercise_id", "format_id"]) {
    const sessionBlock = tableBlock(sql, "sessions");
    assert(
      new RegExp(`\\b${column}\\b[\\s\\S]{0,120}?references`, "i").test(
        sessionBlock,
      ),
      `${label}: sessions.${column} must reference the catalog`,
    );
  }
}

function relationPattern(column, reference) {
  const psqlReference = reference.startsWith("catalog_")
    ? `(public\\.)?${escapeRegex(reference)}`
    : escapeRegex(reference);

  return new RegExp(
    `\\b${escapeRegex(column)}\\b[\\s\\S]{0,220}?references\\s+${psqlReference}`,
    "i",
  );
}

function validatePsqlSecurity(label, sql) {
  for (const tableName of Object.keys(tables)) {
    assert(
      new RegExp(
        `alter\\s+table\\s+public\\.${escapeRegex(tableName)}\\s+enable\\s+row\\s+level\\s+security`,
        "i",
      ).test(sql),
      `${label}: RLS missing for ${tableName}`,
    );
    assert(
      new RegExp(
        `grant\\s+select\\s+on\\s+(?:table\\s+)?public\\.${escapeRegex(tableName)}\\s+to\\s+anon,\\s*authenticated`,
        "i",
      ).test(sql),
      `${label}: read grant missing for ${tableName}`,
    );
    assert(
      new RegExp(
        `create\\s+policy\\s+"[^"]+\\s+are\\s+readable"\\s+on\\s+public\\.${escapeRegex(tableName)}\\s+for\\s+select\\s+to\\s+anon,\\s*authenticated\\s+using\\s+\\(true\\)`,
        "i",
      ).test(sql),
      `${label}: read policy missing for ${tableName}`,
    );
  }

  for (const tableName of weeklyRuntimeTables) {
    assert(
      new RegExp(
        `alter\\s+table\\s+public\\.${escapeRegex(tableName)}\\s+enable\\s+row\\s+level\\s+security`,
        "i",
      ).test(sql),
      `${label}: weekly runtime RLS missing for ${tableName}`,
    );
    assert(
      new RegExp(
        `grant\\s+select,\\s*insert,\\s*update,\\s*delete\\s+on\\s+(?:table\\s+)?public\\.${escapeRegex(tableName)}\\s+to\\s+authenticated`,
        "i",
      ).test(sql),
      `${label}: weekly runtime grant missing for ${tableName}`,
    );
  }

  for (const policyName of [
    "Users own ACREA profile",
    "Users own ACREA equipment",
    "Users own ACREA restrictions",
    "Users own programs",
    "Users own trainings through programs",
    "Users own seances through trainings",
    "Users own sessions through seances",
    "Users own session feedback",
  ]) {
    assert(
      sql.includes(`create policy "${policyName}"`),
      `${label}: ownership policy missing: ${policyName}`,
    );
  }

  validateAuthRoleContract(label, sql, { exerciseEditor: true });
}

function validateAuthRoleContract(
  label,
  sql,
  { accountType = "basic", exerciseEditor = false } = {},
) {
  const normalized = normalizedSql(sql);
  const profileBlock = tableBlock(sql, "user_profiles");

  assert(profileBlock, `${label}: CREATE TABLE missing for user_profiles`);
  for (const column of userProfileColumns) {
    assert(
      new RegExp(`\\b${escapeRegex(column)}\\b`, "i").test(profileBlock),
      `${label}: user_profiles.${column} missing`,
    );
  }

  for (const fragment of [
    `create type public.user_account_type as enum ('admin', 'premium', '${accountType}')`,
    `account_type public.user_account_type not null default '${accountType}'`,
    "references auth.users(id) on delete cascade",
    "create or replace function private.sync_auth_user_profile()",
    "create or replace function private.is_admin()",
    "security definer set search_path = ''",
    "create trigger on_auth_user_changed_sync_profile",
    "alter table public.user_profiles enable row level security",
    "grant select on table public.user_profiles to authenticated",
    "grant update (display_name) on table public.user_profiles to authenticated",
    "using (id = (select auth.uid()))",
    "create or replace function public.admin_upsert_catalog_session_template(",
  ]) {
    assert(
      normalized.includes(fragment),
      `${label}: auth contract missing: ${fragment}`,
    );
  }

  assert(
    !/grant\s+update\s*\([^)]*account_type/i.test(sql),
    `${label}: account_type must not be client-updatable`,
  );

  for (const tableName of adminMutableCatalogTables) {
    assert(
      new RegExp(
        `grant\\s+insert,\\s*update,\\s*delete\\s+on\\s+table\\s+public\\.${escapeRegex(tableName)}\\s+to\\s+authenticated`,
        "i",
      ).test(sql),
      `${label}: admin mutation grant missing for ${tableName}`,
    );
    assert(
      new RegExp(
        `create\\s+policy\\s+"Admins can mutate ${escapeRegex(tableName)}"[\\s\\S]*?on\\s+public\\.${escapeRegex(tableName)}\\s+for\\s+all[\\s\\S]*?private\\.is_admin\\(\\)`,
        "i",
      ).test(sql),
      `${label}: admin mutation policy missing for ${tableName}`,
    );
  }

  if (!exerciseEditor) {
    return;
  }

  for (const tableName of separatedAdminMutationTables) {
    assert(
      new RegExp(
        `grant\\s+insert,\\s*update,\\s*delete\\s+on\\s+(?:table\\s+)?public\\.${escapeRegex(tableName)}\\s+to\\s+authenticated`,
        "i",
      ).test(sql),
      `${label}: exercise editor grant missing for ${tableName}`,
    );
  }

  for (const [policyLabel, tableName] of [
    ["equipment options", "catalog_exercise_equipment_options"],
    ["equipment option items", "catalog_exercise_equipment_option_items"],
    ["catalog exercises", "catalog_exercises"],
    ["catalog exercise muscle groups", "catalog_exercise_muscle_groups"],
  ]) {
    for (const operation of ["insert", "update", "delete"]) {
      assert(
        new RegExp(
          `create\\s+policy\\s+"Admins ${operation} ${escapeRegex(policyLabel)}"\\s+on\\s+public\\.${escapeRegex(tableName)}\\s+for\\s+${operation}[\\s\\S]{0,180}?private\\.is_admin\\(\\)`,
          "i",
        ).test(sql),
        `${label}: separated admin ${operation} policy missing for ${tableName}`,
      );
    }
  }
}

function validateActiveMigrations() {
  const absoluteMigrationDir = path.join(workspaceRoot, activeMigrationDir);
  const migrationFiles = fs.existsSync(absoluteMigrationDir)
    ? fs
        .readdirSync(absoluteMigrationDir)
        .filter((file) => file.endsWith(".sql"))
        .sort()
    : [];
  const roleMigrations = migrationFiles.filter((file) =>
    file.endsWith(roleMigrationSuffix),
  );
  const accountTypeRenameMigrations = migrationFiles.filter((file) =>
    file.endsWith(accountTypeRenameMigrationSuffix),
  );
  const resetMigration = migrationFiles.find((file) =>
    file.endsWith("_reset_catalog_foundation.sql"),
  );
  const bootstrapMigrations = migrationFiles.filter((file) =>
    file.endsWith(bootstrapMigrationSuffix),
  );
  const weeklyAiMigrations = migrationFiles.filter((file) =>
    file.endsWith(weeklyAiMigrationSuffix),
  );
  const equipmentV2Migrations = migrationFiles.filter((file) =>
    file.endsWith(equipmentV2MigrationSuffix),
  );
  const weeklyAiV3Migrations = migrationFiles.filter((file) =>
    file.endsWith(weeklyAiV3MigrationSuffix),
  );
  const levelEvaluationV2Migrations = migrationFiles.filter((file) =>
    file.endsWith(levelEvaluationV2MigrationSuffix),
  );
  const levelEvaluationV3Migrations = migrationFiles.filter((file) =>
    file.endsWith(levelEvaluationV3MigrationSuffix),
  );

  assert(
    roleMigrations.length === 1,
    `supabase migrations: expected one role migration, found ${roleMigrations.length}`,
  );
  assert(
    accountTypeRenameMigrations.length === 1,
    `supabase migrations: expected one account-type rename migration, found ${accountTypeRenameMigrations.length}`,
  );
  assert(
    resetMigration,
    "supabase migrations: catalog reset migration missing",
  );
  assert(
    bootstrapMigrations.length === 1,
    `supabase migrations: expected one empty-catalog bootstrap migration, found ${bootstrapMigrations.length}`,
  );
  assert(
    weeklyAiMigrations.length === 1,
    `supabase migrations: expected one weekly AI migration, found ${weeklyAiMigrations.length}`,
  );
  assert(
    equipmentV2Migrations.length === 1,
    `supabase migrations: expected one equipment v2 migration, found ${equipmentV2Migrations.length}`,
  );
  assert(
    weeklyAiV3Migrations.length === 1,
    `supabase migrations: expected one weekly AI v3 migration, found ${weeklyAiV3Migrations.length}`,
  );
  assert(
    levelEvaluationV2Migrations.length === 1,
    `supabase migrations: expected one level evaluation v2 migration, found ${levelEvaluationV2Migrations.length}`,
  );
  assert(
    levelEvaluationV3Migrations.length === 1,
    `supabase migrations: expected one level evaluation v3 migration, found ${levelEvaluationV3Migrations.length}`,
  );

  if (weeklyAiMigrations.length === 1) {
    const weeklyAiText = normalizedSql(
      readText(path.join(activeMigrationDir, weeklyAiMigrations[0])),
    );
    for (const fragment of [
      "create table if not exists public.acrea_profiles",
      "programs_profile_iso_week_unique",
      "session_feedback_execution_unique",
      "sessions_session_template_fk",
      "session_feedback_format_fk",
      'create policy "users own trainings through programs"',
      "schema_version = 2",
    ]) {
      assert(
        weeklyAiText.includes(fragment),
        `supabase weekly AI migration: missing ${fragment}`,
      );
    }
  }

  if (equipmentV2Migrations.length === 1) {
    const equipmentV2Text = normalizedSql(
      readText(path.join(activeMigrationDir, equipmentV2Migrations[0])),
    );
    for (const fragment of [
      "create temporary table weekly_equipment_requirements",
      "expected 236 exercises",
      "expected 35 historical mappings",
      "expected 24 canonical equipment",
      "catalog_exercise_equipment_options",
      "admins insert catalog exercises",
      "admin_upsert_catalog_exercise_v2",
      "commit;",
    ]) {
      assert(
        equipmentV2Text.includes(fragment),
        `supabase equipment v2 migration: missing ${fragment}`,
      );
    }
  }

  if (weeklyAiV3Migrations.length === 1) {
    const weeklyAiV3Text = normalizedSql(
      readText(path.join(activeMigrationDir, weeklyAiV3Migrations[0])),
    );
    for (const fragment of [
      "schema_version = 3",
      "create table if not exists public.acrea_level_test_attempts",
      "create table if not exists public.acrea_level_test_stage_results",
      "create table if not exists public.acrea_exercise_progressions",
      "create table if not exists public.acrea_profile_excluded_exercises",
      "grant select, insert, update, delete on public.acrea_level_test_attempts to authenticated",
      'create policy "users own acrea level test attempts"',
      "create or replace function public.finalize_acrea_level_test",
      "grant execute on function public.finalize_acrea_level_test(bigint) to authenticated",
      "appreciation_rating",
      "prescription jsonb",
      "commit;",
    ]) {
      assert(
        weeklyAiV3Text.includes(fragment),
        `supabase weekly AI v3 migration: missing ${fragment}`,
      );
    }
  }

  if (levelEvaluationV2Migrations.length === 1) {
    const levelEvaluationV2Text = normalizedSql(
      readText(path.join(activeMigrationDir, levelEvaluationV2Migrations[0])),
    );
    for (const fragment of [
      "level_evaluation_version",
      "create table public.acrea_level_evaluation_attempts",
      "create table public.acrea_level_evaluation_sessions",
      "create table public.acrea_level_evaluation_results",
      "protocol_version >= 2",
      "active_step_index between 0 and 12",
      "grant select, insert, update, delete on public.acrea_level_evaluation_attempts to authenticated",
      'create policy "users select own level evaluation attempts"',
      "create or replace function public.finalize_acrea_level_evaluation",
      "grant execute on function public.finalize_acrea_level_evaluation(bigint) to authenticated",
      "commit;",
    ]) {
      assert(
        levelEvaluationV2Text.includes(fragment),
        `supabase level evaluation v2 migration: missing ${fragment}`,
      );
    }
  }

  if (levelEvaluationV3Migrations.length === 1) {
    const levelEvaluationV3Text = normalizedSql(
      readText(path.join(activeMigrationDir, levelEvaluationV3Migrations[0])),
    );
    for (const fragment of [
      "level_evaluation_version",
      "create table public.acrea_level_evaluation_preferences",
      "protocol_version = 3",
      "expected 2219 canonical formats",
      "proprioception-planche-lean",
      "grant select, insert, update, delete on public.acrea_level_evaluation_preferences to authenticated",
      'create policy "users select own level evaluation preferences"',
      "create or replace function public.finalize_acrea_level_evaluation",
      "six v3 appreciation summaries are required",
      "commit;",
    ]) {
      assert(
        levelEvaluationV3Text.includes(fragment),
        `supabase level evaluation v3 migration: missing ${fragment}`,
      );
    }
  }

  if (roleMigrations.length === 1) {
    const roleMigration = roleMigrations[0];
    const migrationText = readText(
      path.join(activeMigrationDir, roleMigration),
    );

    assert(
      !resetMigration || roleMigration > resetMigration,
      `supabase migrations: ${roleMigration} must run after ${resetMigration}`,
    );
    validateAuthRoleContract(
      `supabase migration ${roleMigration}`,
      migrationText,
      { accountType: "free" },
    );
  }

  if (accountTypeRenameMigrations.length === 1) {
    const accountTypeRenameMigration = accountTypeRenameMigrations[0];
    const migrationText = normalizedSql(
      readText(path.join(activeMigrationDir, accountTypeRenameMigration)),
    );

    assert(
      roleMigrations.length !== 1 ||
        accountTypeRenameMigration > roleMigrations[0],
      `supabase migrations: ${accountTypeRenameMigration} must run after the role bootstrap migration`,
    );
    for (const fragment of [
      "alter type public.user_account_type rename value 'free' to 'basic'",
      "alter column account_type set default 'basic'",
      "create or replace function private.sync_auth_user_profile()",
      "revoke all on function private.sync_auth_user_profile() from public",
    ]) {
      assert(
        migrationText.includes(fragment),
        `supabase account-type rename migration: missing ${fragment}`,
      );
    }
    assert(
      !/grant\s+update\s*\([^)]*account_type/i.test(migrationText),
      "supabase account-type rename migration: account_type must not become client-updatable",
    );
  }

  for (const migrationFile of migrationFiles) {
    const migrationText = readText(
      path.join(activeMigrationDir, migrationFile),
    );
    const dropsAllPublicTables =
      /from\s+pg_tables[\s\S]*?where\s+schemaname\s*=\s*'public'[\s\S]*?drop\s+table/i.test(
        migrationText,
      );

    assert(
      !dropsAllPublicTables || migrationFile === historicalDestructiveMigration,
      `supabase migrations: destructive public schema reset forbidden in ${migrationFile}`,
    );

    assert(
      !/^\s*--[^\n]*local only/im.test(migrationText) ||
        migrationFile === historicalDestructiveMigration,
      `supabase migrations: local-only SQL forbidden in active migration ${migrationFile}`,
    );
  }

  if (bootstrapMigrations.length === 1) {
    const bootstrapText = readText(
      path.join(activeMigrationDir, bootstrapMigrations[0]),
    );
    const seedText = readText(
      "apps/pwa/supabase/legacy-catalog-seed.sql",
    ).trimEnd();
    const seedMarker = "-- ACREA Fitness - seed base formats metier";
    const markerIndex = bootstrapText.indexOf(seedMarker);

    assert(
      markerIndex >= 0,
      "supabase migrations: bootstrap seed marker missing",
    );
    if (markerIndex >= 0) {
      assert(
        bootstrapText.slice(markerIndex).trimEnd() === seedText,
        "supabase migrations: bootstrap catalogue data differs from frozen legacy-catalog-seed.sql",
      );
    }
    assert(
      bootstrapText.includes("if existing_rows <> 0 then"),
      "supabase migrations: bootstrap must reject a non-empty catalogue",
    );
  }

  const activeSeed = normalizedSql(readText("apps/pwa/supabase/seed.sql"));
  for (const fragment of [
    "generated by scripts/generate-supabase-v2-seed.mjs",
    "structural data only",
    "insert into public.catalog_equipment",
    "structural seed did not upsert 25 canonical equipment rows",
  ]) {
    assert(
      activeSeed.includes(fragment),
      `supabase structural seed: missing ${fragment}`,
    );
  }
  for (const forbidden of [
    "v2 seed expected 236 exercises",
    "did not produce 24 canonical equipment rows",
  ]) {
    assert(
      !activeSeed.includes(forbidden),
      `supabase structural seed: legacy assertion remains: ${forbidden}`,
    );
  }

  const supabaseConfig = readText("apps/pwa/supabase/config.toml");
  assert(
    supabaseConfig.includes(
      'sql_paths = ["./seed.sql", "./demo-user.sql"]',
    ),
    "supabase config: only structural and demo seeds may run after the versioned V2 catalogue migration",
  );
}

function validateRuntimeSqliteSchema(runtimeText) {
  validateSchema("sqlite runtime", runtimeText);

  for (const forbidden of [
    "format_type IN ('repetitions', 'temps')",
    "pillar_id INTEGER,",
  ]) {
    assert(
      !runtimeText.includes(forbidden),
      `sqlite runtime: forbidden legacy fragment remains: ${forbidden}`,
    );
  }

  assert(
    !createTablePattern("user_profiles").test(runtimeText),
    "sqlite runtime: user_profiles and roles must remain remote-only",
  );
}

function main() {
  const psqlDoc = readText(psqlDocPath);
  const sqliteDoc = readText(sqliteDocPath);
  const psqlReset = readText(psqlResetPath);
  const sqliteRuntime = readText(sqliteRuntimePath);

  validateSchema(psqlDocPath, psqlDoc, { psql: true });
  validateSchema(sqliteDocPath, sqliteDoc);
  validateSchema(psqlResetPath, psqlReset, { psql: true });
  validateRuntimeSqliteSchema(sqliteRuntime);
  validateWeeklyAiSchema(psqlDocPath, psqlDoc, { psql: true });
  validateWeeklyAiSchema(sqliteDocPath, sqliteDoc);
  validateWeeklyAiSchema("sqlite runtime", sqliteRuntime);
  validatePsqlSecurity(psqlDocPath, psqlDoc);
  validatePsqlSecurity(psqlResetPath, psqlReset);
  validateActiveMigrations();

  assert(
    !createTablePattern("user_profiles").test(sqliteDoc),
    `${sqliteDocPath}: user_profiles and roles must remain remote-only`,
  );

  for (const [label, text] of [
    [psqlDocPath, psqlDoc],
    [sqliteDocPath, sqliteDoc],
    [psqlResetPath, psqlReset],
  ]) {
    const lower = text.toLowerCase();

    for (const forbidden of ["hiit", "callisthenie"]) {
      assert(
        !lower.includes(forbidden),
        `${label}: forbidden active value ${forbidden}`,
      );
    }
  }
}

main();

if (errors.length > 0) {
  console.error("db:docs:check failed:");
  for (const error of errors) {
    console.error(`- ${error}`);
  }
  process.exit(1);
}

console.log("db:docs:check passed");
