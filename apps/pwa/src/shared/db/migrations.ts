import type { LocalDatabase } from "./localDatabase";

export const localDatabaseSchemaVersion = 33;

export async function runLocalDatabaseMigrations(db: LocalDatabase) {
  const sourceVersion = await readLocalDatabaseSchemaVersion(db);
  if (sourceVersion > localDatabaseSchemaVersion) {
    throw new Error(
      `La base SQLite locale utilise une version plus recente (${sourceVersion}) que cette application (${localDatabaseSchemaVersion}).`,
    );
  }

  // Certaines installations v32 conservent un vocabulaire V1, ou la forme
  // antérieure du snapshot de programme. Réparer cette forme avant V33 garde
  // les identifiants et toutes les données de profil/évaluation.
  if (sourceVersion === 32) {
    const repairPillars = await hasOutdatedCatalogPillarVocabulary(db);
    const repairEquipment = await hasOutdatedCatalogEquipmentVocabulary(db);
    const repairOrphanedEquipmentOptionItems =
      await hasOrphanedCatalogEquipmentOptionItems(db);
    const repairWeeklyProgramSnapshot =
      await hasOutdatedWeeklyProgramSnapshotSchema(db);
    if (
      repairPillars ||
      repairEquipment ||
      repairOrphanedEquipmentOptionItems ||
      repairWeeklyProgramSnapshot
    ) {
      await db.execAsync("PRAGMA foreign_keys = OFF;");
      try {
        await db.withTransactionAsync(async () => {
          if (repairPillars) {
            await repairOutdatedCatalogPillarVocabulary(db);
          }
          if (repairEquipment) {
            await repairOutdatedCatalogEquipmentVocabulary(db);
          }
          if (repairOrphanedEquipmentOptionItems) {
            await repairOrphanedCatalogEquipmentOptionItems(db);
          }
          if (repairWeeklyProgramSnapshot) {
            await repairOutdatedWeeklyProgramSnapshotSchema(db);
          }
        });
        await assertNoForeignKeyViolations(db);
      } finally {
        await db.execAsync("PRAGMA foreign_keys = ON;");
      }
    }
  }

  if (sourceVersion === 32) {
    await db.execAsync("PRAGMA foreign_keys = OFF;");
    try {
      await db.execAsync("PRAGMA journal_mode = WAL;");
      await db.withTransactionAsync(async () => {
        await migrateProgressiveCatalogV33(db, sourceVersion);
        await assertNoForeignKeyViolations(db);
        await db.execAsync(`PRAGMA user_version = ${localDatabaseSchemaVersion};`);
      });
    } finally {
      await db.execAsync("PRAGMA foreign_keys = ON;");
    }
    return;
  }

  if (sourceVersion === localDatabaseSchemaVersion) {
    return;
  }

  await db.execAsync("PRAGMA foreign_keys = OFF;");
  try {
    await db.execAsync("PRAGMA journal_mode = WAL;");
    await db.withTransactionAsync(async () => {
      await migrateLocalDatabaseSchema(db);
    });
  } finally {
    await db.execAsync("PRAGMA foreign_keys = ON;");
  }
}

