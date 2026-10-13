import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import test from "node:test";
import ts from "typescript";
import { fileURLToPath } from "node:url";

const projectRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
);
const migrationsSourcePath = path.join(
  projectRoot,
  "src/shared/db/migrations.ts",
);
const migrationsSource = await fs.readFile(migrationsSourcePath, "utf8");
const migrationsCompiled = ts.transpileModule(migrationsSource, {
  compilerOptions: {
    module: ts.ModuleKind.ESNext,
    target: ts.ScriptTarget.ES2022,
  },
  fileName: migrationsSourcePath,
}).outputText;
const migrations = await import(
  `data:text/javascript;base64,${Buffer.from(migrationsCompiled).toString("base64")}`
);

test("real SQLite migration creates a valid v33 database from scratch", async () => {
  const sqlite = new DatabaseSync(":memory:");
  try {
    const database = createLocalDatabaseAdapter(sqlite);

    await migrations.runLocalDatabaseMigrations(database);

    assert.equal(
      sqlite.prepare("PRAGMA user_version").get().user_version,
      migrations.localDatabaseSchemaVersion,
    );
    assert.deepEqual(sqlite.prepare("PRAGMA foreign_key_check").all(), []);
    assert.equal(tableExists(sqlite, "catalog_exercise_successors"), true);
    assert.equal(tableExists(sqlite, "catalog_cache_entries"), true);
    assert.equal(tableExists(sqlite, "catalog_release_updates"), true);
    assert.equal(tableExists(sqlite, "catalog_release_activations"), true);
    assert.equal(
      columnExists(sqlite, "catalog_exercises", "source_key"),
      true,
    );
    assert.equal(
      columnExists(
        sqlite,
        "acrea_level_evaluation_exercise_mappings",
        "exercise_slug",
      ),
      true,
    );
  } finally {
    sqlite.close();
  }
});

