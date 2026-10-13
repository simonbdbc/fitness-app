// @vitest-environment node

import { DatabaseSync, type SQLInputValue } from "node:sqlite";
import { describe, expect, it } from "vitest";

import type { LocalDatabase } from "@shared/db";

import {
  loadCanonicalExcludedExercises,
  loadCanonicalExerciseProgressions,
  loadCanonicalTrainingExerciseHistories,
} from "./catalogExerciseCanonicalizationRepository";

describe("catalog exercise history canonicalization", () => {
  it("maps historical state to active successors without rewriting stored rows", async () => {
    const sqlite = createFixtureDatabase();
    const database = sqliteAdapter(sqlite);

    try {
      const storedRowCounts = readStoredRowCounts(sqlite);

      const progressions = await loadCanonicalExerciseProgressions(
        database,
        "profile-1",
        4,
      );
      expect(progressions).toEqual([
        {
          exercise_id: 2,
          pending_direction: "harder",
          pillar: "strength",
          prescription_json: "legacy-latest",
        },
        {
          exercise_id: 4,
          pending_direction: null,
          pillar: "strength",
          prescription_json: "alias-progression",
        },
        {
          exercise_id: 5,
          pending_direction: null,
          pillar: "strength",
          prescription_json: "unmapped-progression",
        },
        {
          exercise_id: 7,
          pending_direction: null,
          pillar: "strength",
          prescription_json: "prepared-target-must-not-win",
        },
      ]);

      const histories = await loadCanonicalTrainingExerciseHistories(
        database,
        "profile-1",
      );
      expect(histories).toEqual([
        {
          appreciation_average: 3,
          exercise_id: 2,
          last_performed_at: "2026-07-28T11:00:00.000Z",
          reached_maximum: 1,
        },
        {
          appreciation_average: 2,
          exercise_id: 4,
          last_performed_at: "2026-07-28T12:00:00.000Z",
          reached_maximum: 0,
        },
        {
          appreciation_average: 4,
          exercise_id: 5,
          last_performed_at: "2026-07-28T13:00:00.000Z",
          reached_maximum: 0,
        },
        {
          appreciation_average: 3,
          exercise_id: 7,
          last_performed_at: "2026-07-28T14:00:00.000Z",
          reached_maximum: 0,
        },
      ]);

      const exclusions = await loadCanonicalExcludedExercises(
        database,
        "profile-1",
      );
      expect(exclusions.map(({ exercise_id }) => exercise_id).sort()).toEqual([
        2, 4, 5, 7,
      ]);
      expect(readStoredRowCounts(sqlite)).toEqual(storedRowCounts);
    } finally {
      sqlite.close();
    }
  });
});