async function migrateLocalDatabaseSchema(db: LocalDatabase) {
  const sourceVersion = await readLocalDatabaseSchemaVersion(db);
  if (sourceVersion > localDatabaseSchemaVersion) {
    throw new Error(
      `La base SQLite locale utilise une version plus recente (${sourceVersion}) que cette application (${localDatabaseSchemaVersion}).`,
    );
  }
  await archiveActiveV2Programs(db);
  await prepareLegacyWeeklyAndProfileMigration(db);
  if (await tableExists(db, "session_feedback_migration_archive")) {
    await ensureColumn(
      db,
      "session_feedback_migration_archive",
      "restored_at",
      "TEXT",
    );
    await ensureColumn(
      db,
      "session_feedback_migration_archive",
      "restore_error",
      "TEXT",
    );
  }
  await resetLegacyTextIdTables(db);
  await resetLegacyCatalogShapeTables(db);
  await dropLegacyTables(db);

  await db.execAsync(`
    CREATE TABLE IF NOT EXISTS catalog_pillars (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      code TEXT NOT NULL UNIQUE CHECK (
        code IN ('warm-up', 'cardio', 'strength', 'proprioception', 'flexibility')
      ),
      label TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS catalog_impacts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      code TEXT NOT NULL UNIQUE CHECK (code IN ('faible', 'modere', 'eleve')),
      label TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS catalog_families (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      code TEXT NOT NULL UNIQUE CHECK (
        code IN ('corps-entier', 'haut-du-corps', 'bas-du-corps')
      ),
      label TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS catalog_types (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      code TEXT NOT NULL UNIQUE CHECK (
        code IN ('echauffement', 'cardio', 'gainage', 'force', 'endurance', 'proprioception', 'assouplissement')
      ),
      label TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS catalog_muscle_groups (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      code TEXT NOT NULL UNIQUE CHECK (
        code IN ('bras', 'epaules', 'dos', 'jambes', 'fessiers', 'abdos', 'pecs')
      ),
      label TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS catalog_equipment (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      code TEXT NOT NULL UNIQUE,
      label TEXT NOT NULL,
      category TEXT NOT NULL CHECK (category IN ('maison', 'sport'))
    );

    CREATE TABLE IF NOT EXISTS catalog_releases (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      code TEXT NOT NULL UNIQUE,
      source TEXT NOT NULL,
      source_revision TEXT NOT NULL DEFAULT '',
      locale TEXT NOT NULL DEFAULT 'fr',
      expected_exercise_count INTEGER NOT NULL CHECK (expected_exercise_count >= 0),
      status TEXT NOT NULL CHECK (status IN ('prepared', 'active', 'archived')),
      license_id TEXT,
      activation_backup_reference TEXT,
      activation_diff_reference TEXT,
      created_at TEXT NOT NULL,
      activated_at TEXT,
      archived_at TEXT,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS catalog_exercises (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      code TEXT NOT NULL UNIQUE,
      label TEXT NOT NULL,
      release_id INTEGER REFERENCES catalog_releases(id) ON DELETE RESTRICT,
      source_key TEXT,
      source_url TEXT NOT NULL DEFAULT '',
      source_category TEXT NOT NULL DEFAULT '',
      source_language TEXT NOT NULL DEFAULT 'fr',
      locale TEXT NOT NULL DEFAULT 'fr',
      pillar_id INTEGER NOT NULL REFERENCES catalog_pillars(id) ON DELETE RESTRICT,
      difficulty INTEGER NOT NULL CHECK (difficulty BETWEEN 1 AND 10),
      impact_id INTEGER NOT NULL REFERENCES catalog_impacts(id) ON DELETE RESTRICT,
      family_id INTEGER NOT NULL REFERENCES catalog_families(id) ON DELETE RESTRICT,
      type_id INTEGER NOT NULL REFERENCES catalog_types(id) ON DELETE RESTRICT,
      equipment_id INTEGER REFERENCES catalog_equipment(id) ON DELETE RESTRICT,
      regression_exercise_id INTEGER REFERENCES catalog_exercises(id) ON DELETE SET NULL,
      progression_exercise_id INTEGER REFERENCES catalog_exercises(id) ON DELETE SET NULL,
      movement_description TEXT NOT NULL DEFAULT '',
      start_position TEXT NOT NULL DEFAULT '',
      outbound_execution TEXT NOT NULL DEFAULT '',
      return_execution TEXT NOT NULL DEFAULT '',
      adapted_version TEXT NOT NULL DEFAULT '',
      tips TEXT NOT NULL DEFAULT '',
      errors TEXT NOT NULL DEFAULT '',
      is_active INTEGER NOT NULL DEFAULT 1 CHECK (is_active IN (0, 1)),
      review_status TEXT NOT NULL DEFAULT 'a_verifier' CHECK (
        review_status IN ('a_verifier', 'valide', 'a_revoir')
      ),
      translation_status TEXT NOT NULL DEFAULT 'source_only' CHECK (
        translation_status IN ('source_only', 'translated', 'validated')
      ),
      programming_status TEXT NOT NULL DEFAULT 'library_only' CHECK (
        programming_status IN ('library_only', 'eligible', 'blocked')
      ),
      archived_at TEXT,
      admin_overridden_at TEXT,
      updated_at TEXT NOT NULL DEFAULT ''
    );

    CREATE TABLE IF NOT EXISTS catalog_exercise_muscle_groups (
      exercise_id INTEGER NOT NULL REFERENCES catalog_exercises(id) ON DELETE CASCADE,
      muscle_group_id INTEGER NOT NULL REFERENCES catalog_muscle_groups(id) ON DELETE CASCADE,
      PRIMARY KEY (exercise_id, muscle_group_id)
    );

    CREATE TABLE IF NOT EXISTS catalog_exercise_equipment_options (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      exercise_id INTEGER NOT NULL REFERENCES catalog_exercises(id) ON DELETE CASCADE,
      option_index INTEGER NOT NULL CHECK (option_index >= 0),
      kind TEXT NOT NULL CHECK (kind IN ('bodyweight', 'equipment')),
      UNIQUE (exercise_id, option_index)
    );

    CREATE TABLE IF NOT EXISTS catalog_exercise_equipment_option_items (
      option_id INTEGER NOT NULL REFERENCES catalog_exercise_equipment_options(id) ON DELETE CASCADE,
      equipment_id INTEGER NOT NULL REFERENCES catalog_equipment(id) ON DELETE RESTRICT,
      PRIMARY KEY (option_id, equipment_id)
    );

    CREATE TABLE IF NOT EXISTS catalog_exercise_media (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      exercise_id INTEGER NOT NULL REFERENCES catalog_exercises(id) ON DELETE CASCADE,
      kind TEXT NOT NULL CHECK (kind IN ('poster', 'animation')),
      uri TEXT NOT NULL,
      file_name TEXT NOT NULL,
      mime_type TEXT NOT NULL DEFAULT 'image/webp' CHECK (mime_type = 'image/webp'),
      width INTEGER NOT NULL CHECK (width > 0),
      height INTEGER NOT NULL CHECK (height > 0),
      frame_count INTEGER NOT NULL CHECK (frame_count > 0),
      loop_count INTEGER CHECK (loop_count IS NULL OR loop_count >= 0),
      sha256 TEXT,
      source_url TEXT,
      status TEXT NOT NULL CHECK (status IN ('ready', 'missing', 'invalid')),
      updated_at TEXT NOT NULL,
      UNIQUE (exercise_id, kind)
    );

    CREATE TABLE IF NOT EXISTS catalog_exercise_successors (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      legacy_exercise_id INTEGER NOT NULL REFERENCES catalog_exercises(id) ON DELETE RESTRICT,
      successor_source_key TEXT NOT NULL,
      successor_exercise_id INTEGER REFERENCES catalog_exercises(id) ON DELETE RESTRICT,
      mapping_kind TEXT NOT NULL CHECK (
        mapping_kind IN ('exact', 'protocol_variant', 'related')
      ),
      confidence TEXT NOT NULL CHECK (confidence IN ('high', 'medium', 'low')),
      protocol_variant TEXT,
      resolution_status TEXT NOT NULL DEFAULT 'pending' CHECK (
        resolution_status IN ('pending', 'resolved', 'rejected')
      ),
      source_status TEXT NOT NULL,
      validated_at TEXT,
      updated_at TEXT NOT NULL,
      UNIQUE (legacy_exercise_id, successor_source_key)
    );

    CREATE TABLE IF NOT EXISTS acrea_level_evaluation_exercise_mappings (
      protocol_version INTEGER NOT NULL CHECK (protocol_version >= 4),
      evaluation_exercise_code TEXT NOT NULL,
      exercise_slug TEXT NOT NULL
        REFERENCES catalog_exercises(code) ON DELETE RESTRICT,
      pillar TEXT NOT NULL CHECK (
        pillar IN ('strength', 'cardio', 'proprioception')
      ),
      protocol_variant TEXT NOT NULL,
      confidence TEXT NOT NULL CHECK (confidence IN ('high', 'medium')),
      count_unit TEXT NOT NULL DEFAULT 'reps' CHECK (count_unit = 'reps'),
      phase_1_series INTEGER NOT NULL CHECK (phase_1_series > 0),
      phase_1_repetitions INTEGER NOT NULL CHECK (phase_1_repetitions > 0),
      phase_2_series INTEGER NOT NULL CHECK (phase_2_series > 0),
      phase_2_repetitions INTEGER NOT NULL CHECK (phase_2_repetitions > 0),
      phase_3_series INTEGER NOT NULL DEFAULT 1 CHECK (phase_3_series = 1),
      level_2_minimum INTEGER NOT NULL CHECK (level_2_minimum >= 0),
      level_3_minimum INTEGER NOT NULL CHECK (level_3_minimum > level_2_minimum),
      validated_at TEXT,
      updated_at TEXT NOT NULL,
      PRIMARY KEY (protocol_version, evaluation_exercise_code),
      UNIQUE (protocol_version, exercise_slug)
    );

    CREATE TABLE IF NOT EXISTS acrea_level_evaluation_legacy_aliases (
      evaluation_exercise_code TEXT PRIMARY KEY,
      legacy_catalog_exercise_code TEXT NOT NULL,
      successor_source_key TEXT NOT NULL,
      successor_exercise_id INTEGER
        REFERENCES catalog_exercises(id) ON DELETE RESTRICT,
      protocol_variant TEXT NOT NULL,
      active_in_protocol INTEGER NOT NULL DEFAULT 0 CHECK (
        active_in_protocol IN (0, 1)
      ),
      validated_at TEXT,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS catalog_release_activations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      target_release_id INTEGER NOT NULL
        REFERENCES catalog_releases(id) ON DELETE RESTRICT,
      license_id TEXT NOT NULL,
      backup_reference TEXT NOT NULL,
      diff_reference TEXT NOT NULL,
      activated_at TEXT NOT NULL,
      rolled_back_at TEXT,
      rollback_reference TEXT
    );

    CREATE TABLE IF NOT EXISTS catalog_release_activation_release_states (
      activation_id INTEGER NOT NULL
        REFERENCES catalog_release_activations(id) ON DELETE RESTRICT,
      release_id INTEGER NOT NULL
        REFERENCES catalog_releases(id) ON DELETE RESTRICT,
      status TEXT NOT NULL CHECK (status IN ('prepared', 'active', 'archived')),
      license_id TEXT,
      activation_backup_reference TEXT,
      activation_diff_reference TEXT,
      activated_at TEXT,
      archived_at TEXT,
      updated_at TEXT NOT NULL,
      PRIMARY KEY (activation_id, release_id)
    );

    CREATE TABLE IF NOT EXISTS catalog_release_activation_exercise_states (
      activation_id INTEGER NOT NULL
        REFERENCES catalog_release_activations(id) ON DELETE RESTRICT,
      exercise_id INTEGER NOT NULL
        REFERENCES catalog_exercises(id) ON DELETE RESTRICT,
      release_id INTEGER NOT NULL
        REFERENCES catalog_releases(id) ON DELETE RESTRICT,
      is_active INTEGER NOT NULL CHECK (is_active IN (0, 1)),
      archived_at TEXT,
      updated_at TEXT NOT NULL,
      PRIMARY KEY (activation_id, exercise_id)
    );

    CREATE TABLE IF NOT EXISTS catalog_series (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      code TEXT NOT NULL UNIQUE,
      label TEXT NOT NULL,
      series INTEGER NOT NULL CHECK (series > 0),
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS catalog_repetitions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      code TEXT NOT NULL UNIQUE,
      label TEXT NOT NULL,
      reps INTEGER CHECK (reps IS NULL OR reps > 0),
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS catalog_rests (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      code TEXT NOT NULL UNIQUE,
      label TEXT NOT NULL,
      rest_seconds INTEGER NOT NULL CHECK (rest_seconds >= 0),
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS catalog_intervals (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      code TEXT NOT NULL UNIQUE,
      label TEXT NOT NULL,
      effort_seconds INTEGER NOT NULL CHECK (effort_seconds > 0),
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS catalog_formats (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      code TEXT NOT NULL UNIQUE,
      format_type TEXT NOT NULL CHECK (format_type IN ('repetitions', 'intervalles')),
      series_id INTEGER NOT NULL REFERENCES catalog_series(id) ON DELETE RESTRICT,
      repetitions_id INTEGER REFERENCES catalog_repetitions(id) ON DELETE RESTRICT,
      rest_id INTEGER NOT NULL REFERENCES catalog_rests(id) ON DELETE RESTRICT,
      interval_id INTEGER REFERENCES catalog_intervals(id) ON DELETE RESTRICT,
      label TEXT NOT NULL,
      description TEXT NOT NULL DEFAULT '',
      source_status TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      CHECK (
        (
          format_type = 'repetitions'
          AND repetitions_id IS NOT NULL
          AND interval_id IS NULL
        )
        OR
        (
          format_type = 'intervalles'
          AND interval_id IS NOT NULL
          AND repetitions_id IS NULL
        )
      )
    );

    CREATE TABLE IF NOT EXISTS catalog_session_templates (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      code TEXT NOT NULL UNIQUE,
      title TEXT NOT NULL,
      description TEXT NOT NULL DEFAULT '',
      exercise_id INTEGER NOT NULL REFERENCES catalog_exercises(id) ON DELETE RESTRICT,
      phase TEXT NOT NULL DEFAULT 'main' CHECK (phase IN ('warmup', 'main', 'cooldown')),
      is_active INTEGER NOT NULL DEFAULT 1 CHECK (is_active IN (0, 1)),
      source_status TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS catalog_session_template_levels (
      session_template_id INTEGER NOT NULL REFERENCES catalog_session_templates(id) ON DELETE CASCADE,
      level INTEGER NOT NULL CHECK (level BETWEEN 1 AND 10),
      updated_at TEXT NOT NULL,
      PRIMARY KEY (session_template_id, level)
    );

    CREATE TABLE IF NOT EXISTS sync_metadata (
      key TEXT PRIMARY KEY NOT NULL,
      catalog_last_attempt_at TEXT,
      catalog_last_success_at TEXT,
      catalog_last_error TEXT
    );

    INSERT OR IGNORE INTO sync_metadata (key)
    VALUES ('catalog');

    CREATE TABLE IF NOT EXISTS programs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      profile_id TEXT NOT NULL REFERENCES acrea_profiles(profile_id) ON DELETE CASCADE,
      iso_week_year INTEGER NOT NULL CHECK (iso_week_year BETWEEN 2000 AND 9999),
      iso_week_number INTEGER NOT NULL CHECK (iso_week_number BETWEEN 1 AND 53),
      role TEXT NOT NULL,
      generated_by TEXT NOT NULL DEFAULT 'local',
      schema_version INTEGER NOT NULL DEFAULT 3 CHECK (schema_version = 3),
      catalog_version TEXT NOT NULL DEFAULT 'unknown',
      validation_focus TEXT NOT NULL DEFAULT '',
      profile_fingerprint TEXT,
      profile_effective_from TEXT,
      level_evaluation_version INTEGER NOT NULL DEFAULT 0 CHECK (level_evaluation_version >= 0),
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      UNIQUE (profile_id, iso_week_year, iso_week_number)
    );

    CREATE TABLE IF NOT EXISTS trainings (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      program_id INTEGER NOT NULL REFERENCES programs(id) ON DELETE CASCADE,
      code TEXT NOT NULL,
      day_label TEXT NOT NULL,
      title TEXT NOT NULL,
      dominant_pillar TEXT NOT NULL CHECK (
        dominant_pillar IN ('strength', 'cardio', 'proprioception')
      ),
      duration_minutes INTEGER NOT NULL CHECK (duration_minutes > 0),
      status TEXT NOT NULL DEFAULT 'a faire' CHECK (
        status IN ('a faire', 'terminee', 'reportee')
      ),
      scheduled_date TEXT,
      generation_profile_fingerprint TEXT,
      sort_order INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      UNIQUE (program_id, code)
    );

    CREATE TABLE IF NOT EXISTS seances (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      training_id INTEGER NOT NULL REFERENCES trainings(id) ON DELETE CASCADE,
      code TEXT NOT NULL,
      phase TEXT NOT NULL CHECK (phase IN ('warmup', 'main', 'cooldown')),
      pillar TEXT CHECK (pillar IN ('strength', 'cardio', 'proprioception')),
      title TEXT NOT NULL,
      sort_order INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      UNIQUE (training_id, code)
    );

    CREATE TABLE IF NOT EXISTS sessions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      seance_id INTEGER NOT NULL REFERENCES seances(id) ON DELETE CASCADE,
      code TEXT NOT NULL,
      session_template_id INTEGER NOT NULL REFERENCES catalog_session_templates(id) ON DELETE RESTRICT,
      exercise_id INTEGER NOT NULL REFERENCES catalog_exercises(id) ON DELETE RESTRICT,
      exercise_code TEXT,
      exercise_name TEXT NOT NULL,
      format_id INTEGER NOT NULL REFERENCES catalog_formats(id) ON DELETE RESTRICT,
      format_code TEXT,
      format_label TEXT NOT NULL,
      phase TEXT NOT NULL CHECK (phase IN ('warmup', 'main', 'cooldown')),
      prescription_json TEXT NOT NULL,
      level INTEGER NOT NULL CHECK (level BETWEEN 1 AND 10),
      easier_json TEXT NOT NULL DEFAULT '{}',
      harder_json TEXT NOT NULL DEFAULT '{}',
      safety_rule TEXT NOT NULL DEFAULT '',
      sort_order INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      UNIQUE (seance_id, code)
    );

    CREATE TABLE IF NOT EXISTS session_feedback (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      execution_id TEXT NOT NULL UNIQUE,
      profile_id TEXT NOT NULL REFERENCES acrea_profiles(profile_id) ON DELETE CASCADE,
      program_id INTEGER REFERENCES programs(id) ON DELETE SET NULL,
      training_id INTEGER REFERENCES trainings(id) ON DELETE SET NULL,
      session_id INTEGER REFERENCES sessions(id) ON DELETE SET NULL,
      session_template_id INTEGER NOT NULL REFERENCES catalog_session_templates(id) ON DELETE RESTRICT,
      exercise_id INTEGER NOT NULL REFERENCES catalog_exercises(id) ON DELETE RESTRICT,
      exercise_code TEXT,
      format_id INTEGER NOT NULL REFERENCES catalog_formats(id) ON DELETE RESTRICT,
      training_code TEXT NOT NULL,
      seance_code TEXT NOT NULL,
      seance_index INTEGER NOT NULL,
      seance_title TEXT NOT NULL,
      session_code TEXT NOT NULL,
      session_index INTEGER NOT NULL,
      exercise_name TEXT NOT NULL,
      format_code TEXT,
      format_label TEXT NOT NULL,
      level INTEGER NOT NULL CHECK (level BETWEEN 1 AND 10),
      pillar TEXT NOT NULL CHECK (
        pillar IN ('strength', 'cardio', 'proprioception')
      ),
      performed_at TEXT NOT NULL,
      timer_plan_code TEXT,
      total_seconds INTEGER NOT NULL,
      completed_seconds INTEGER NOT NULL,
      phase_count INTEGER NOT NULL,
      status TEXT NOT NULL CHECK (status IN ('completed', 'stopped')),
      effort_rating INTEGER,
      quality_rating INTEGER,
      appreciation_rating INTEGER CHECK (appreciation_rating BETWEEN 1 AND 5),
      session_phase TEXT NOT NULL DEFAULT 'main' CHECK (session_phase IN ('warmup', 'main', 'cooldown')),
      executed_prescription_json TEXT,
      pain_level TEXT NOT NULL DEFAULT 'none' CHECK (
        pain_level IN ('none', 'mild', 'pain')
      ),
      progression_decision TEXT NOT NULL DEFAULT 'maintain' CHECK (
        progression_decision IN ('regress', 'maintain', 'progress')
      ),
      progression_preference TEXT NOT NULL DEFAULT 'harder' CHECK (
        progression_preference IN ('easier', 'same', 'harder')
      ),
      notes TEXT NOT NULL DEFAULT ''
    );

    CREATE TABLE IF NOT EXISTS acrea_profiles (
      profile_id TEXT PRIMARY KEY NOT NULL,
      name TEXT NOT NULL,
      objective TEXT,
      objective_code TEXT CHECK (
        objective_code IN ('complete', 'strength', 'cardio', 'proprioception')
      ),
      equipment_mode TEXT CHECK (equipment_mode IN ('aucun', 'mixte')),
      weekly_frequency INTEGER CHECK (weekly_frequency BETWEEN 1 AND 7),
      average_session_minutes INTEGER CHECK (average_session_minutes BETWEEN 1 AND 180),
      session_minutes_min INTEGER CHECK (session_minutes_min BETWEEN 20 AND 175 AND session_minutes_min % 5 = 0),
      session_minutes_max INTEGER CHECK (session_minutes_max BETWEEN 25 AND 180 AND session_minutes_max % 5 = 0 AND session_minutes_max >= session_minutes_min + 5),
      weekly_novelty_percent INTEGER CHECK (weekly_novelty_percent BETWEEN 0 AND 100 AND weekly_novelty_percent % 10 = 0),
      level_test_status TEXT NOT NULL DEFAULT 'required' CHECK (level_test_status IN ('required', 'completed', 'retest')),
      level_test_version INTEGER NOT NULL DEFAULT 0 CHECK (level_test_version >= 0),
      level_test_completed_at TEXT,
      renforcement_level INTEGER CHECK (renforcement_level BETWEEN 1 AND 10),
      cardio_level INTEGER CHECK (cardio_level BETWEEN 1 AND 10),
      proprioception_level INTEGER CHECK (proprioception_level BETWEEN 1 AND 10),
      preferred_weekdays_json TEXT NOT NULL DEFAULT '[]',
      sync_status TEXT NOT NULL DEFAULT 'local' CHECK (
        sync_status IN ('local', 'pending', 'synced', 'failed')
      ),
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS acrea_profile_equipment (
      profile_id TEXT NOT NULL REFERENCES acrea_profiles(profile_id) ON DELETE CASCADE,
      equipment_id INTEGER NOT NULL REFERENCES catalog_equipment(id) ON DELETE RESTRICT,
      PRIMARY KEY (profile_id, equipment_id)
    );

    CREATE TABLE IF NOT EXISTS acrea_profile_equipment_pending (
      profile_id TEXT NOT NULL,
      equipment_code TEXT NOT NULL,
      archived_at TEXT NOT NULL,
      PRIMARY KEY (profile_id, equipment_code)
    );

    CREATE TABLE IF NOT EXISTS acrea_profile_restrictions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      profile_id TEXT NOT NULL REFERENCES acrea_profiles(profile_id) ON DELETE CASCADE,
      restriction_type TEXT NOT NULL CHECK (
        restriction_type IN ('impactLimit', 'exerciseExclusion', 'pillarLimit', 'equipmentExclusion', 'temporaryPain')
      ),
      payload_json TEXT NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS acrea_level_test_attempts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      profile_id TEXT NOT NULL REFERENCES acrea_profiles(profile_id) ON DELETE CASCADE,
      remote_attempt_id INTEGER,
      protocol_version INTEGER NOT NULL CHECK (protocol_version > 0),
      attempt_kind TEXT NOT NULL CHECK (attempt_kind IN ('initial', 'retest')),
      status TEXT NOT NULL DEFAULT 'in_progress' CHECK (status IN ('in_progress', 'completed')),
      sync_status TEXT NOT NULL DEFAULT 'pending' CHECK (sync_status IN ('pending', 'synced', 'failed')),
      started_at TEXT NOT NULL,
      completed_at TEXT,
      superseded_at TEXT
    );

    CREATE TABLE IF NOT EXISTS acrea_level_test_stage_results (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      attempt_id INTEGER NOT NULL REFERENCES acrea_level_test_attempts(id) ON DELETE CASCADE,
      exercise_code TEXT NOT NULL,
      pillar TEXT NOT NULL CHECK (pillar IN ('strength', 'cardio', 'proprioception')),
      exercise_order INTEGER NOT NULL CHECK (exercise_order BETWEEN 1 AND 6),
      stage INTEGER NOT NULL CHECK (stage BETWEEN 1 AND 3),
      attempt_number INTEGER NOT NULL CHECK (attempt_number > 0),
      target_series INTEGER,
      target_repetitions INTEGER,
      maximum_repetitions INTEGER,
      technical_valid INTEGER NOT NULL CHECK (technical_valid IN (0, 1)),
      attempted_at TEXT NOT NULL,
      UNIQUE (attempt_id, exercise_code, stage, attempt_number)
    );

    CREATE TABLE IF NOT EXISTS acrea_level_evaluation_attempts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      profile_id TEXT NOT NULL REFERENCES acrea_profiles(profile_id) ON DELETE CASCADE,
      remote_attempt_id INTEGER,
      protocol_version INTEGER NOT NULL CHECK (protocol_version >= 2),
      attempt_kind TEXT NOT NULL CHECK (attempt_kind IN ('initial', 'retest')),
      status TEXT NOT NULL DEFAULT 'in_progress' CHECK (status IN ('in_progress', 'completed')),
      sync_status TEXT NOT NULL DEFAULT 'pending' CHECK (sync_status IN ('pending', 'synced', 'failed')),
      started_at TEXT NOT NULL,
      completed_at TEXT,
      superseded_at TEXT
    );

    CREATE TABLE IF NOT EXISTS acrea_level_evaluation_sessions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      attempt_id INTEGER NOT NULL REFERENCES acrea_level_evaluation_attempts(id) ON DELETE CASCADE,
      remote_session_id INTEGER,
      phase INTEGER NOT NULL CHECK (phase BETWEEN 1 AND 3),
      run_number INTEGER NOT NULL CHECK (run_number > 0),
      status TEXT NOT NULL DEFAULT 'in_progress' CHECK (status IN ('in_progress', 'passed', 'failed')),
      active_step_index INTEGER NOT NULL DEFAULT 0 CHECK (active_step_index BETWEEN 0 AND 12),
      started_at TEXT NOT NULL,
      completed_at TEXT,
      UNIQUE (attempt_id, phase, run_number)
    );

    CREATE TABLE IF NOT EXISTS acrea_level_evaluation_results (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      evaluation_session_id INTEGER NOT NULL REFERENCES acrea_level_evaluation_sessions(id) ON DELETE CASCADE,
      exercise_code TEXT NOT NULL,
      pillar TEXT NOT NULL CHECK (pillar IN ('strength', 'cardio', 'proprioception')),
      exercise_order INTEGER NOT NULL CHECK (exercise_order BETWEEN 1 AND 6),
      target_series INTEGER NOT NULL CHECK (target_series > 0),
      target_repetitions INTEGER,
      maximum_repetitions INTEGER,
      technical_valid INTEGER NOT NULL CHECK (technical_valid IN (0, 1)),
      appreciation_rating INTEGER NOT NULL CHECK (appreciation_rating BETWEEN 1 AND 5),
      prescription_json TEXT NOT NULL,
      timer_plan_code TEXT NOT NULL,
      total_seconds INTEGER NOT NULL CHECK (total_seconds >= 0),
      completed_seconds INTEGER NOT NULL CHECK (completed_seconds >= 0),
      attempted_at TEXT NOT NULL,
      UNIQUE (evaluation_session_id, exercise_code)
    );

    CREATE TABLE IF NOT EXISTS acrea_level_evaluation_preferences (
      profile_id TEXT NOT NULL REFERENCES acrea_profiles(profile_id) ON DELETE CASCADE,
      protocol_version INTEGER NOT NULL CHECK (protocol_version >= 3),
      evaluation_exercise_code TEXT NOT NULL,
      exercise_slug TEXT NOT NULL REFERENCES catalog_exercises(code) ON DELETE RESTRICT,
      appreciation_average REAL NOT NULL CHECK (appreciation_average BETWEEN 1 AND 5),
      sample_count INTEGER NOT NULL CHECK (sample_count > 0),
      evaluated_at TEXT NOT NULL,
      sync_status TEXT NOT NULL DEFAULT 'pending' CHECK (sync_status IN ('pending', 'synced', 'failed')),
      PRIMARY KEY (profile_id, protocol_version, exercise_slug)
    );

    CREATE TABLE IF NOT EXISTS acrea_exercise_progressions (
      profile_id TEXT NOT NULL REFERENCES acrea_profiles(profile_id) ON DELETE CASCADE,
      exercise_id INTEGER NOT NULL REFERENCES catalog_exercises(id) ON DELETE CASCADE,
      prescription_json TEXT NOT NULL,
      reached_maximum INTEGER NOT NULL DEFAULT 0 CHECK (reached_maximum IN (0, 1)),
      pending_direction TEXT CHECK (pending_direction IN ('easier', 'harder')),
      level_evaluation_version INTEGER NOT NULL DEFAULT 0,
      last_progression_at TEXT,
      updated_at TEXT NOT NULL,
      PRIMARY KEY (profile_id, exercise_id)
    );

    CREATE TABLE IF NOT EXISTS acrea_profile_excluded_exercises (
      profile_id TEXT NOT NULL REFERENCES acrea_profiles(profile_id) ON DELETE CASCADE,
      exercise_id INTEGER NOT NULL REFERENCES catalog_exercises(id) ON DELETE CASCADE,
      reason TEXT NOT NULL CHECK (reason IN ('appreciation', 'manual')),
      excluded_at TEXT NOT NULL,
      PRIMARY KEY (profile_id, exercise_id)
    );
  `);

  await migrateV3Columns(db, sourceVersion);
  await migrateLevelEvaluationV2(db, sourceVersion);
  await migrateLevelEvaluationV3(db, sourceVersion);
  await migrateOptionalACREAProfileFields(db, sourceVersion);
  await migrateCatalogReleaseV30(db, sourceVersion);
  await migrateCatalogReleaseV31(db, sourceVersion);
  await migrateExerciseLibraryV32(db, sourceVersion);
  await migrateProgressiveCatalogV33(db, sourceVersion);

  await migrateWeeklyProgramSchema(db);
  await restoreLegacyProfiles(db);
  await resolvePendingProfileEquipment(db);
  await invalidateLegacyWeeklySnapshots(db);

  await db.execAsync(`
    CREATE INDEX IF NOT EXISTS catalog_exercises_pillar_difficulty_idx
      ON catalog_exercises (pillar_id, difficulty, label);

    CREATE INDEX IF NOT EXISTS catalog_exercises_family_idx
      ON catalog_exercises (family_id, label);

    CREATE INDEX IF NOT EXISTS catalog_exercises_type_idx
      ON catalog_exercises (type_id, label);

    CREATE INDEX IF NOT EXISTS catalog_exercises_impact_idx
      ON catalog_exercises (impact_id, label);

    CREATE INDEX IF NOT EXISTS catalog_exercises_equipment_idx
      ON catalog_exercises (equipment_id, label);

    CREATE INDEX IF NOT EXISTS catalog_exercises_progression_exercise_id_idx
      ON catalog_exercises (progression_exercise_id);

    CREATE INDEX IF NOT EXISTS catalog_exercises_regression_exercise_id_idx
      ON catalog_exercises (regression_exercise_id);

    CREATE UNIQUE INDEX IF NOT EXISTS catalog_releases_one_active_idx
      ON catalog_releases ((1))
      WHERE status = 'active';

    CREATE UNIQUE INDEX IF NOT EXISTS catalog_exercises_source_key_unique
      ON catalog_exercises (source_key)
      WHERE source_key IS NOT NULL;

    CREATE INDEX IF NOT EXISTS catalog_exercises_release_visibility_idx
      ON catalog_exercises (
        release_id, is_active, translation_status, programming_status, label
      );

    CREATE INDEX IF NOT EXISTS catalog_exercise_media_status_idx
      ON catalog_exercise_media (status, kind, exercise_id);

    CREATE INDEX IF NOT EXISTS catalog_cache_entries_release_state_idx
      ON catalog_cache_entries (release_code, state, scope);

    CREATE INDEX IF NOT EXISTS catalog_exercise_successors_target_idx
      ON catalog_exercise_successors (
        successor_source_key, resolution_status, successor_exercise_id
      );

    CREATE INDEX IF NOT EXISTS catalog_exercise_muscle_groups_group_idx
      ON catalog_exercise_muscle_groups (muscle_group_id);

    CREATE UNIQUE INDEX IF NOT EXISTS catalog_equipment_label_unique
      ON catalog_equipment (lower(trim(label)));

    CREATE INDEX IF NOT EXISTS catalog_exercise_equipment_options_exercise_idx
      ON catalog_exercise_equipment_options (exercise_id, option_index);

    CREATE INDEX IF NOT EXISTS catalog_exercise_equipment_option_items_equipment_idx
      ON catalog_exercise_equipment_option_items (equipment_id, option_id);

    CREATE UNIQUE INDEX IF NOT EXISTS catalog_series_series_unique
      ON catalog_series (series);

    CREATE UNIQUE INDEX IF NOT EXISTS catalog_rests_seconds_unique
      ON catalog_rests (rest_seconds);

    CREATE UNIQUE INDEX IF NOT EXISTS catalog_repetitions_reps_unique
      ON catalog_repetitions (reps)
      WHERE reps IS NOT NULL;

    CREATE UNIQUE INDEX IF NOT EXISTS catalog_repetitions_maximum_unique
      ON catalog_repetitions ((1))
      WHERE reps IS NULL;

    CREATE UNIQUE INDEX IF NOT EXISTS catalog_intervals_seconds_unique
      ON catalog_intervals (effort_seconds);

    CREATE UNIQUE INDEX IF NOT EXISTS catalog_formats_shape_unique
      ON catalog_formats (format_type, series_id, repetitions_id, interval_id, rest_id);

    CREATE INDEX IF NOT EXISTS catalog_formats_type_idx
      ON catalog_formats (format_type, label);

    CREATE INDEX IF NOT EXISTS catalog_formats_series_idx
      ON catalog_formats (series_id);

    CREATE INDEX IF NOT EXISTS catalog_formats_repetitions_idx
      ON catalog_formats (repetitions_id);

    CREATE INDEX IF NOT EXISTS catalog_formats_intervals_idx
      ON catalog_formats (interval_id);

    CREATE INDEX IF NOT EXISTS catalog_formats_rests_idx
      ON catalog_formats (rest_id);

    CREATE INDEX IF NOT EXISTS catalog_session_templates_exercise_idx
      ON catalog_session_templates (exercise_id, is_active, title);

    CREATE INDEX IF NOT EXISTS catalog_session_template_levels_level_idx
      ON catalog_session_template_levels (level, session_template_id);

    CREATE UNIQUE INDEX IF NOT EXISTS programs_profile_iso_week_unique
      ON programs (profile_id, iso_week_year, iso_week_number);

    CREATE INDEX IF NOT EXISTS trainings_program_sort_idx
      ON trainings (program_id, sort_order, code);

    CREATE INDEX IF NOT EXISTS seances_training_sort_idx
      ON seances (training_id, sort_order, code);

    CREATE INDEX IF NOT EXISTS sessions_seance_sort_idx
      ON sessions (seance_id, sort_order, code);

    CREATE INDEX IF NOT EXISTS session_feedback_profile_session_idx
      ON session_feedback (
        profile_id,
        training_code,
        seance_code,
        session_code,
        performed_at
      );

    CREATE INDEX IF NOT EXISTS acrea_level_test_attempts_profile_idx
      ON acrea_level_test_attempts (profile_id, status, started_at DESC);

    CREATE INDEX IF NOT EXISTS acrea_level_test_stage_results_attempt_idx
      ON acrea_level_test_stage_results (attempt_id, exercise_order, stage, attempt_number DESC);

    CREATE INDEX IF NOT EXISTS acrea_level_evaluation_attempts_profile_idx
      ON acrea_level_evaluation_attempts (profile_id, status, started_at DESC);

    CREATE INDEX IF NOT EXISTS acrea_level_evaluation_sessions_attempt_idx
      ON acrea_level_evaluation_sessions (attempt_id, phase, run_number DESC);

    CREATE INDEX IF NOT EXISTS acrea_level_evaluation_results_session_idx
      ON acrea_level_evaluation_results (evaluation_session_id, exercise_order);

    CREATE INDEX IF NOT EXISTS acrea_level_evaluation_preferences_profile_idx
      ON acrea_level_evaluation_preferences (profile_id, protocol_version, evaluated_at DESC);

    CREATE INDEX IF NOT EXISTS acrea_level_evaluation_preferences_exercise_slug_idx
      ON acrea_level_evaluation_preferences (exercise_slug);

    CREATE INDEX IF NOT EXISTS acrea_level_evaluation_mappings_exercise_slug_idx
      ON acrea_level_evaluation_exercise_mappings (exercise_slug);

    CREATE INDEX IF NOT EXISTS acrea_exercise_progressions_profile_idx
      ON acrea_exercise_progressions (profile_id, updated_at DESC);

    CREATE INDEX IF NOT EXISTS acrea_exercise_progressions_exercise_id_idx
      ON acrea_exercise_progressions (exercise_id);

    CREATE INDEX IF NOT EXISTS acrea_profile_excluded_exercises_exercise_id_idx
      ON acrea_profile_excluded_exercises (exercise_id);

    CREATE INDEX IF NOT EXISTS session_feedback_profile_exercise_week_idx
      ON session_feedback (profile_id, exercise_id, performed_at DESC);

    CREATE TRIGGER IF NOT EXISTS sessions_require_catalog_ids_insert
    BEFORE INSERT ON sessions
    WHEN NEW.session_template_id IS NULL
      OR NEW.exercise_id IS NULL
      OR NEW.format_id IS NULL
      OR NOT EXISTS (SELECT 1 FROM catalog_session_templates WHERE id = NEW.session_template_id)
      OR NOT EXISTS (SELECT 1 FROM catalog_exercises WHERE id = NEW.exercise_id)
      OR NOT EXISTS (SELECT 1 FROM catalog_formats WHERE id = NEW.format_id)
    BEGIN
      SELECT RAISE(ABORT, 'sessions require valid catalog identifiers');
    END;

    CREATE TRIGGER IF NOT EXISTS programs_require_profile_insert
    BEFORE INSERT ON programs
    WHEN NOT EXISTS (SELECT 1 FROM acrea_profiles WHERE profile_id = NEW.profile_id)
    BEGIN
      SELECT RAISE(ABORT, 'programs require an ACREA profile');
    END;

    CREATE TRIGGER IF NOT EXISTS sessions_require_catalog_ids_update
    BEFORE UPDATE OF session_template_id, exercise_id, format_id ON sessions
    WHEN NEW.session_template_id IS NULL
      OR NEW.exercise_id IS NULL
      OR NEW.format_id IS NULL
      OR NOT EXISTS (SELECT 1 FROM catalog_session_templates WHERE id = NEW.session_template_id)
      OR NOT EXISTS (SELECT 1 FROM catalog_exercises WHERE id = NEW.exercise_id)
      OR NOT EXISTS (SELECT 1 FROM catalog_formats WHERE id = NEW.format_id)
    BEGIN
      SELECT RAISE(ABORT, 'sessions require valid catalog identifiers');
    END;

    CREATE TRIGGER IF NOT EXISTS session_feedback_require_catalog_ids_insert
    BEFORE INSERT ON session_feedback
    WHEN NOT EXISTS (SELECT 1 FROM acrea_profiles WHERE profile_id = NEW.profile_id)
      OR NEW.session_template_id IS NULL
      OR NEW.exercise_id IS NULL
      OR NEW.format_id IS NULL
      OR NOT EXISTS (SELECT 1 FROM catalog_session_templates WHERE id = NEW.session_template_id)
      OR NOT EXISTS (SELECT 1 FROM catalog_exercises WHERE id = NEW.exercise_id)
      OR NOT EXISTS (SELECT 1 FROM catalog_formats WHERE id = NEW.format_id)
    BEGIN
      SELECT RAISE(ABORT, 'session_feedback requires valid catalog identifiers');
    END;

    DROP TRIGGER IF EXISTS acrea_profiles_validate_v3_insert;
    CREATE TRIGGER acrea_profiles_validate_v3_insert
    BEFORE INSERT ON acrea_profiles
    WHEN NEW.session_minutes_min NOT BETWEEN 20 AND 175
      OR NEW.session_minutes_min % 5 <> 0
      OR NEW.session_minutes_max NOT BETWEEN 25 AND 180
      OR NEW.session_minutes_max % 5 <> 0
      OR NEW.session_minutes_max < NEW.session_minutes_min + 5
      OR NEW.weekly_novelty_percent NOT BETWEEN 0 AND 100
      OR NEW.weekly_novelty_percent % 10 <> 0
      OR NEW.level_test_status NOT IN ('required', 'completed', 'retest')
      OR NEW.level_test_version < 0
      OR (NEW.level_test_status = 'completed'
          AND (NEW.level_test_version = 0
            OR NEW.level_test_completed_at IS NULL
            OR NEW.renforcement_level IS NULL
            OR NEW.cardio_level IS NULL
            OR NEW.proprioception_level IS NULL))
    BEGIN
      SELECT RAISE(ABORT, 'invalid ACREA v3 profile settings');
    END;

    DROP TRIGGER IF EXISTS acrea_profiles_validate_v3_update;
    CREATE TRIGGER acrea_profiles_validate_v3_update
    BEFORE UPDATE OF session_minutes_min, session_minutes_max,
      weekly_novelty_percent, level_test_status, level_test_version,
      level_test_completed_at ON acrea_profiles
    WHEN NEW.session_minutes_min NOT BETWEEN 20 AND 175
      OR NEW.session_minutes_min % 5 <> 0
      OR NEW.session_minutes_max NOT BETWEEN 25 AND 180
      OR NEW.session_minutes_max % 5 <> 0
      OR NEW.session_minutes_max < NEW.session_minutes_min + 5
      OR NEW.weekly_novelty_percent NOT BETWEEN 0 AND 100
      OR NEW.weekly_novelty_percent % 10 <> 0
      OR NEW.level_test_status NOT IN ('required', 'completed', 'retest')
      OR NEW.level_test_version < 0
      OR (NEW.level_test_status = 'completed'
          AND (NEW.level_test_version = 0
            OR NEW.level_test_completed_at IS NULL
            OR NEW.renforcement_level IS NULL
            OR NEW.cardio_level IS NULL
            OR NEW.proprioception_level IS NULL))
    BEGIN
      SELECT RAISE(ABORT, 'invalid ACREA v3 profile settings');
    END;

    DROP TRIGGER IF EXISTS seances_validate_phase_insert;
    CREATE TRIGGER seances_validate_phase_insert
    BEFORE INSERT ON seances
    WHEN NEW.phase NOT IN ('warmup', 'main', 'cooldown')
      OR (NEW.phase = 'main' AND NEW.pillar IS NULL)
      OR (NEW.phase <> 'main' AND NEW.pillar IS NOT NULL)
    BEGIN
      SELECT RAISE(ABORT, 'invalid seance phase');
    END;

    DROP TRIGGER IF EXISTS seances_validate_phase_update;
    CREATE TRIGGER seances_validate_phase_update
    BEFORE UPDATE OF phase, pillar ON seances
    WHEN NEW.phase NOT IN ('warmup', 'main', 'cooldown')
      OR (NEW.phase = 'main' AND NEW.pillar IS NULL)
      OR (NEW.phase <> 'main' AND NEW.pillar IS NOT NULL)
    BEGIN
      SELECT RAISE(ABORT, 'invalid seance phase');
    END;

    DROP TRIGGER IF EXISTS sessions_validate_prescription_insert;
    CREATE TRIGGER sessions_validate_prescription_insert
    BEFORE INSERT ON sessions
    WHEN NEW.phase NOT IN ('warmup', 'main', 'cooldown')
      OR json_valid(NEW.prescription_json) = 0
      OR json_extract(NEW.prescription_json, '$.kind') NOT IN ('repetitions', 'intervals', 'fixed')
      OR json_type(NEW.prescription_json, '$.series') <> 'integer'
      OR json_type(NEW.prescription_json, '$.restSeconds') <> 'integer'
      OR json_type(NEW.prescription_json, '$.estimatedDurationSeconds') <> 'integer'
      OR json_type(NEW.prescription_json, '$.adaptable') NOT IN ('true', 'false')
      OR (NEW.phase = 'main' AND json_extract(NEW.prescription_json, '$.adaptable') <> 1)
      OR (NEW.phase <> 'main' AND json_extract(NEW.prescription_json, '$.adaptable') <> 0)
    BEGIN
      SELECT RAISE(ABORT, 'invalid session prescription');
    END;

    DROP TRIGGER IF EXISTS sessions_validate_prescription_update;
    CREATE TRIGGER sessions_validate_prescription_update
    BEFORE UPDATE OF phase, prescription_json ON sessions
    WHEN NEW.phase NOT IN ('warmup', 'main', 'cooldown')
      OR json_valid(NEW.prescription_json) = 0
      OR json_extract(NEW.prescription_json, '$.kind') NOT IN ('repetitions', 'intervals', 'fixed')
      OR json_type(NEW.prescription_json, '$.series') <> 'integer'
      OR json_type(NEW.prescription_json, '$.restSeconds') <> 'integer'
      OR json_type(NEW.prescription_json, '$.estimatedDurationSeconds') <> 'integer'
      OR json_type(NEW.prescription_json, '$.adaptable') NOT IN ('true', 'false')
      OR (NEW.phase = 'main' AND json_extract(NEW.prescription_json, '$.adaptable') <> 1)
      OR (NEW.phase <> 'main' AND json_extract(NEW.prescription_json, '$.adaptable') <> 0)
    BEGIN
      SELECT RAISE(ABORT, 'invalid session prescription');
    END;

    DROP TRIGGER IF EXISTS session_feedback_validate_v3_insert;
    CREATE TRIGGER session_feedback_validate_v3_insert
    BEFORE INSERT ON session_feedback
    WHEN NEW.session_phase NOT IN ('warmup', 'main', 'cooldown')
      OR (NEW.appreciation_rating IS NOT NULL
          AND NEW.appreciation_rating NOT BETWEEN 1 AND 5)
      OR (NEW.session_phase = 'main' AND NEW.appreciation_rating IS NULL)
    BEGIN
      SELECT RAISE(ABORT, 'main session appreciation is required');
    END;

    DROP TRIGGER IF EXISTS session_feedback_validate_v3_update;
    CREATE TRIGGER session_feedback_validate_v3_update
    BEFORE UPDATE OF session_phase, appreciation_rating ON session_feedback
    WHEN NEW.session_phase NOT IN ('warmup', 'main', 'cooldown')
      OR (NEW.appreciation_rating IS NOT NULL
          AND NEW.appreciation_rating NOT BETWEEN 1 AND 5)
      OR (NEW.session_phase = 'main' AND NEW.appreciation_rating IS NULL)
    BEGIN
      SELECT RAISE(ABORT, 'main session appreciation is required');
    END;

  `);
  await assertNoForeignKeyViolations(db);
  await db.execAsync(`PRAGMA user_version = ${localDatabaseSchemaVersion};`);
}