test("real SQLite migration upgrades the v29 exercise shape", async () => {
  const sqlite = new DatabaseSync(":memory:");
  try {
    sqlite.exec(`
      CREATE TABLE catalog_exercises (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        code TEXT NOT NULL UNIQUE,
        label TEXT NOT NULL,
        pillar_id INTEGER NOT NULL,
        difficulty INTEGER NOT NULL CHECK (difficulty BETWEEN 1 AND 10),
        impact_id INTEGER NOT NULL,
        family_id INTEGER NOT NULL,
        type_id INTEGER NOT NULL,
        equipment_id INTEGER,
        regression_exercise_id INTEGER,
        progression_exercise_id INTEGER,
        movement_description TEXT NOT NULL DEFAULT '',
        start_position TEXT NOT NULL DEFAULT '',
        outbound_execution TEXT NOT NULL DEFAULT '',
        return_execution TEXT NOT NULL DEFAULT '',
        adapted_version TEXT NOT NULL DEFAULT '',
        tips TEXT NOT NULL DEFAULT '',
        errors TEXT NOT NULL DEFAULT ''
      );
      CREATE TABLE acrea_profiles (
        profile_id TEXT PRIMARY KEY NOT NULL,
        name TEXT NOT NULL,
        objective TEXT,
        objective_code TEXT,
        equipment_mode TEXT,
        weekly_frequency INTEGER,
        average_session_minutes INTEGER,
        session_minutes_min INTEGER,
        session_minutes_max INTEGER,
        weekly_novelty_percent INTEGER,
        level_test_status TEXT NOT NULL DEFAULT 'required',
        level_test_version INTEGER NOT NULL DEFAULT 0,
        level_test_completed_at TEXT,
        renforcement_level INTEGER,
        cardio_level INTEGER,
        proprioception_level INTEGER,
        preferred_weekdays_json TEXT NOT NULL DEFAULT '[]',
        sync_status TEXT NOT NULL DEFAULT 'local',
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );
      CREATE TABLE acrea_level_evaluation_attempts (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        profile_id TEXT NOT NULL REFERENCES acrea_profiles(profile_id),
        remote_attempt_id INTEGER,
        protocol_version INTEGER NOT NULL,
        attempt_kind TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'in_progress',
        sync_status TEXT NOT NULL DEFAULT 'pending',
        started_at TEXT NOT NULL,
        completed_at TEXT,
        superseded_at TEXT
      );
      CREATE TABLE acrea_level_evaluation_preferences (
        profile_id TEXT NOT NULL REFERENCES acrea_profiles(profile_id),
        protocol_version INTEGER NOT NULL,
        evaluation_exercise_code TEXT NOT NULL,
        catalog_exercise_code TEXT NOT NULL REFERENCES catalog_exercises(code),
        appreciation_average REAL NOT NULL,
        sample_count INTEGER NOT NULL,
        evaluated_at TEXT NOT NULL,
        sync_status TEXT NOT NULL DEFAULT 'pending',
        PRIMARY KEY (profile_id, protocol_version, catalog_exercise_code)
      );
      INSERT INTO catalog_exercises (
        code, label, pillar_id, difficulty, impact_id, family_id, type_id
      ) VALUES ('legacy-exercise', 'Exercice historique', 1, 1, 1, 1, 1);
      INSERT INTO acrea_profiles (
        profile_id, name, objective, objective_code, equipment_mode,
        weekly_frequency, average_session_minutes, session_minutes_min,
        session_minutes_max, weekly_novelty_percent, level_test_status,
        level_test_version, renforcement_level, cardio_level,
        proprioception_level, preferred_weekdays_json, sync_status,
        created_at, updated_at
      ) VALUES (
        'legacy-profile', 'Profil historique', 'Continuer', 'complete',
        'aucun', 3, 35, 30, 45, 50, 'required', 0, 2, 2, 1,
        '[1,3,5]', 'local', datetime('now'), datetime('now')
      );
      INSERT INTO acrea_level_evaluation_attempts (
        profile_id, protocol_version, attempt_kind, status, sync_status,
        started_at
      ) VALUES (
        'legacy-profile', 3, 'initial', 'in_progress', 'pending',
        datetime('now')
      );
      INSERT INTO acrea_level_evaluation_preferences (
        profile_id, protocol_version, evaluation_exercise_code,
        catalog_exercise_code, appreciation_average, sample_count,
        evaluated_at, sync_status
      ) VALUES (
        'legacy-profile', 3, 'eval-legacy', 'legacy-exercise', 4, 2,
        datetime('now'), 'pending'
      );
      PRAGMA user_version = 29;
    `);

    await migrations.runLocalDatabaseMigrations(
      createLocalDatabaseAdapter(sqlite),
    );

    assert.equal(
      sqlite.prepare("PRAGMA user_version").get().user_version,
      migrations.localDatabaseSchemaVersion,
    );
    assert.equal(columnExists(sqlite, "catalog_exercises", "slug"), true);
    assert.equal(
      columnExists(sqlite, "catalog_exercises", "source_key"),
      true,
    );
    assert.equal(
      columnExists(sqlite, "catalog_exercises", "release_id"),
      true,
    );
    assert.equal(
      sqlite.prepare("SELECT COUNT(*) AS count FROM acrea_profiles").get()
        .count,
      1,
    );
    assert.equal(
      sqlite
        .prepare(
          "SELECT COUNT(*) AS count FROM acrea_level_evaluation_attempts",
        )
        .get().count,
      1,
    );
    assert.deepEqual(
      {
        ...sqlite
          .prepare(
            `SELECT exercise_slug, appreciation_average, sample_count
             FROM acrea_level_evaluation_preferences`,
          )
          .get(),
      },
      {
        exercise_slug: "legacy-exercise",
        appreciation_average: 4,
        sample_count: 2,
      },
    );
    assert.equal(
      sqlite
        .prepare("PRAGMA foreign_key_list(catalog_exercises)")
        .all()
        .some(
          (foreignKey) =>
            foreignKey.from === "release_id" &&
            foreignKey.table === "catalog_releases",
        ),
      true,
    );
    assert.throws(() =>
      sqlite
        .prepare(
          "UPDATE catalog_exercises SET review_status = 'invalid-status'",
        )
        .run(),
    );
    assert.throws(() =>
      sqlite
        .prepare("UPDATE catalog_exercises SET release_id = 999999")
        .run(),
    );
    assert.deepEqual(sqlite.prepare("PRAGMA foreign_key_check").all(), []);
  } finally {
    sqlite.close();
  }
});

