import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
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
const databaseSource = await fs.readFile(
  path.join(projectRoot, "src/shared/db/database.ts"),
  "utf8",
);
const catalogRepositorySource = await fs.readFile(
  path.join(
    projectRoot,
    "src/features/catalog/services/catalogRepository.ts",
  ),
  "utf8",
);
const catalogDatabaseRepositorySources = await Promise.all(
  [
    "catalogEquipmentRepository.ts",
    "catalogExerciseRepository.ts",
    "catalogFormatRepository.ts",
    "catalogSessionRepository.ts",
  ].map((fileName) =>
    fs.readFile(
      path.join(projectRoot, "src/features/catalog/services", fileName),
      "utf8",
    ),
  ),
);
const trainingRepositorySource = await fs.readFile(
  path.join(
    projectRoot,
    "src/features/training/services/blockPerformanceRepository.ts",
  ),
  "utf8",
);

test("database runtime delegates schema changes to the migration boundary", () => {
  assert.match(databaseSource, /runLocalDatabaseMigrations\(db\)/);
  assert.doesNotMatch(databaseSource, /CREATE TABLE|ALTER TABLE|user_version/);
});

test("feature repositories depend on the local database port, not Expo SQLite", () => {
  assert.match(trainingRepositorySource, /\bwithDatabase\b/);
  assert.match(
    catalogDatabaseRepositorySources.join("\n"),
    /\bLocalDatabase\b/,
  );
  for (const source of catalogDatabaseRepositorySources) {
    assert.match(source, /\b(?:LocalDatabase|withDatabase)\b/);
    assert.doesNotMatch(source, /from ["']expo-sqlite["']/);
  }
  assert.match(catalogRepositorySource, /catalogExerciseRepository/);
  assert.doesNotMatch(catalogRepositorySource, /from ["']expo-sqlite["']/);
  assert.doesNotMatch(trainingRepositorySource, /from ["']expo-sqlite["']/);
});

test("migration keeps the established schema version and pragma order", async () => {
  const fake = createMigrationDatabase();

  await migrations.runLocalDatabaseMigrations(fake.database);

  assert.equal(fake.execStatements[0], "PRAGMA foreign_keys = OFF;");
  assert.equal(fake.execStatements[1], "PRAGMA journal_mode = WAL;");
  assert.equal(fake.execStatements.at(-1), "PRAGMA foreign_keys = ON;");
  assert.equal(fake.transactions, 1);
  assert.equal(migrations.localDatabaseSchemaVersion, 33);
  assert.ok(
    fake.execStatements.some((statement) =>
      statement.includes(
        `PRAGMA user_version = ${migrations.localDatabaseSchemaVersion};`,
      ),
    ),
  );
});

test("current v33 schemas do not replay write migrations on startup", async () => {
  const fake = createMigrationDatabase({
    userVersion: migrations.localDatabaseSchemaVersion,
  });

  await migrations.runLocalDatabaseMigrations(fake.database);

  assert.deepEqual(fake.execStatements, []);
  assert.equal(fake.transactions, 0);
});

test("a v32 catalogue only receives the progressive cache migration", async () => {
  const fake = createMigrationDatabase({ userVersion: 32 });

  await migrations.runLocalDatabaseMigrations(fake.database);

  const schema = fake.execStatements.join("\n");
  assert.match(schema, /CREATE TABLE IF NOT EXISTS catalog_cache_entries/);
  assert.match(schema, /CREATE TABLE IF NOT EXISTS catalog_release_updates/);
  assert.equal(fake.transactions, 1);
});

test("migration preserves the catalog and weekly-program integrity guards", async () => {
  const fake = createMigrationDatabase();

  await migrations.runLocalDatabaseMigrations(fake.database);

  const schema = fake.execStatements.join("\n");
  assert.match(schema, /sessions_require_catalog_ids_insert/);
  assert.match(schema, /session_feedback_require_catalog_ids_insert/);
  assert.match(schema, /programs_require_profile_insert/);
  assert.match(schema, /session_feedback_execution_unique/);
});

test("migration indexes exercise catalogue foreign keys locally", async () => {
  const fake = createMigrationDatabase();

  await migrations.runLocalDatabaseMigrations(fake.database);

  const schema = fake.execStatements.join("\n");
  for (const indexName of [
    "catalog_exercises_progression_exercise_id_idx",
    "catalog_exercises_regression_exercise_id_idx",
    "acrea_level_evaluation_mappings_exercise_slug_idx",
    "acrea_level_evaluation_preferences_exercise_slug_idx",
    "acrea_exercise_progressions_exercise_id_idx",
    "acrea_profile_excluded_exercises_exercise_id_idx",
  ]) {
    assert.match(schema, new RegExp(indexName));
  }
});

test("migration rejects a schema with foreign-key violations", async () => {
  const fake = createMigrationDatabase({
    foreignKeyErrors: [{ table: "sessions" }],
  });

  await assert.rejects(
    migrations.runLocalDatabaseMigrations(fake.database),
    /Migration SQLite invalide: sessions/,
  );
  assert.equal(fake.execStatements.at(-1), "PRAGMA foreign_keys = ON;");
  assert.equal(
    fake.execStatements.some((statement) =>
      statement.includes("PRAGMA user_version ="),
    ),
    false,
  );
});

function createMigrationDatabase({ foreignKeyErrors = [], userVersion = 0 } = {}) {
  const execStatements = [];
  let transactions = 0;
  const database = {
    async execAsync(statement) {
      execStatements.push(statement);
    },
    async getAllAsync(statement) {
      if (statement === "PRAGMA foreign_key_check;") return foreignKeyErrors;
      return [];
    },
    async getFirstAsync(statement) {
      if (statement === "PRAGMA user_version;") {
        return { user_version: userVersion };
      }
      return null;
    },
    async runAsync() {
      return { changes: 0, lastInsertRowId: 0 };
    },
    async withTransactionAsync(task) {
      transactions += 1;
      await task();
    },
  };

  return {
    database,
    execStatements,
    get transactions() {
      return transactions;
    },
  };
}