async function readLocalDatabaseSchemaVersion(db: LocalDatabase) {
  return (
    (
      await db.getFirstAsync<{ user_version: number }>(
        "PRAGMA user_version;",
      )
    )?.user_version ?? 0
  );
}

async function assertNoForeignKeyViolations(db: LocalDatabase) {
  const foreignKeyErrors = await db.getAllAsync<{ table: string }>(
    "PRAGMA foreign_key_check;",
  );
  if (foreignKeyErrors.length > 0) {
    throw new Error(`Migration SQLite invalide: ${foreignKeyErrors[0].table}`);
  }
}

async function archiveActiveV2Programs(db: LocalDatabase) {
  if (!(await tableExists(db, "programs"))) return;
  const sql = await tableSql(db, "programs");
  const isV3 = sql?.includes("schema_version = 3") ?? false;
  if (isV3) return;

  if (await tableExists(db, "session_feedback")) {
    if (
      (await tableHasColumn(db, "session_feedback", "program_id")) &&
      (await tableHasColumn(db, "session_feedback", "training_id")) &&
      (await tableHasColumn(db, "session_feedback", "session_id"))
    ) {
      await db.execAsync(
        "UPDATE session_feedback SET program_id = NULL, training_id = NULL, session_id = NULL;",
      );
    }
  }
  await db.execAsync(`
    DROP TABLE IF EXISTS sessions;
    DROP TABLE IF EXISTS seances;
    DROP TABLE IF EXISTS trainings;
    DROP TABLE IF EXISTS programs;
  `);
}