test("v33 rerun preserves local user and catalogue history", async () => {
  const sqlite = new DatabaseSync(":memory:");
  try {
    const database = createLocalDatabaseAdapter(sqlite);
    await migrations.runLocalDatabaseMigrations(database);
    sqlite.exec(`
      INSERT INTO catalog_pillars (code, label)
      VALUES ('strength', 'Renforcement');
      INSERT INTO catalog_impacts (code, label)
      VALUES ('faible', 'Faible');
      INSERT INTO catalog_families (code, label)
      VALUES ('corps-entier', 'Corps entier');
      INSERT INTO catalog_types (code, label)
      VALUES ('force', 'Force');
      INSERT INTO catalog_exercises (
        code, label, slug, label_fr, label_en, source_key, pillar_id,
        difficulty, impact_id, family_id, type_id, updated_at
      )
      SELECT 'sentinel-exercise', 'Exercice sentinelle', 'sentinel-exercise',
             'Exercice sentinelle', 'Sentinel exercise', 'sentinel-exercise',
             pillar.id, 1, impact.id, family.id, type.id, datetime('now')
      FROM catalog_pillars pillar, catalog_impacts impact,
           catalog_families family, catalog_types type
      WHERE pillar.code = 'strength'
        AND impact.code = 'faible'
        AND family.code = 'corps-entier'
        AND type.code = 'force';
      INSERT INTO acrea_profiles (
        profile_id, name, objective, objective_code, equipment_mode,
        weekly_frequency, average_session_minutes, session_minutes_min,
        session_minutes_max, weekly_novelty_percent, level_test_status,
        level_test_version, renforcement_level, cardio_level,
        proprioception_level, preferred_weekdays_json, sync_status,
        created_at, updated_at
      ) VALUES (
        'sentinel-profile', 'Profil sentinelle', 'Continuer', 'complete',
        'aucun', 3, 35, 30, 45, 50, 'required', 0, 2, 2, 1,
        '[1,3,5]', 'local', datetime('now'), datetime('now')
      );
      INSERT INTO acrea_level_evaluation_attempts (
        profile_id, protocol_version, attempt_kind, status, sync_status,
        started_at
      ) VALUES (
        'sentinel-profile', 3, 'initial', 'in_progress', 'pending',
        datetime('now')
      );
      INSERT INTO catalog_exercise_successors (
        legacy_exercise_id, successor_source_key, successor_exercise_id,
        mapping_kind, confidence, resolution_status, source_status,
        updated_at
      )
      SELECT id, 'sentinel-exercise', id, 'exact', 'high', 'resolved',
             'test', datetime('now')
      FROM catalog_exercises WHERE code = 'sentinel-exercise';
      PRAGMA user_version = 31;
    `);

    await migrations.runLocalDatabaseMigrations(database);

    assert.equal(
      sqlite
        .prepare("SELECT COUNT(*) AS count FROM acrea_profiles")
        .get().count,
      1,
    );
    assert.equal(
      sqlite
        .prepare(
          "SELECT COUNT(*) AS count FROM acrea_level_evaluation_attempts",
        )
        .get().count,
      1,
    );
    assert.equal(
      sqlite
        .prepare("SELECT COUNT(*) AS count FROM catalog_exercises")
        .get().count,
      1,
    );
    assert.equal(
      sqlite
        .prepare("SELECT COUNT(*) AS count FROM catalog_exercise_successors")
        .get().count,
      1,
    );
    assert.deepEqual(sqlite.prepare("PRAGMA foreign_key_check").all(), []);
  } finally {
    sqlite.close();
  }
});

