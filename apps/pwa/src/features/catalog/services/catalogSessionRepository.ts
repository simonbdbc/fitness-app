import type { LocalDatabase } from "@shared/db/database";
import { withDatabase } from "@shared/db";
import {
  clampCatalogLevel,
  codeFromLabel,
  normalizeCatalogCode,
  requireFiniteNumber,
  requireTrimmed,
} from "../domain/catalogValidation";
import { ensureCatalogReady } from "./catalogLifecycle";
import type {
  CatalogSessionTemplateInput,
  CatalogSessionTemplateLevelInput,
} from "../types";

export async function upsertCatalogSessionTemplateLocal(
  input: CatalogSessionTemplateInput,
): Promise<void> {
  await ensureCatalogReady();
  await withDatabase(async (db) => {
    const now = input.updatedAt ?? new Date().toISOString();
    const code = normalizeCatalogCode(
      input.code || codeFromLabel("session", input.title),
    );
    const title = requireTrimmed(input.title, "Titre session");
    const exerciseId = requireFiniteNumber(
      input.exerciseId,
      "Exercice session",
    );
    const sessionLevels = Array.from(
      new Set(input.levels.map(clampCatalogLevel)),
    ).sort((left, right) => left - right);

    if (sessionLevels.length === 0) {
      throw new Error("Au moins un niveau est requis pour la session.");
    }

    let sessionTemplateId = input.id;

    if (input.id > 0) {
      await db.runAsync(
        `
        UPDATE catalog_session_templates
        SET
          code = ?,
          title = ?,
          description = ?,
          exercise_id = ?,
          phase = ?,
          is_active = ?,
          source_status = ?,
          updated_at = ?
        WHERE id = ?
        `,
        [
          code,
          title,
          input.description.trim(),
          exerciseId,
          input.phase,
          input.isActive ? 1 : 0,
          input.sourceStatus || "admin SQLite local",
          now,
          input.id,
        ],
      );
    } else {
      const result = await db.runAsync(
        `
        INSERT INTO catalog_session_templates (
          code,
          title,
          description,
          exercise_id,
          phase,
          is_active,
          source_status,
          updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `,
        [
          code,
          title,
          input.description.trim(),
          exerciseId,
          input.phase,
          input.isActive ? 1 : 0,
          input.sourceStatus || "admin SQLite local",
          now,
        ],
      );
      sessionTemplateId = result.lastInsertRowId;
    }

    await replaceSessionTemplateLevels(
      db,
      sessionTemplateId,
      sessionLevels,
      now,
    );
  });
}

export async function deleteCatalogSessionTemplateLocal(
  id: number,
): Promise<void> {
  await ensureCatalogReady();
  await withDatabase(async (db) => {
    await db.runAsync("DELETE FROM catalog_session_templates WHERE id = ?", [
      id,
    ]);
  });
}

export async function upsertCatalogSessionTemplateLevelLocal(
  input: CatalogSessionTemplateLevelInput,
): Promise<void> {
  await ensureCatalogReady();
  await withDatabase(async (db) => {
    const now = input.updatedAt ?? new Date().toISOString();
    await db.runAsync(
      `
      INSERT INTO catalog_session_template_levels (
        session_template_id,
        level,
        updated_at
      ) VALUES (?, ?, ?)
      ON CONFLICT(session_template_id, level) DO UPDATE SET
        updated_at = excluded.updated_at
      `,
      [input.sessionTemplateId, clampCatalogLevel(input.level), now],
    );
  });
}

export async function deleteCatalogSessionTemplateLevelLocal(input: {
  sessionTemplateId: number;
  level: number;
}): Promise<void> {
  await ensureCatalogReady();
  await withDatabase(async (db) => {
    await db.runAsync(
      `
      DELETE FROM catalog_session_template_levels
      WHERE session_template_id = ?
        AND level = ?
      `,
      [input.sessionTemplateId, input.level],
    );
  });
}


async function replaceSessionTemplateLevels(
  db: LocalDatabase,
  sessionTemplateId: number,
  levels: number[],
  updatedAt: string,
) {
  await db.runAsync(
    "DELETE FROM catalog_session_template_levels WHERE session_template_id = ?",
    [sessionTemplateId],
  );

  for (const level of levels) {
    await db.runAsync(
      `
      INSERT INTO catalog_session_template_levels (
        session_template_id,
        level,
        updated_at
      ) VALUES (?, ?, ?)
      `,
      [sessionTemplateId, clampCatalogLevel(level), updatedAt],
    );
  }
}