async function migrateV3Columns(db: LocalDatabase, sourceVersion: number) {
  await ensureColumn(
    db,
    "catalog_session_templates",
    "phase",
    "TEXT NOT NULL DEFAULT 'main' CHECK (phase IN ('warmup', 'main', 'cooldown'))",
  );
  await ensureColumn(
    db,
    "acrea_profiles",
    "session_minutes_min",
    "INTEGER NOT NULL DEFAULT 30",
  );
  await ensureColumn(
    db,
    "acrea_profiles",
    "session_minutes_max",
    "INTEGER NOT NULL DEFAULT 45",
  );
  await ensureColumn(
    db,
    "acrea_profiles",
    "weekly_novelty_percent",
    "INTEGER NOT NULL DEFAULT 50",
  );
  await ensureColumn(
    db,
    "acrea_profiles",
    "level_test_status",
    "TEXT NOT NULL DEFAULT 'required'",
  );
  await ensureColumn(
    db,
    "acrea_profiles",
    "level_test_version",
    "INTEGER NOT NULL DEFAULT 0",
  );
  await ensureColumn(db, "acrea_profiles", "level_test_completed_at", "TEXT");
  await ensureColumn(db, "session_feedback", "appreciation_rating", "INTEGER");
  await ensureColumn(
    db,
    "session_feedback",
    "session_phase",
    "TEXT NOT NULL DEFAULT 'main'",
  );
  await ensureColumn(db, "session_feedback", "executed_prescription_json", "TEXT");

  if (sourceVersion >= 26) return;

  await db.execAsync(`
    UPDATE acrea_profiles
    SET session_minutes_min = max(20, ((average_session_minutes - 5) / 5) * 5),
        session_minutes_max = min(
          180,
          max(
            max(20, ((average_session_minutes - 5) / 5) * 5) + 5,
            ((average_session_minutes + 14) / 5) * 5
          )
        )
    WHERE session_minutes_min = 30
      AND session_minutes_max = 45
      AND average_session_minutes <> 35;

    UPDATE catalog_session_templates SET phase = 'main';
    UPDATE catalog_session_templates
    SET phase = 'warmup'
    WHERE exercise_id IN (
      SELECT id FROM catalog_exercises WHERE code IN (
        'proprioception-mobilite-epaules',
        'proprioception-mobilite-hanches',
        'proprioception-mobilite-poignets'
      )
    );
    UPDATE catalog_session_templates
    SET phase = 'cooldown'
    WHERE exercise_id IN (
      SELECT id FROM catalog_exercises WHERE code IN (
        'proprioception-mobilite-poignets-epaules-hanches',
        'renforcement-mobilite-colonne-douce'
      )
    );
  `);
}