test("v32 repair normalizes inherited catalog vocabulary without losing profile or evaluation rows", async () => {
  const sqlite = new DatabaseSync(":memory:");
  try {
    const database = createLocalDatabaseAdapter(sqlite);
    await migrations.runLocalDatabaseMigrations(database);
    sqlite.exec(`
      INSERT INTO acrea_profiles (
        profile_id, name, level_test_status, level_test_version,
        preferred_weekdays_json, sync_status, created_at, updated_at
      ) VALUES (
        'retained-profile', 'Profil conservé', 'required', 0,
        '[]', 'local', datetime('now'), datetime('now')
      );
      INSERT INTO acrea_level_evaluation_attempts (
        profile_id, protocol_version, attempt_kind, status, sync_status,
        started_at, completed_at
      ) VALUES (
        'retained-profile', 4, 'initial', 'completed', 'synced',
        '2026-08-11T10:00:00.000Z', '2026-08-11T10:10:00.000Z'
      );
      PRAGMA foreign_keys = OFF;
      DROP TABLE catalog_pillars;
      CREATE TABLE catalog_pillars (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        code TEXT NOT NULL UNIQUE CHECK (
          code IN ('echauffement', 'cardio', 'renforcement', 'proprioception', 'assouplissement')
        ),
        label TEXT NOT NULL
      );
      INSERT INTO catalog_pillars (id, code, label) VALUES
        (1, 'echauffement', 'Activation'), (2, 'cardio', 'Cardio'),
        (3, 'renforcement', 'Renforcement'), (4, 'proprioception', 'Équilibre'),
        (5, 'assouplissement', 'Assouplissement');
      INSERT INTO catalog_equipment (id, code, label, category) VALUES
        (1, 'mur', 'Mur', 'maison'),
        (2, 'barre-traction', 'Barre de traction', 'sport');
      INSERT INTO acrea_profile_equipment (profile_id, equipment_id)
      VALUES ('retained-profile', 1);
      PRAGMA foreign_keys = ON;
      PRAGMA user_version = 32;
    `);

    await migrations.runLocalDatabaseMigrations(database);

    assert.deepEqual(
      sqlite
        .prepare("SELECT id, code FROM catalog_pillars ORDER BY id")
        .all()
        .map((row) => ({ ...row })),
      [
        { id: 1, code: "warm-up" },
        { id: 2, code: "cardio" },
        { id: 3, code: "strength" },
        { id: 4, code: "proprioception" },
        { id: 5, code: "flexibility" },
      ],
    );
    assert.deepEqual(
      sqlite
        .prepare("SELECT id, code FROM catalog_equipment ORDER BY id")
        .all()
        .map((row) => ({ ...row })),
      [
        { id: 1, code: "wall" },
        { id: 2, code: "pull-up-bar" },
      ],
    );
    assert.equal(
      sqlite
        .prepare(
          "SELECT COUNT(*) AS count FROM sqlite_master WHERE type = 'index' AND name = 'catalog_equipment_label_unique'",
        )
        .get().count,
      0,
    );
    assert.deepEqual(
      {
        ...sqlite
          .prepare(
            `SELECT equipment.code
             FROM acrea_profile_equipment profile_equipment
             JOIN catalog_equipment equipment ON equipment.id = profile_equipment.equipment_id
             WHERE profile_equipment.profile_id = 'retained-profile'`,
          )
          .get(),
      },
      { code: "wall" },
    );
    assert.equal(
      sqlite.prepare("SELECT COUNT(*) AS count FROM acrea_profiles").get().count,
      1,
    );
    assert.deepEqual(
      {
        ...sqlite
          .prepare(
            "SELECT status, completed_at FROM acrea_level_evaluation_attempts",
          )
          .get(),
      },
      { status: "completed", completed_at: "2026-08-11T10:10:00.000Z" },
    );
    assert.deepEqual(sqlite.prepare("PRAGMA foreign_key_check").all(), []);
  } finally {
    sqlite.close();
  }
});