function createFixtureDatabase() {
  const sqlite = new DatabaseSync(":memory:");
  sqlite.exec(`
    CREATE TABLE catalog_releases (
      id INTEGER PRIMARY KEY,
      status TEXT NOT NULL
    );
    CREATE TABLE catalog_pillars (
      id INTEGER PRIMARY KEY,
      code TEXT NOT NULL
    );
    CREATE TABLE catalog_exercises (
      id INTEGER PRIMARY KEY,
      code TEXT NOT NULL,
      release_id INTEGER NOT NULL,
      source_key TEXT,
      is_active INTEGER NOT NULL,
      pillar_id INTEGER NOT NULL
    );
    CREATE TABLE catalog_exercise_successors (
      id INTEGER PRIMARY KEY,
      legacy_exercise_id INTEGER NOT NULL,
      successor_source_key TEXT NOT NULL,
      successor_exercise_id INTEGER,
      mapping_kind TEXT NOT NULL,
      resolution_status TEXT NOT NULL,
      validated_at TEXT
    );
    CREATE TABLE acrea_level_evaluation_legacy_aliases (
      evaluation_exercise_code TEXT PRIMARY KEY,
      legacy_catalog_exercise_code TEXT NOT NULL,
      successor_source_key TEXT NOT NULL,
      successor_exercise_id INTEGER,
      active_in_protocol INTEGER NOT NULL,
      validated_at TEXT
    );
    CREATE TABLE acrea_exercise_progressions (
      profile_id TEXT NOT NULL,
      exercise_id INTEGER NOT NULL,
      prescription_json TEXT NOT NULL,
      reached_maximum INTEGER NOT NULL,
      pending_direction TEXT,
      level_evaluation_version INTEGER NOT NULL,
      updated_at TEXT NOT NULL
    );
    CREATE TABLE session_feedback (
      profile_id TEXT NOT NULL,
      exercise_id INTEGER NOT NULL,
      appreciation_rating INTEGER,
      performed_at TEXT NOT NULL,
      session_phase TEXT NOT NULL
    );
    CREATE TABLE acrea_profile_excluded_exercises (
      profile_id TEXT NOT NULL,
      exercise_id INTEGER NOT NULL
    );

    INSERT INTO catalog_releases (id, status) VALUES
      (1, 'archived'),
      (2, 'active'),
      (3, 'prepared');
    INSERT INTO catalog_pillars (id, code) VALUES
      (1, 'strength');
    INSERT INTO catalog_exercises (
      id, code, release_id, source_key, is_active, pillar_id
    ) VALUES
      (1, 'legacy-push-up', 1, NULL, 0, 1),
      (2, 'new-push-up', 2, 'library:push-up', 1, 1),
      (3, 'legacy-inverted-row', 1, NULL, 0, 1),
      (4, 'new-inverted-row', 2, 'library:inverted-row', 1, 1),
      (5, 'unmapped-legacy-exercise', 1, NULL, 0, 1),
      (6, 'prepared-target', 3, 'library:prepared-target', 1, 1),
      (7, 'legacy-with-prepared-target', 1, NULL, 0, 1);
    INSERT INTO catalog_exercise_successors (
      id, legacy_exercise_id, successor_source_key, successor_exercise_id,
      mapping_kind, resolution_status, validated_at
    ) VALUES
      (1, 1, 'library:push-up', 2, 'exact', 'resolved', '2026-07-28T09:00:00.000Z'),
      (2, 3, 'library:inverted-row', 4, 'related', 'resolved', '2026-07-28T09:00:00.000Z'),
      (3, 7, 'library:prepared-target', 6, 'exact', 'resolved', '2026-07-28T09:00:00.000Z'),
      (4, 5, 'library:push-up', 2, 'exact', 'resolved', NULL),
      (5, 5, 'library:wrong-target', 2, 'exact', 'resolved', '2026-07-28T09:30:00.000Z');
    INSERT INTO acrea_level_evaluation_legacy_aliases (
      evaluation_exercise_code, legacy_catalog_exercise_code,
      successor_source_key, successor_exercise_id, active_in_protocol,
      validated_at
    ) VALUES (
      'legacy-inverted-row',
      'legacy-inverted-row',
      'library:inverted-row',
      4,
      0,
      '2026-07-28T09:00:00.000Z'
    );

    INSERT INTO acrea_exercise_progressions (
      profile_id, exercise_id, prescription_json, reached_maximum,
      pending_direction, level_evaluation_version, updated_at
    ) VALUES
      (
        'profile-1', 1, 'legacy-latest', 1, 'harder', 4,
        '2026-07-28T11:00:00.000Z'
      ),
      (
        'profile-1', 2, 'target-older', 0, NULL, 4,
        '2026-07-28T10:00:00.000Z'
      ),
      (
        'profile-1', 3, 'alias-progression', 0, NULL, 4,
        '2026-07-28T12:00:00.000Z'
      ),
      (
        'profile-1', 5, 'unmapped-progression', 0, NULL, 4,
        '2026-07-28T13:00:00.000Z'
      ),
      (
        'profile-1', 7, 'prepared-target-must-not-win', 0, NULL, 4,
        '2026-07-28T14:00:00.000Z'
      );
    INSERT INTO session_feedback (
      profile_id, exercise_id, appreciation_rating, performed_at,
      session_phase
    ) VALUES
      (
        'profile-1', 1, 1, '2026-07-28T10:00:00.000Z', 'main'
      ),
      (
        'profile-1', 2, 5, '2026-07-28T11:00:00.000Z', 'main'
      ),
      (
        'profile-1', 3, 2, '2026-07-28T12:00:00.000Z', 'main'
      ),
      (
        'profile-1', 5, 4, '2026-07-28T13:00:00.000Z', 'main'
      ),
      (
        'profile-1', 7, 3, '2026-07-28T14:00:00.000Z', 'main'
      );
    INSERT INTO acrea_profile_excluded_exercises (
      profile_id, exercise_id
    ) VALUES
      ('profile-1', 1),
      ('profile-1', 2),
      ('profile-1', 3),
      ('profile-1', 5),
      ('profile-1', 7);
  `);
  return sqlite;
}

function readStoredRowCounts(sqlite: DatabaseSync) {
  return {
    exclusions: readCount(sqlite, "acrea_profile_excluded_exercises"),
    feedback: readCount(sqlite, "session_feedback"),
    progressions: readCount(sqlite, "acrea_exercise_progressions"),
  };
}

function readCount(sqlite: DatabaseSync, tableName: string) {
  return (
    sqlite.prepare(`SELECT COUNT(*) AS count FROM ${tableName}`).get() as {
      count: number;
    }
  ).count;
}

function sqliteAdapter(sqlite: DatabaseSync): LocalDatabase {
  const adapter = {
    execAsync: async (sql: string) => {
      sqlite.exec(sql);
    },
    getAllAsync: async <TRow>(sql: string, params: unknown[] = []) =>
      sqlite.prepare(sql).all(...(params as SQLInputValue[])) as TRow[],
    getFirstAsync: async <TRow>(sql: string, params: unknown[] = []) =>
      (sqlite
        .prepare(sql)
        .get(...(params as SQLInputValue[])) as TRow | undefined) ?? null,
    runAsync: async (sql: string, params: unknown[] = []) => {
      const result = sqlite.prepare(sql).run(...(params as SQLInputValue[]));
      return {
        changes: Number(result.changes),
        lastInsertRowId: Number(result.lastInsertRowid),
      };
    },
    withTransactionAsync: async (operation: () => Promise<void>) => {
      sqlite.exec("BEGIN");
      try {
        await operation();
        sqlite.exec("COMMIT");
      } catch (error) {
        sqlite.exec("ROLLBACK");
        throw error;
      }
    },
  };
  return adapter as unknown as LocalDatabase;
}