async function migrateLevelEvaluationV2(
  db: LocalDatabase,
  sourceVersion: number,
) {
  await ensureColumn(db, "acrea_level_test_attempts", "superseded_at", "TEXT");
  await ensureColumn(
    db,
    "acrea_level_evaluation_attempts",
    "sync_status",
    "TEXT NOT NULL DEFAULT 'pending'",
  );
  await ensureColumn(
    db,
    "programs",
    "level_evaluation_version",
    "INTEGER NOT NULL DEFAULT 0",
  );

  if (sourceVersion >= 27) return;

  await db.execAsync(`
    UPDATE acrea_level_test_attempts
    SET superseded_at = COALESCE(superseded_at, datetime('now'))
    WHERE status = 'in_progress';

    UPDATE programs
    SET level_evaluation_version = COALESCE((
      SELECT profile.level_test_version
      FROM acrea_profiles profile
      WHERE profile.profile_id = programs.profile_id
    ), 0);

    UPDATE acrea_profiles
    SET level_test_status = 'required',
        updated_at = datetime('now');
  `);
}

async function migrateLevelEvaluationV3(
  db: LocalDatabase,
  sourceVersion: number,
) {
  await ensureColumn(
    db,
    "acrea_level_evaluation_attempts",
    "superseded_at",
    "TEXT",
  );
  await ensureColumn(
    db,
    "acrea_exercise_progressions",
    "level_evaluation_version",
    "INTEGER NOT NULL DEFAULT 0",
  );

  if (sourceVersion >= 28) return;

  await db.execAsync(`
    UPDATE acrea_level_evaluation_attempts
    SET superseded_at = COALESCE(superseded_at, datetime('now'))
    WHERE protocol_version < 3 AND status = 'in_progress';

    UPDATE acrea_exercise_progressions
    SET level_evaluation_version = COALESCE((
      SELECT profile.level_test_version
      FROM acrea_profiles profile
      WHERE profile.profile_id = acrea_exercise_progressions.profile_id
    ), 0);

    UPDATE acrea_profiles
    SET level_test_status = 'required',
        updated_at = datetime('now');
  `);
}

async function migrateCatalogReleaseV30(
  _db: LocalDatabase,
  _sourceVersion: number,
) {
  // V30 was never shipped as a standalone local upgrade. V32 adds the
  // required release columns below without replacing existing catalogue rows.
}

async function migrateCatalogReleaseV31(
  _db: LocalDatabase,
  _sourceVersion: number,
) {
  // V31 was never shipped as a standalone local upgrade. Existing activation
  // journals and successor mappings are deliberately preserved by V32.
}

async function migrateExerciseLibraryV32(
  db: LocalDatabase,
  sourceVersion: number,
) {
  if (sourceVersion >= 32) return;

  await ensureColumn(db, "catalog_exercises", "slug", "TEXT");
  await ensureColumn(db, "catalog_exercises", "label_fr", "TEXT");
  await ensureColumn(db, "catalog_exercises", "label_en", "TEXT");
  await ensureColumn(
    db,
    "catalog_exercises",
    "release_id",
    "INTEGER REFERENCES catalog_releases(id) ON DELETE RESTRICT",
  );
  await ensureColumn(db, "catalog_exercises", "source_key", "TEXT");
  await ensureColumn(
    db,
    "catalog_exercises",
    "source_url",
    "TEXT NOT NULL DEFAULT ''",
  );
  await ensureColumn(
    db,
    "catalog_exercises",
    "source_category",
    "TEXT NOT NULL DEFAULT ''",
  );
  await ensureColumn(
    db,
    "catalog_exercises",
    "source_language",
    "TEXT NOT NULL DEFAULT 'fr'",
  );
  await ensureColumn(
    db,
    "catalog_exercises",
    "locale",
    "TEXT NOT NULL DEFAULT 'fr'",
  );
  await ensureColumn(
    db,
    "catalog_exercises",
    "is_active",
    "INTEGER NOT NULL DEFAULT 1 CHECK (is_active IN (0, 1))",
  );
  await ensureColumn(
    db,
    "catalog_exercises",
    "review_status",
    "TEXT NOT NULL DEFAULT 'a_verifier' CHECK (review_status IN ('a_verifier', 'valide', 'a_revoir'))",
  );
  await ensureColumn(
    db,
    "catalog_exercises",
    "translation_status",
    "TEXT NOT NULL DEFAULT 'source_only' CHECK (translation_status IN ('source_only', 'translated', 'validated'))",
  );
  await ensureColumn(
    db,
    "catalog_exercises",
    "programming_status",
    "TEXT NOT NULL DEFAULT 'library_only' CHECK (programming_status IN ('library_only', 'eligible', 'blocked'))",
  );
  await ensureColumn(db, "catalog_exercises", "archived_at", "TEXT");
  await ensureColumn(
    db,
    "catalog_exercises",
    "admin_overridden_at",
    "TEXT",
  );
  await ensureColumn(
    db,
    "catalog_exercises",
    "updated_at",
    "TEXT NOT NULL DEFAULT ''",
  );

  await migrateLevelEvaluationMappingsV32(db);
  await migrateLevelEvaluationPreferencesV32(db);

  await db.execAsync(`
    UPDATE catalog_exercises
    SET slug = COALESCE(NULLIF(slug, ''), code),
        label_fr = COALESCE(NULLIF(label_fr, ''), label),
        label_en = COALESCE(NULLIF(label_en, ''), label),
        updated_at = COALESCE(NULLIF(updated_at, ''), datetime('now'));

    INSERT OR IGNORE INTO catalog_releases (
      code, source, source_revision, locale, expected_exercise_count, status,
      license_id, created_at, activated_at, archived_at, updated_at
    )
    SELECT 'catalog-v3-legacy', 'sqlite-v29', '', 'fr', COUNT(*), 'archived',
           NULL, datetime('now'), NULL, datetime('now'), datetime('now')
    FROM catalog_exercises;

    UPDATE catalog_exercises
    SET release_id = (
      SELECT id FROM catalog_releases WHERE code = 'catalog-v3-legacy'
    )
    WHERE release_id IS NULL;

    CREATE UNIQUE INDEX IF NOT EXISTS catalog_exercises_slug_idx
      ON catalog_exercises(slug);
  `);
}

/**
 * V33 separates progressive-cache bookkeeping from the catalogue rows. A
 * complete V32 cache stays reusable: no exercise, media, profile, evaluation
 * or programme row is removed during this upgrade.
 */
async function migrateProgressiveCatalogV33(
  db: LocalDatabase,
  sourceVersion: number,
) {
  if (sourceVersion >= 33) return;

  await db.execAsync(`
    CREATE TABLE IF NOT EXISTS catalog_cache_entries (
      scope TEXT NOT NULL CHECK (scope IN ('index', 'detail', 'media', 'library')),
      cache_key TEXT NOT NULL,
      release_code TEXT NOT NULL,
      exercise_code TEXT,
      sha256 TEXT,
      state TEXT NOT NULL CHECK (state IN ('pending', 'available', 'failed', 'cancelled')),
      updated_at TEXT NOT NULL,
      completed_at TEXT,
      error_message TEXT,
      PRIMARY KEY (scope, cache_key)
    );

    CREATE TABLE IF NOT EXISTS catalog_release_updates (
      release_code TEXT NOT NULL,
      source_revision TEXT NOT NULL,
      activated_at TEXT,
      updated_at TEXT NOT NULL,
      detected_at TEXT NOT NULL,
      status TEXT NOT NULL CHECK (status IN ('available', 'accepted', 'dismissed')),
      PRIMARY KEY (release_code, source_revision)
    );

    INSERT OR IGNORE INTO catalog_cache_entries (
      scope, cache_key, release_code, exercise_code, sha256, state,
      updated_at, completed_at, error_message
    )
    SELECT
      'detail', exercise.code,
      COALESCE(release.code, 'catalog-v3-legacy'), exercise.code, NULL,
      'available', exercise.updated_at, exercise.updated_at, NULL
    FROM catalog_exercises exercise
    LEFT JOIN catalog_releases release ON release.id = exercise.release_id
    WHERE trim(exercise.movement_description) <> ''
       OR trim(exercise.start_position) <> ''
       OR trim(exercise.outbound_execution) <> '';

    INSERT OR IGNORE INTO catalog_cache_entries (
      scope, cache_key, release_code, exercise_code, sha256, state,
      updated_at, completed_at, error_message
    )
    SELECT
      'media', media.exercise_id || ':' || media.kind,
      COALESCE(release.code, 'catalog-v3-legacy'), exercise.code,
      media.sha256, 'available', media.updated_at, media.updated_at, NULL
    FROM catalog_exercise_media media
    JOIN catalog_exercises exercise ON exercise.id = media.exercise_id
    LEFT JOIN catalog_releases release ON release.id = exercise.release_id
    WHERE media.status = 'ready';
  `);
}

async function migrateLevelEvaluationMappingsV32(db: LocalDatabase) {
  if (
    !(await tableExists(db, "acrea_level_evaluation_exercise_mappings")) ||
    (await tableHasColumn(
      db,
      "acrea_level_evaluation_exercise_mappings",
      "exercise_slug",
    ))
  ) {
    return;
  }

  await db.execAsync(`
    ALTER TABLE acrea_level_evaluation_exercise_mappings
      RENAME TO _acrea_level_evaluation_exercise_mappings_v31;
    CREATE TABLE acrea_level_evaluation_exercise_mappings (
      protocol_version INTEGER NOT NULL CHECK (protocol_version >= 4),
      evaluation_exercise_code TEXT NOT NULL,
      exercise_slug TEXT NOT NULL REFERENCES catalog_exercises(code) ON DELETE RESTRICT,
      pillar TEXT NOT NULL CHECK (pillar IN ('strength', 'cardio', 'proprioception')),
      protocol_variant TEXT NOT NULL,
      confidence TEXT NOT NULL CHECK (confidence IN ('high', 'medium')),
      count_unit TEXT NOT NULL DEFAULT 'reps' CHECK (count_unit = 'reps'),
      phase_1_series INTEGER NOT NULL CHECK (phase_1_series > 0),
      phase_1_repetitions INTEGER NOT NULL CHECK (phase_1_repetitions > 0),
      phase_2_series INTEGER NOT NULL CHECK (phase_2_series > 0),
      phase_2_repetitions INTEGER NOT NULL CHECK (phase_2_repetitions > 0),
      phase_3_series INTEGER NOT NULL DEFAULT 1 CHECK (phase_3_series = 1),
      level_2_minimum INTEGER NOT NULL CHECK (level_2_minimum >= 0),
      level_3_minimum INTEGER NOT NULL CHECK (level_3_minimum > level_2_minimum),
      validated_at TEXT,
      updated_at TEXT NOT NULL,
      PRIMARY KEY (protocol_version, evaluation_exercise_code),
      UNIQUE (protocol_version, exercise_slug)
    );
    INSERT OR IGNORE INTO acrea_level_evaluation_exercise_mappings (
      protocol_version, evaluation_exercise_code, exercise_slug, pillar,
      protocol_variant, confidence, count_unit, phase_1_series,
      phase_1_repetitions, phase_2_series, phase_2_repetitions,
      phase_3_series, level_2_minimum, level_3_minimum, validated_at,
      updated_at
    )
    SELECT protocol_version, evaluation_exercise_code, catalog_exercise_code,
           pillar, protocol_variant, confidence, count_unit, phase_1_series,
           phase_1_repetitions, phase_2_series, phase_2_repetitions,
           phase_3_series, level_2_minimum, level_3_minimum, validated_at,
           updated_at
    FROM _acrea_level_evaluation_exercise_mappings_v31
    WHERE EXISTS (
      SELECT 1 FROM catalog_exercises exercise
      WHERE exercise.code = catalog_exercise_code
    );
    DROP TABLE _acrea_level_evaluation_exercise_mappings_v31;
  `);
}