test("v32 repair restores stale training snapshot columns without losing profile or evaluation rows", async () => {
  const sqlite = new DatabaseSync(":memory:");
  try {
    const database = createLocalDatabaseAdapter(sqlite);
    await migrations.runLocalDatabaseMigrations(database);
    sqlite.exec(`
      INSERT INTO acrea_profiles (
        profile_id, name, level_test_status, level_test_version,
        preferred_weekdays_json, sync_status, created_at, updated_at
      ) VALUES (
        'retained-profile', 'Profil conservé', 'required', 0,
        '[]', 'local', datetime('now'), datetime('now')
      );
      INSERT INTO acrea_level_evaluation_attempts (
        profile_id, protocol_version, attempt_kind, status, sync_status,
        started_at, completed_at
      ) VALUES (
        'retained-profile', 4, 'initial', 'completed', 'synced',
        '2026-08-11T10:00:00.000Z', '2026-08-11T10:10:00.000Z'
      );
      PRAGMA foreign_keys = OFF;
      DROP TABLE trainings;
      CREATE TABLE trainings (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        program_id INTEGER NOT NULL REFERENCES programs(id) ON DELETE CASCADE,
        code TEXT NOT NULL,
        day_label TEXT NOT NULL,
        title TEXT NOT NULL,
        dominant_pillar TEXT NOT NULL CHECK (
          dominant_pillar IN ('renforcement', 'cardio', 'proprioception')
        ),
        duration_minutes INTEGER NOT NULL CHECK (duration_minutes > 0),
        status TEXT NOT NULL DEFAULT 'a faire' CHECK (
          status IN ('a faire', 'terminee', 'reportee')
        ),
        sort_order INTEGER NOT NULL DEFAULT 0,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        UNIQUE (program_id, code)
      );
      DROP TABLE seances;
      CREATE TABLE seances (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        training_id INTEGER NOT NULL REFERENCES trainings(id) ON DELETE CASCADE,
        code TEXT NOT NULL,
        phase TEXT NOT NULL CHECK (phase IN ('warmup', 'main', 'cooldown')),
        pillar TEXT CHECK (pillar IN ('renforcement', 'cardio', 'proprioception')),
        title TEXT NOT NULL,
        sort_order INTEGER NOT NULL DEFAULT 0,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        UNIQUE (training_id, code)
      );
      INSERT INTO programs (
        profile_id, iso_week_year, iso_week_number, role, created_at, updated_at
      ) VALUES (
        'retained-profile', 2026, 33, 'user', datetime('now'), datetime('now')
      );
      INSERT INTO trainings (
        program_id, code, day_label, title, dominant_pillar,
        duration_minutes, status, sort_order, created_at, updated_at
      ) VALUES (
        1, 'legacy-training', 'Lundi', 'Séance historique', 'renforcement',
        30, 'a faire', 0, datetime('now'), datetime('now')
      );
      INSERT INTO seances (
        training_id, code, phase, pillar, title, sort_order, created_at, updated_at
      ) VALUES (
        1, 'legacy-seance', 'main', 'renforcement', 'Bloc historique', 0,
        datetime('now'), datetime('now')
      );
      INSERT INTO catalog_exercise_equipment_option_items (option_id, equipment_id)
      VALUES (999999, 999999);
      PRAGMA foreign_keys = ON;
      PRAGMA user_version = 32;
    `);

    await migrations.runLocalDatabaseMigrations(database);

    assert.equal(columnExists(sqlite, "trainings", "scheduled_date"), true);
    assert.equal(
      columnExists(sqlite, "trainings", "generation_profile_fingerprint"),
      true,
    );
    assert.deepEqual(
      {
        ...sqlite
          .prepare(
            "SELECT id, dominant_pillar FROM trainings WHERE code = 'legacy-training'",
          )
          .get(),
      },
      { id: 1, dominant_pillar: "strength" },
    );
    assert.deepEqual(
      {
        ...sqlite
          .prepare("SELECT training_id FROM seances WHERE code = 'legacy-seance'")
          .get(),
      },
      { training_id: 1 },
    );
    assert.deepEqual(
      {
        ...sqlite
          .prepare("SELECT pillar FROM seances WHERE code = 'legacy-seance'")
          .get(),
      },
      { pillar: "strength" },
    );
    assert.equal(
      sqlite
        .prepare(
          "SELECT COUNT(*) AS count FROM catalog_exercise_equipment_option_items",
        )
        .get().count,
      0,
    );
    assert.equal(
      sqlite.prepare("SELECT COUNT(*) AS count FROM acrea_profiles").get().count,
      1,
    );
    assert.deepEqual(
      {
        ...sqlite
          .prepare(
            "SELECT status, completed_at FROM acrea_level_evaluation_attempts",
          )
          .get(),
      },
      { status: "completed", completed_at: "2026-08-11T10:10:00.000Z" },
    );
    assert.deepEqual(sqlite.prepare("PRAGMA foreign_key_check").all(), []);
  } finally {
    sqlite.close();
  }
});

function createLocalDatabaseAdapter(sqlite) {
  let transactionDepth = 0;
  return {
    async execAsync(statement) {
      sqlite.exec(statement);
    },
    async getAllAsync(statement, parameters = []) {
      return sqlite.prepare(statement).all(...normalizeParameters(parameters));
    },
    async getFirstAsync(statement, parameters = []) {
      return (
        sqlite.prepare(statement).get(...normalizeParameters(parameters)) ?? null
      );
    },
    async runAsync(statement, parameters = []) {
      const result = sqlite
        .prepare(statement)
        .run(...normalizeParameters(parameters));
      return {
        changes: Number(result.changes),
        lastInsertRowId: Number(result.lastInsertRowid),
      };
    },
    async withTransactionAsync(task) {
      const savepoint = `test_transaction_${transactionDepth}`;
      if (transactionDepth === 0) sqlite.exec("BEGIN IMMEDIATE");
      else sqlite.exec(`SAVEPOINT ${savepoint}`);
      transactionDepth += 1;
      try {
        await task();
        transactionDepth -= 1;
        if (transactionDepth === 0) sqlite.exec("COMMIT");
        else sqlite.exec(`RELEASE SAVEPOINT ${savepoint}`);
      } catch (error) {
        transactionDepth -= 1;
        if (transactionDepth === 0) sqlite.exec("ROLLBACK");
        else sqlite.exec(`ROLLBACK TO SAVEPOINT ${savepoint}`);
        throw error;
      }
    },
  };
}

function normalizeParameters(parameters) {
  return Array.isArray(parameters) ? parameters : [parameters];
}

function tableExists(sqlite, tableName) {
  return Boolean(
    sqlite
      .prepare(
        "SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = ?",
      )
      .get(tableName),
  );
}

function columnExists(sqlite, tableName, columnName) {
  return sqlite
    .prepare(`PRAGMA table_info(${tableName})`)
    .all()
    .some((column) => column.name === columnName);
}