async function migrateLevelEvaluationPreferencesV32(db: LocalDatabase) {
  if (
    !(await tableExists(db, "acrea_level_evaluation_preferences")) ||
    (await tableHasColumn(
      db,
      "acrea_level_evaluation_preferences",
      "exercise_slug",
    ))
  ) {
    return;
  }

  await db.execAsync(`
    ALTER TABLE acrea_level_evaluation_preferences
      RENAME TO _acrea_level_evaluation_preferences_v31;
    CREATE TABLE acrea_level_evaluation_preferences (
      profile_id TEXT NOT NULL REFERENCES acrea_profiles(profile_id) ON DELETE CASCADE,
      protocol_version INTEGER NOT NULL CHECK (protocol_version >= 3),
      evaluation_exercise_code TEXT NOT NULL,
      exercise_slug TEXT NOT NULL REFERENCES catalog_exercises(code) ON DELETE RESTRICT,
      appreciation_average REAL NOT NULL CHECK (appreciation_average BETWEEN 1 AND 5),
      sample_count INTEGER NOT NULL CHECK (sample_count > 0),
      evaluated_at TEXT NOT NULL,
      sync_status TEXT NOT NULL DEFAULT 'pending' CHECK (sync_status IN ('pending', 'synced', 'failed')),
      PRIMARY KEY (profile_id, protocol_version, exercise_slug)
    );
    INSERT OR IGNORE INTO acrea_level_evaluation_preferences (
      profile_id, protocol_version, evaluation_exercise_code, exercise_slug,
      appreciation_average, sample_count, evaluated_at, sync_status
    )
    SELECT profile_id, protocol_version, evaluation_exercise_code,
           catalog_exercise_code, appreciation_average, sample_count,
           evaluated_at, sync_status
    FROM _acrea_level_evaluation_preferences_v31;
    DROP TABLE _acrea_level_evaluation_preferences_v31;
  `);
}

async function migrateOptionalACREAProfileFields(
  db: LocalDatabase,
  sourceVersion: number,
) {
  if (sourceVersion >= 29 || !(await tableExists(db, "acrea_profiles"))) {
    return;
  }

  await db.execAsync(`
    DROP TABLE IF EXISTS _auto_initialized_acrea_profiles_v29;
    CREATE TEMP TABLE _auto_initialized_acrea_profiles_v29 AS
    SELECT profile_id
    FROM acrea_profiles profile
    WHERE profile.objective = 'Développer le renforcement au poids du corps sans se blesser.'
      AND profile.objective_code = 'complete'
      AND profile.equipment_mode = 'aucun'
      AND profile.weekly_frequency = 3
      AND profile.session_minutes_min = 30
      AND profile.session_minutes_max = 45
      AND profile.weekly_novelty_percent = 50
      AND profile.level_test_status = 'required'
      AND profile.level_test_version = 0
      AND profile.renforcement_level = 2
      AND profile.cardio_level = 2
      AND profile.proprioception_level = 1
      AND profile.preferred_weekdays_json = '[1,3,5]'
      AND NOT EXISTS (
        SELECT 1 FROM programs WHERE programs.profile_id = profile.profile_id
      )
      AND NOT EXISTS (
        SELECT 1 FROM acrea_level_evaluation_attempts attempt
        WHERE attempt.profile_id = profile.profile_id
      );

    DROP TABLE IF EXISTS _acrea_profiles_v29;
    CREATE TABLE _acrea_profiles_v29 (
      profile_id TEXT PRIMARY KEY NOT NULL,
      name TEXT NOT NULL,
      objective TEXT,
      objective_code TEXT CHECK (
        objective_code IN ('complete', 'strength', 'cardio', 'proprioception')
      ),
      equipment_mode TEXT CHECK (equipment_mode IN ('aucun', 'mixte')),
      weekly_frequency INTEGER CHECK (weekly_frequency BETWEEN 1 AND 7),
      average_session_minutes INTEGER CHECK (average_session_minutes BETWEEN 1 AND 180),
      session_minutes_min INTEGER CHECK (session_minutes_min BETWEEN 20 AND 175 AND session_minutes_min % 5 = 0),
      session_minutes_max INTEGER CHECK (session_minutes_max BETWEEN 25 AND 180 AND session_minutes_max % 5 = 0 AND session_minutes_max >= session_minutes_min + 5),
      weekly_novelty_percent INTEGER CHECK (weekly_novelty_percent BETWEEN 0 AND 100 AND weekly_novelty_percent % 10 = 0),
      level_test_status TEXT NOT NULL DEFAULT 'required' CHECK (level_test_status IN ('required', 'completed', 'retest')),
      level_test_version INTEGER NOT NULL DEFAULT 0 CHECK (level_test_version >= 0),
      level_test_completed_at TEXT,
      renforcement_level INTEGER CHECK (renforcement_level BETWEEN 1 AND 10),
      cardio_level INTEGER CHECK (cardio_level BETWEEN 1 AND 10),
      proprioception_level INTEGER CHECK (proprioception_level BETWEEN 1 AND 10),
      preferred_weekdays_json TEXT NOT NULL DEFAULT '[]',
      sync_status TEXT NOT NULL DEFAULT 'local' CHECK (
        sync_status IN ('local', 'pending', 'synced', 'failed')
      ),
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    INSERT INTO _acrea_profiles_v29 (
      profile_id,
      name,
      objective,
      objective_code,
      equipment_mode,
      weekly_frequency,
      average_session_minutes,
      session_minutes_min,
      session_minutes_max,
      weekly_novelty_percent,
      level_test_status,
      level_test_version,
      level_test_completed_at,
      renforcement_level,
      cardio_level,
      proprioception_level,
      preferred_weekdays_json,
      sync_status,
      created_at,
      updated_at
    )
    SELECT
      profile_id,
      name,
      objective,
      objective_code,
      equipment_mode,
      weekly_frequency,
      average_session_minutes,
      session_minutes_min,
      session_minutes_max,
      weekly_novelty_percent,
      level_test_status,
      level_test_version,
      level_test_completed_at,
      renforcement_level,
      cardio_level,
      proprioception_level,
      preferred_weekdays_json,
      sync_status,
      created_at,
      updated_at
    FROM acrea_profiles;
    DROP TRIGGER IF EXISTS programs_require_profile_insert;
    DROP TRIGGER IF EXISTS session_feedback_require_catalog_ids_insert;
    DROP TRIGGER IF EXISTS acrea_profiles_validate_v3_insert;
    DROP TRIGGER IF EXISTS acrea_profiles_validate_v3_update;
    DROP TABLE acrea_profiles;
    ALTER TABLE _acrea_profiles_v29 RENAME TO acrea_profiles;

    UPDATE acrea_profiles
    SET objective = NULL,
        objective_code = NULL,
        equipment_mode = NULL,
        weekly_frequency = NULL,
        average_session_minutes = NULL,
        session_minutes_min = NULL,
        session_minutes_max = NULL,
        weekly_novelty_percent = NULL,
        renforcement_level = NULL,
        cardio_level = NULL,
        proprioception_level = NULL,
        preferred_weekdays_json = '[]',
        updated_at = datetime('now')
    WHERE profile_id IN (
      SELECT profile_id FROM _auto_initialized_acrea_profiles_v29
    );

    DELETE FROM acrea_profile_restrictions
    WHERE profile_id IN (
      SELECT profile_id FROM _auto_initialized_acrea_profiles_v29
    )
      AND restriction_type = 'impactLimit'
      AND json_extract(payload_json, '$.maximumImpact') = 'faible';

    DROP TABLE _auto_initialized_acrea_profiles_v29;
  `);
}

async function prepareLegacyWeeklyAndProfileMigration(
  db: LocalDatabase,
) {
  const hasLegacyPrograms =
    (await tableExists(db, "programs")) &&
    ((await tableHasColumn(db, "programs", "profile_code")) ||
      (await tableHasColumn(db, "programs", "week_number")) ||
      (await tableColumnHasType(db, "programs", "profile_id", "INTEGER")));
  if (hasLegacyPrograms) {
    if (await tableExists(db, "session_feedback")) {
      await db.execAsync(`
        CREATE TABLE IF NOT EXISTS session_feedback_migration_archive (
          original_id INTEGER NOT NULL,
          profile_key TEXT NOT NULL,
          exercise_code TEXT,
          format_code TEXT,
          session_code TEXT NOT NULL,
          payload_json TEXT NOT NULL,
          archived_at TEXT NOT NULL,
          restored_at TEXT,
          restore_error TEXT,
          PRIMARY KEY (original_id, profile_key)
        );
        INSERT OR IGNORE INTO session_feedback_migration_archive (
          original_id, profile_key, exercise_code, format_code,
          session_code, payload_json, archived_at
        )
        SELECT feedback.id,
               COALESCE(feedback.profile_code, CAST(feedback.profile_id AS TEXT), 'legacy'),
               session.exercise_code,
               feedback.format_code,
               feedback.session_code,
               json_object(
                 'trainingCode', feedback.training_code,
                 'seanceCode', feedback.seance_code,
                 'seanceIndex', feedback.seance_index,
                 'seanceTitle', feedback.seance_title,
                 'sessionIndex', feedback.session_index,
                 'exerciseName', feedback.exercise_name,
                 'formatLabel', feedback.format_label,
                 'level', feedback.level,
                 'pillar', feedback.pillar,
                 'performedAt', feedback.performed_at,
                 'timerPlanCode', feedback.timer_plan_code,
                 'totalSeconds', feedback.total_seconds,
                 'completedSeconds', feedback.completed_seconds,
                 'phaseCount', feedback.phase_count,
                 'status', feedback.status,
                 'effortRating', feedback.effort_rating,
                 'qualityRating', feedback.quality_rating,
                 'painLevel', feedback.pain_level,
                 'progressionDecision', feedback.progression_decision,
                 'progressionPreference', feedback.progression_preference,
                 'notes', feedback.notes
               ),
               datetime('now')
        FROM session_feedback feedback
        LEFT JOIN sessions session ON session.id = feedback.session_id;
      `);
    }
    await db.execAsync(`
      DROP TABLE IF EXISTS session_feedback;
      DROP TABLE IF EXISTS sessions;
      DROP TABLE IF EXISTS seances;
      DROP TABLE IF EXISTS trainings;
      DROP TABLE IF EXISTS programs;
    `);
  }

  const profileSql = await tableSql(db, "acrea_profiles");
  const mustRebuildProfiles = Boolean(
    profileSql &&
    (profileSql.includes("general_fitness") || profileSql.includes("'strict'")),
  );
  const hasCodeEquipmentTable =
    (await tableExists(db, "acrea_profile_equipment")) &&
    (await tableHasColumn(db, "acrea_profile_equipment", "equipment_code"));

  if (hasCodeEquipmentTable) {
    await db.execAsync(`
      CREATE TABLE IF NOT EXISTS acrea_profile_equipment_pending (
        profile_id TEXT NOT NULL,
        equipment_code TEXT NOT NULL,
        archived_at TEXT NOT NULL,
        PRIMARY KEY (profile_id, equipment_code)
      );
      INSERT OR IGNORE INTO acrea_profile_equipment_pending (
        profile_id, equipment_code, archived_at
      )
      SELECT profile_id, equipment_code, datetime('now')
      FROM acrea_profile_equipment;
    `);
  }

  if (mustRebuildProfiles) {
    await db.execAsync(`
      DROP TABLE IF EXISTS _legacy_acrea_profiles;
      DROP TABLE IF EXISTS _legacy_acrea_profile_restrictions;
      CREATE TABLE _legacy_acrea_profiles AS SELECT * FROM acrea_profiles;
      CREATE TABLE _legacy_acrea_profile_restrictions AS SELECT * FROM acrea_profile_restrictions;
      DROP TABLE acrea_profile_restrictions;
      DROP TABLE IF EXISTS acrea_profile_equipment;
      DROP TABLE acrea_profiles;
    `);
  } else if (hasCodeEquipmentTable) {
    await db.execAsync("DROP TABLE acrea_profile_equipment;");
  }
}

async function restoreLegacyProfiles(db: LocalDatabase) {
  if (!(await tableExists(db, "_legacy_acrea_profiles"))) return;
  await db.execAsync(`
    INSERT OR IGNORE INTO acrea_profiles (
      profile_id, name, objective, objective_code, equipment_mode,
      weekly_frequency, average_session_minutes, session_minutes_min,
      session_minutes_max, weekly_novelty_percent, level_test_status,
      level_test_version, level_test_completed_at, renforcement_level,
      cardio_level, proprioception_level, preferred_weekdays_json,
      sync_status, created_at, updated_at
    )
    SELECT profile_id, name, objective,
      CASE objective_code
        WHEN 'strength' THEN 'strength'
        WHEN 'cardio' THEN 'cardio'
        WHEN 'balance_mobility' THEN 'proprioception'
        ELSE 'complete'
      END,
      CASE WHEN EXISTS (
        SELECT 1 FROM acrea_profile_equipment_pending equipment
        WHERE equipment.profile_id = profile.profile_id
      ) THEN 'mixte' ELSE 'aucun' END,
      weekly_frequency, average_session_minutes,
      max(20, ((average_session_minutes - 5) / 5) * 5),
      min(180, max(
        max(20, ((average_session_minutes - 5) / 5) * 5) + 5,
        ((average_session_minutes + 14) / 5) * 5
      )),
      50, 'required', 0, NULL, renforcement_level,
      cardio_level, proprioception_level, preferred_weekdays_json,
      sync_status, created_at, updated_at
    FROM _legacy_acrea_profiles profile;

    INSERT INTO acrea_profile_restrictions (
      profile_id, restriction_type, payload_json, created_at, updated_at
    )
    SELECT profile_id, restriction_type, payload_json, created_at, updated_at
    FROM _legacy_acrea_profile_restrictions;

    DROP TABLE _legacy_acrea_profile_restrictions;
    DROP TABLE _legacy_acrea_profiles;
  `);
}

async function resolvePendingProfileEquipment(db: LocalDatabase) {
  if (!(await tableExists(db, "acrea_profile_equipment_pending"))) return;
  await db.execAsync(`
    INSERT OR IGNORE INTO acrea_profile_equipment (profile_id, equipment_id)
    SELECT pending.profile_id, equipment.id
    FROM acrea_profile_equipment_pending pending
    JOIN acrea_profiles profile ON profile.profile_id = pending.profile_id
    JOIN catalog_equipment equipment ON equipment.code = CASE pending.equipment_code
      WHEN 'barre' THEN 'barre-traction'
      WHEN 'corde' THEN 'corde-a-sauter'
      WHEN 'chaise-stable' THEN 'chaise'
      WHEN 'table-stable' THEN 'table'
      ELSE pending.equipment_code
    END;

    DELETE FROM acrea_profile_equipment_pending
    WHERE EXISTS (
      SELECT 1
      FROM catalog_equipment equipment
      WHERE equipment.code = CASE acrea_profile_equipment_pending.equipment_code
        WHEN 'barre' THEN 'barre-traction'
        WHEN 'corde' THEN 'corde-a-sauter'
        WHEN 'chaise-stable' THEN 'chaise'
        WHEN 'table-stable' THEN 'table'
        ELSE acrea_profile_equipment_pending.equipment_code
      END
    );
  `);
}

async function invalidateLegacyWeeklySnapshots(db: LocalDatabase) {
  if (!(await tableExists(db, "programs"))) return;
  const shouldInvalidateAll =
    (await tableExists(db, "catalog_exercises")) &&
    (
      await db.getFirstAsync<{ count: number }>(
        "SELECT COUNT(*) AS count FROM catalog_exercises",
      )
    )?.count === 0;
  const predicate = shouldInvalidateAll ? "1 = 1" : "schema_version <> 3";
  await db.execAsync(`
    UPDATE session_feedback
    SET program_id = NULL, training_id = NULL, session_id = NULL
    WHERE program_id IN (SELECT id FROM programs WHERE ${predicate});
    DELETE FROM sessions WHERE seance_id IN (
      SELECT seances.id FROM seances
      JOIN trainings ON trainings.id = seances.training_id
      JOIN programs ON programs.id = trainings.program_id
      WHERE ${shouldInvalidateAll ? "1 = 1" : "programs.schema_version <> 3"}
    );
    DELETE FROM seances WHERE training_id IN (
      SELECT trainings.id FROM trainings
      JOIN programs ON programs.id = trainings.program_id
      WHERE ${shouldInvalidateAll ? "1 = 1" : "programs.schema_version <> 3"}
    );
    DELETE FROM trainings WHERE program_id IN (
      SELECT id FROM programs WHERE ${predicate}
    );
    DELETE FROM programs WHERE ${predicate};
  `);
}

async function migrateWeeklyProgramSchema(db: LocalDatabase) {
  await ensureColumn(
    db,
    "programs",
    "iso_week_year",
    "INTEGER NOT NULL DEFAULT 0",
  );
  await ensureColumn(
    db,
    "programs",
    "iso_week_number",
    "INTEGER NOT NULL DEFAULT 1",
  );
  await ensureColumn(
    db,
    "programs",
    "schema_version",
    "INTEGER NOT NULL DEFAULT 1",
  );
  await ensureColumn(
    db,
    "programs",
    "catalog_version",
    "TEXT NOT NULL DEFAULT 'legacy'",
  );
  await ensureColumn(db, "programs", "profile_fingerprint", "TEXT");
  await ensureColumn(db, "programs", "profile_effective_from", "TEXT");
  await ensureColumn(
    db,
    "programs",
    "level_evaluation_version",
    "INTEGER NOT NULL DEFAULT 0",
  );
  await ensureColumn(db, "trainings", "scheduled_date", "TEXT");
  await ensureColumn(db, "trainings", "generation_profile_fingerprint", "TEXT");
  await ensureColumn(db, "sessions", "session_template_id", "INTEGER");
  await ensureColumn(db, "session_feedback", "execution_id", "TEXT");
  await ensureColumn(db, "session_feedback", "program_id", "INTEGER");
  await ensureColumn(db, "session_feedback", "training_id", "INTEGER");
  await ensureColumn(db, "session_feedback", "session_template_id", "INTEGER");
  await ensureColumn(db, "session_feedback", "exercise_id", "INTEGER");
  await ensureColumn(db, "session_feedback", "exercise_code", "TEXT");
  await ensureColumn(db, "session_feedback", "format_id", "INTEGER");

  const legacyPrograms = await db.getAllAsync<{
    id: number;
    created_at: string;
    iso_week_year: number;
    iso_week_number: number;
    week_number?: number;
  }>(
    "SELECT * FROM programs WHERE iso_week_year = 0 OR iso_week_number NOT BETWEEN 1 AND 53",
  );
  for (const program of legacyPrograms) {
    const date = new Date(program.created_at);
    const week = isoWeekFromDate(
      Number.isNaN(date.getTime()) ? new Date() : date,
    );
    await db.runAsync(
      "UPDATE programs SET iso_week_year = ?, iso_week_number = ? WHERE id = ?",
      [week.year, program.week_number ?? week.number, program.id],
    );
  }

  const undatedTrainings = await db.getAllAsync<{
    id: number;
    iso_week_year: number;
    iso_week_number: number;
    day_label: string;
  }>(
    `SELECT trainings.id, programs.iso_week_year, programs.iso_week_number,
            trainings.day_label
     FROM trainings
     JOIN programs ON programs.id = trainings.program_id
     WHERE trainings.scheduled_date IS NULL OR trainings.scheduled_date = ''`,
  );
  for (const training of undatedTrainings) {
    const weekday = weekdayFromFrenchLabel(training.day_label);
    if (!weekday) continue;
    await db.runAsync("UPDATE trainings SET scheduled_date = ? WHERE id = ?", [
      isoDateFromWeekday(
        training.iso_week_year,
        training.iso_week_number,
        weekday,
      ),
      training.id,
    ]);
  }

  await db.runAsync(
    `UPDATE session_feedback
     SET execution_id = 'legacy-' || id
     WHERE execution_id IS NULL OR execution_id = ''`,
  );
  await db.execAsync(
    "CREATE UNIQUE INDEX IF NOT EXISTS session_feedback_execution_unique ON session_feedback(execution_id);",
  );
}

function weekdayFromFrenchLabel(label: string) {
  const index = [
    "Lundi",
    "Mardi",
    "Mercredi",
    "Jeudi",
    "Vendredi",
    "Samedi",
    "Dimanche",
  ].indexOf(label);
  return index < 0 ? null : index + 1;
}

function isoDateFromWeekday(year: number, week: number, weekday: number) {
  const januaryFourth = new Date(Date.UTC(year, 0, 4));
  const januaryFourthWeekday = januaryFourth.getUTCDay() || 7;
  januaryFourth.setUTCDate(
    januaryFourth.getUTCDate() -
      januaryFourthWeekday +
      1 +
      (week - 1) * 7 +
      weekday -
      1,
  );
  return januaryFourth.toISOString().slice(0, 10);
}

async function ensureColumn(
  db: LocalDatabase,
  tableName: string,
  columnName: string,
  definition: string,
) {
  if (!(await tableHasColumn(db, tableName, columnName))) {
    await db.execAsync(
      `ALTER TABLE ${tableName} ADD COLUMN ${columnName} ${definition};`,
    );
  }
}

function isoWeekFromDate(date: Date) {
  const utcDate = new Date(
    Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()),
  );
  const day = utcDate.getUTCDay() || 7;
  utcDate.setUTCDate(utcDate.getUTCDate() + 4 - day);
  const year = utcDate.getUTCFullYear();
  const yearStart = new Date(Date.UTC(year, 0, 1));

  return {
    year,
    number: Math.ceil(
      ((utcDate.getTime() - yearStart.getTime()) / 86_400_000 + 1) / 7,
    ),
  };
}

async function resetLegacyTextIdTables(db: LocalDatabase) {
  if (await tableHasTextId(db, "catalog_pillars")) {
    await dropCatalogCacheTables(db);
  }

  if (await tableHasTextId(db, "exercises")) {
    await db.execAsync("DROP TABLE IF EXISTS exercises;");
  }

  if (await tableHasTextId(db, "training_block_performances")) {
    await db.execAsync("DROP TABLE IF EXISTS training_block_performances;");
  }
}

async function resetLegacyCatalogShapeTables(db: LocalDatabase) {
  const legacyChecks: [string, string][] = [
    ["catalog_pillars", "source_path"],
    ["catalog_families", "pillar_id"],
    ["catalog_families", "slug"],
    ["catalog_types", "source_path"],
    ["catalog_muscle_groups", "body_region"],
    ["catalog_exercises", "name"],
    ["catalog_exercises", "level_min"],
    ["catalog_exercises", "level_max"],
    ["catalog_exercises", "equipment"],
    ["catalog_exercises", "impact"],
    ["catalog_exercises", "primary_family_id"],
    ["catalog_exercises", "assessment_levels"],
    ["catalog_exercise_families", "is_primary"],
    ["catalog_formats", "pillar_id"],
    ["catalog_formats", "series_count"],
    ["catalog_repetitions", "repetition_kind"],
    ["catalog_intervals", "interval_kind"],
  ];

  for (const [tableName, columnName] of legacyChecks) {
    const hasColumn = await tableHasColumn(db, tableName, columnName);

    if (hasColumn) {
      await dropCatalogCacheTables(db);
      return;
    }
  }

  const requiredColumns: [string, string][] = [
    ["catalog_impacts", "code"],
    ["catalog_equipment", "code"],
    ["catalog_equipment", "category"],
    ["catalog_exercises", "difficulty"],
    ["catalog_exercises", "impact_id"],
    ["catalog_exercises", "equipment_id"],
    ["catalog_exercises", "movement_description"],
    ["catalog_formats", "format_type"],
  ];

  for (const [tableName, columnName] of requiredColumns) {
    if (
      (await tableExists(db, tableName)) &&
      !(await tableHasColumn(db, tableName, columnName))
    ) {
      await dropCatalogCacheTables(db);
      return;
    }
  }

  if (
    (await tableExists(db, "catalog_exercises")) &&
    (await tableColumnIsNotNull(db, "catalog_exercises", "equipment_id"))
  ) {
    await dropCatalogCacheTables(db);
    return;
  }

  if (
    (await tableExists(db, "catalog_exercise_variants")) ||
    (await tableExists(db, "catalog_exercise_families")) ||
    (await tableExists(db, "catalog_exercise_levels")) ||
    (await tableExists(db, "catalog_exercise_level_formats")) ||
    (await tableExists(db, "catalog_seance_templates")) ||
    (await tableExists(db, "catalog_level_seance_templates")) ||
    (await tableExists(db, "catalog_session_definitions")) ||
    (await tableExists(db, "catalog_seance_template_sessions")) ||
    (await tableExists(db, "catalog_sessions")) ||
    (await tableExists(db, "catalog_level_sessions")) ||
    (await tableExists(db, "catalog_session_exercises"))
  ) {
    await dropCatalogCacheTables(db);
  }
}

const catalogPillarRepairTable = "_catalog_pillars_v2_repair";
const catalogEquipmentRepairTable = "_catalog_equipment_v2_repair";
const trainingSnapshotRepairTable = "_trainings_v32_repair";
const seanceSnapshotRepairTable = "_seances_v32_repair";

async function hasOutdatedWeeklyProgramSnapshotSchema(db: LocalDatabase) {
  const trainingSql = await tableSql(db, "trainings");
  const seanceSql = await tableSql(db, "seances");
  if (!trainingSql || !seanceSql) return false;

  return (
    !(await tableHasColumn(db, "trainings", "scheduled_date")) ||
    !(await tableHasColumn(
      db,
      "trainings",
      "generation_profile_fingerprint",
    )) ||
    trainingSql.includes("'renforcement'") ||
    seanceSql.includes("'renforcement'")
  );
}

async function repairOutdatedWeeklyProgramSnapshotSchema(
  db: LocalDatabase,
) {
  const trainingSql = await tableSql(db, "trainings");
  const trainingUsesLegacyPillarVocabulary =
    trainingSql?.includes("'renforcement'") ?? false;
  const seanceSql = await tableSql(db, "seances");
  const seanceUsesLegacyPillarVocabulary =
    seanceSql?.includes("'renforcement'") ?? false;

  if (!trainingUsesLegacyPillarVocabulary) {
    await ensureColumn(db, "trainings", "scheduled_date", "TEXT");
    await ensureColumn(
      db,
      "trainings",
      "generation_profile_fingerprint",
      "TEXT",
    );
  } else {
    const scheduledDate = (await tableHasColumn(
      db,
      "trainings",
      "scheduled_date",
    ))
      ? "scheduled_date"
      : "NULL";
    const generationProfileFingerprint = (await tableHasColumn(
      db,
      "trainings",
      "generation_profile_fingerprint",
    ))
      ? "generation_profile_fingerprint"
      : "NULL";

    await db.execAsync(`
    DROP TABLE IF EXISTS ${trainingSnapshotRepairTable};
    CREATE TABLE ${trainingSnapshotRepairTable} (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      program_id INTEGER NOT NULL REFERENCES programs(id) ON DELETE CASCADE,
      code TEXT NOT NULL,
      day_label TEXT NOT NULL,
      title TEXT NOT NULL,
      dominant_pillar TEXT NOT NULL CHECK (
        dominant_pillar IN ('strength', 'cardio', 'proprioception')
      ),
      duration_minutes INTEGER NOT NULL CHECK (duration_minutes > 0),
      status TEXT NOT NULL DEFAULT 'a faire' CHECK (
        status IN ('a faire', 'terminee', 'reportee')
      ),
      scheduled_date TEXT,
      generation_profile_fingerprint TEXT,
      sort_order INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      UNIQUE (program_id, code)
    );

    INSERT INTO ${trainingSnapshotRepairTable} (
      id, program_id, code, day_label, title, dominant_pillar,
      duration_minutes, status, scheduled_date,
      generation_profile_fingerprint, sort_order, created_at, updated_at
    )
    SELECT id,
           program_id,
           code,
           day_label,
           title,
           CASE dominant_pillar
             WHEN 'renforcement' THEN 'strength'
             ELSE dominant_pillar
           END,
           duration_minutes,
           status,
           ${scheduledDate},
           ${generationProfileFingerprint},
           sort_order,
           created_at,
           updated_at
    FROM trainings;

    DROP TABLE trainings;
    ALTER TABLE ${trainingSnapshotRepairTable} RENAME TO trainings;
    CREATE INDEX IF NOT EXISTS trainings_program_sort_idx
      ON trainings (program_id, sort_order, code);
  `);
  }

  if (!seanceUsesLegacyPillarVocabulary) return;

  await db.execAsync(`
    DROP TABLE IF EXISTS ${seanceSnapshotRepairTable};
    CREATE TABLE ${seanceSnapshotRepairTable} (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      training_id INTEGER NOT NULL REFERENCES trainings(id) ON DELETE CASCADE,
      code TEXT NOT NULL,
      phase TEXT NOT NULL CHECK (phase IN ('warmup', 'main', 'cooldown')),
      pillar TEXT CHECK (pillar IN ('strength', 'cardio', 'proprioception')),
      title TEXT NOT NULL,
      sort_order INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      UNIQUE (training_id, code)
    );

    INSERT INTO ${seanceSnapshotRepairTable} (
      id, training_id, code, phase, pillar, title, sort_order, created_at, updated_at
    )
    SELECT id,
           training_id,
           code,
           phase,
           CASE pillar
             WHEN 'renforcement' THEN 'strength'
             ELSE pillar
           END,
           title,
           sort_order,
           created_at,
           updated_at
    FROM seances;

    DROP TABLE seances;
    ALTER TABLE ${seanceSnapshotRepairTable} RENAME TO seances;
    CREATE INDEX IF NOT EXISTS seances_training_sort_idx
      ON seances (training_id, sort_order, code);
  `);
}

async function hasOrphanedCatalogEquipmentOptionItems(db: LocalDatabase) {
  if (
    !(await tableExists(db, "catalog_exercise_equipment_option_items")) ||
    !(await tableExists(db, "catalog_exercise_equipment_options")) ||
    !(await tableExists(db, "catalog_equipment"))
  ) {
    return false;
  }

  const orphan = await db.getFirstAsync<{ option_id: number }>(
    `SELECT items.option_id
     FROM catalog_exercise_equipment_option_items items
     LEFT JOIN catalog_exercise_equipment_options options
       ON options.id = items.option_id
     LEFT JOIN catalog_equipment equipment ON equipment.id = items.equipment_id
     WHERE options.id IS NULL OR equipment.id IS NULL
     LIMIT 1;`,
  );
  return Boolean(orphan);
}

async function repairOrphanedCatalogEquipmentOptionItems(db: LocalDatabase) {
  await db.execAsync(`
    DELETE FROM catalog_exercise_equipment_option_items
    WHERE NOT EXISTS (
      SELECT 1 FROM catalog_exercise_equipment_options
      WHERE catalog_exercise_equipment_options.id = catalog_exercise_equipment_option_items.option_id
    )
    OR NOT EXISTS (
      SELECT 1 FROM catalog_equipment
      WHERE catalog_equipment.id = catalog_exercise_equipment_option_items.equipment_id
    );
  `);
}

async function hasOutdatedCatalogPillarVocabulary(db: LocalDatabase) {
  const sql = await tableSql(db, "catalog_pillars");
  if (!sql) return tableExists(db, catalogPillarRepairTable);
  return (
    sql.includes("'echauffement'") ||
    sql.includes("'renforcement'") ||
    sql.includes("'assouplissement'")
  );
}

async function repairOutdatedCatalogPillarVocabulary(db: LocalDatabase) {
  const currentTableExists = await tableExists(db, "catalog_pillars");
  await db.execAsync(`
    CREATE TABLE IF NOT EXISTS ${catalogPillarRepairTable} (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      code TEXT NOT NULL UNIQUE CHECK (
        code IN ('warm-up', 'cardio', 'strength', 'proprioception', 'flexibility')
      ),
      label TEXT NOT NULL
    );
  `);

  if (currentTableExists) {
    await db.execAsync(`
      DELETE FROM ${catalogPillarRepairTable};
      INSERT INTO ${catalogPillarRepairTable} (id, code, label)
      SELECT id,
             CASE code
               WHEN 'echauffement' THEN 'warm-up'
               WHEN 'renforcement' THEN 'strength'
               WHEN 'assouplissement' THEN 'flexibility'
               ELSE code
             END,
             label
      FROM catalog_pillars;
      DROP TABLE catalog_pillars;
    `);
  }

  await db.execAsync(
    `ALTER TABLE ${catalogPillarRepairTable} RENAME TO catalog_pillars;`,
  );
}

async function hasOutdatedCatalogEquipmentVocabulary(db: LocalDatabase) {
  if (!(await tableExists(db, "catalog_equipment"))) {
    return tableExists(db, catalogEquipmentRepairTable);
  }

  const legacyEquipment = await db.getFirstAsync<{ code: string }>(
    `SELECT code
     FROM catalog_equipment
     WHERE code IN (
       'mur', 'chaise', 'plan-de-travail', 'canape', 'marche', 'porte',
       'serviette', 'anneaux', 'barre-traction', 'barre-basse',
       'barre-verticale', 'barres-paralleles', 'banc', 'elastique',
       'corde-a-sauter', 'rameur', 'tapis-de-course', 'tapis-de-sol', 'velo'
     )
     LIMIT 1;`,
  );
  return Boolean(legacyEquipment);
}

async function repairOutdatedCatalogEquipmentVocabulary(db: LocalDatabase) {
  const currentTableExists = await tableExists(db, "catalog_equipment");
  await db.execAsync(`
    CREATE TABLE IF NOT EXISTS ${catalogEquipmentRepairTable} (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      code TEXT NOT NULL UNIQUE,
      label TEXT NOT NULL,
      category TEXT NOT NULL CHECK (category IN ('maison', 'sport'))
    );
  `);

  if (currentTableExists) {
    // Le schéma V32 a pu ajouter un index unique sur le libellé. Il est
    // compatible avec un cache déjà canonique, mais empêche la conversion
    // code français -> code canonique car les libellés restent identiques.
    await db.execAsync(`
      DELETE FROM ${catalogEquipmentRepairTable};
      INSERT INTO ${catalogEquipmentRepairTable} (id, code, label, category)
      SELECT id,
             CASE code
               WHEN 'mur' THEN 'wall'
               WHEN 'chaise' THEN 'chair'
               WHEN 'plan-de-travail' THEN 'countertop'
               WHEN 'canape' THEN 'couch'
               WHEN 'marche' THEN 'stair'
               WHEN 'porte' THEN 'door'
               WHEN 'serviette' THEN 'towel'
               WHEN 'anneaux' THEN 'rings'
               WHEN 'barre-traction' THEN 'pull-up-bar'
               WHEN 'barre-basse' THEN 'low-bar'
               WHEN 'barre-verticale' THEN 'vertical-bar'
               WHEN 'barres-paralleles' THEN 'parallel-bars'
               WHEN 'banc' THEN 'bench'
               WHEN 'elastique' THEN 'resistance-band'
               WHEN 'corde-a-sauter' THEN 'jump-rope'
               WHEN 'rameur' THEN 'rowing-machine'
               WHEN 'tapis-de-course' THEN 'treadmill'
               WHEN 'tapis-de-sol' THEN 'exercise-mat'
               WHEN 'velo' THEN 'stationary-bike'
               ELSE code
             END,
             label,
             category
      FROM catalog_equipment;
      DROP TABLE catalog_equipment;
    `);
  }

  await db.execAsync(
    `ALTER TABLE ${catalogEquipmentRepairTable} RENAME TO catalog_equipment;`,
  );
}

async function dropCatalogCacheTables(db: LocalDatabase) {
  await db.execAsync(`
    DROP TABLE IF EXISTS catalog_session_exercises;
    DROP TABLE IF EXISTS catalog_level_sessions;
    DROP TABLE IF EXISTS catalog_sessions;
    DROP TABLE IF EXISTS catalog_session_template_levels;
    DROP TABLE IF EXISTS catalog_session_templates;
    DROP TABLE IF EXISTS catalog_seance_template_sessions;
    DROP TABLE IF EXISTS catalog_level_seance_templates;
    DROP TABLE IF EXISTS catalog_seance_templates;
    DROP TABLE IF EXISTS catalog_session_definitions;
    DROP TABLE IF EXISTS catalog_exercise_level_formats;
    DROP TABLE IF EXISTS catalog_exercise_levels;
    DROP TABLE IF EXISTS catalog_exercise_variants;
    DROP TABLE IF EXISTS catalog_exercise_families;
    DROP TABLE IF EXISTS catalog_exercise_muscle_groups;
    DROP TABLE IF EXISTS catalog_exercise_equipment_option_items;
    DROP TABLE IF EXISTS catalog_exercise_equipment_options;
    DROP TABLE IF EXISTS catalog_formats;
    DROP TABLE IF EXISTS catalog_series;
    DROP TABLE IF EXISTS catalog_repetitions;
    DROP TABLE IF EXISTS catalog_rests;
    DROP TABLE IF EXISTS catalog_intervals;
    DROP TABLE IF EXISTS catalog_exercises;
    DROP TABLE IF EXISTS catalog_equipment;
    DROP TABLE IF EXISTS catalog_impacts;
    DROP TABLE IF EXISTS catalog_families;
    DROP TABLE IF EXISTS catalog_types;
    DROP TABLE IF EXISTS catalog_muscle_groups;
    DROP TABLE IF EXISTS catalog_types;
    DROP TABLE IF EXISTS catalog_pillars;
  `);
}

async function tableColumnIsNotNull(
  db: LocalDatabase,
  tableName: string,
  columnName: string,
) {
  const rows = await db.getAllAsync<{ name: string; notnull: number }>(
    `PRAGMA table_info(${tableName});`,
  );
  return rows.some((row) => row.name === columnName && row.notnull === 1);
}

async function tableColumnHasType(
  db: LocalDatabase,
  tableName: string,
  columnName: string,
  expectedType: string,
) {
  const rows = await db.getAllAsync<{ name: string; type: string }>(
    `PRAGMA table_info(${tableName});`,
  );
  return rows.some(
    (row) => row.name === columnName && row.type.toUpperCase() === expectedType,
  );
}

async function tableSql(db: LocalDatabase, tableName: string) {
  const row = await db.getFirstAsync<{ sql: string | null }>(
    "SELECT sql FROM sqlite_master WHERE type = 'table' AND name = ?",
    [tableName],
  );
  return row?.sql ?? null;
}

async function dropLegacyTables(db: LocalDatabase) {
  await db.execAsync(`
    DROP INDEX IF EXISTS training_block_performances_profile_session_idx;
    DROP INDEX IF EXISTS training_session_feedback_profile_session_idx;
    DROP TABLE IF EXISTS exercises;
    DROP TABLE IF EXISTS training_block_performances;
    DROP TABLE IF EXISTS training_session_feedback;
  `);
}

async function tableHasTextId(db: LocalDatabase, tableName: string) {
  const columns = await db.getAllAsync<{ name: string; type: string }>(
    `PRAGMA table_info(${tableName});`,
  );
  const idColumn = columns.find((column) => column.name === "id");

  return idColumn?.type.toUpperCase().includes("TEXT") ?? false;
}

async function tableExists(db: LocalDatabase, tableName: string) {
  const rows = await db.getAllAsync<{ name: string }>(
    "SELECT name FROM sqlite_master WHERE type = 'table' AND name = ? LIMIT 1;",
    [tableName],
  );

  return rows.length > 0;
}

async function tableHasColumn(
  db: LocalDatabase,
  tableName: string,
  columnName: string,
) {
  const rows = await db.getAllAsync<{ name: string }>(
    `PRAGMA table_info(${tableName});`,
  );

  return rows.some((row) => row.name === columnName);
}
