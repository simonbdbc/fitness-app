import type { LocalDatabase } from "@shared/db/database";
import { withDatabase } from "@shared/db";
import { getRequiredCatalogIdByCode } from "../infrastructure/catalogIdentifiers";
import {
  clampCatalogLevel,
  codeFromLabel,
  normalizeCatalogCode,
  requireTrimmed,
} from "../domain/catalogValidation";
import { ensureCatalogReady } from "./catalogLifecycle";
import type {
  CatalogEquipmentOption,
  CatalogExerciseInput,
  CatalogExerciseProgrammingStatus,
  CatalogExerciseReviewStatus,
  CatalogExerciseTranslationStatus,
} from "../types";

export type CatalogExerciseReviewBatch = {
  programmingStatus: CatalogExerciseProgrammingStatus;
  releaseCode: string;
  reviewStatus: CatalogExerciseReviewStatus;
  exerciseSlugs: readonly string[];
  translationStatus: CatalogExerciseTranslationStatus;
};

export async function reviewCatalogReleaseExercisesLocal(
  batch: CatalogExerciseReviewBatch,
): Promise<number> {
  await ensureCatalogReady();
  const exerciseSlugs = Array.from(
    new Set(batch.exerciseSlugs.map((exerciseSlug) => exerciseSlug.trim())),
  );
  if (
    exerciseSlugs.length === 0 ||
    exerciseSlugs.some((exerciseSlug) => exerciseSlug.length === 0)
  ) {
    throw new Error("Une liste de slugs d’exercice non vide est requise.");
  }
  return withDatabase(async (db) => {
    let updated = 0;
    await db.withTransactionAsync(async () => {
      const release = await db.getFirstAsync<{ id: number }>(
        `SELECT id FROM catalog_releases
         WHERE code = ? AND status = 'prepared'
         LIMIT 1`,
        [batch.releaseCode],
      );
      if (!release) throw new Error("Release catalogue préparée introuvable.");
      if (batch.translationStatus === "validated") {
        const incomplete = await db.getFirstAsync<{ count: number }>(
          `SELECT COUNT(*) AS count
           FROM catalog_exercises
           WHERE release_id = ?
             AND code IN (${exerciseSlugs.map(() => "?").join(", ")})
             AND (
               locale <> 'fr'
               OR trim(label) = ''
               OR trim(movement_description) = ''
               OR trim(start_position) = ''
               OR trim(outbound_execution) = ''
             )`,
          [release.id, ...exerciseSlugs],
        );
        if (Number(incomplete?.count ?? 0) > 0) {
          throw new Error("Le contenu français de la sélection est incomplet.");
        }
      }
      const result = await db.runAsync(
        `UPDATE catalog_exercises
         SET review_status = ?,
             translation_status = ?,
             programming_status = ?,
             admin_overridden_at = ?,
             updated_at = ?
         WHERE release_id = ?
           AND code IN (${exerciseSlugs.map(() => "?").join(", ")})`,
        [
          batch.reviewStatus,
          batch.translationStatus,
          batch.programmingStatus,
          new Date().toISOString(),
          new Date().toISOString(),
          release.id,
          ...exerciseSlugs,
        ],
      );
      updated = result.changes;
      if (updated !== exerciseSlugs.length) {
        throw new Error(
          `Lot de validation incomplet : ${updated}/${exerciseSlugs.length}.`,
        );
      }
    });
    return updated;
  });
}

export async function upsertCatalogExerciseLocal(
  input: CatalogExerciseInput,
): Promise<void> {
  await ensureCatalogReady();
  await withDatabase((db) =>
    db.withTransactionAsync(async () => {
      const now = input.updatedAt ?? new Date().toISOString();
      const code = normalizeCatalogCode(
        input.code || codeFromLabel("exercise", input.name),
      );
      const label = requireTrimmed(input.name, "Nom exercice");
      const legacyEquipmentId = input.equipmentOptions
        ? null
        : input.equipment?.trim()
          ? await findOrCreateEquipmentId(db, input.equipment)
          : null;
      const equipmentOptions =
        input.equipmentOptions ??
        (legacyEquipmentId === null
          ? [{ kind: "bodyweight" as const, equipmentCodes: [] as [] }]
          : [
              {
                kind: "equipment" as const,
                equipmentCodes: [
                  await getRequiredCodeById(
                    db,
                    "catalog_equipment",
                    legacyEquipmentId,
                  ),
                ],
              },
            ]);
      const primaryEquipmentCode = equipmentOptions.find(
        (option) => option.kind === "equipment",
      )?.equipmentCodes[0];
      const equipmentId = primaryEquipmentCode
        ? await getRequiredCatalogIdByCode(
            db,
            "catalog_equipment",
            primaryEquipmentCode,
          )
        : null;
      const impactId = await findLookupIdByCodeOrLabel(
        db,
        "catalog_impacts",
        input.impact ?? "faible",
        "Impact exercice",
      );
      const difficulty = clampCatalogLevel(input.levelMin);
      const movementDescription = input.description.trim();
      const startPosition = input.startPositionSteps.join("\n");
      const outboundExecution = input.outboundExecutionSteps.join("\n");
      const returnExecution = input.returnExecutionSteps.join("\n");
      const errors = input.commonErrors.join("\n");

      if (input.id > 0) {
        await db.runAsync(
          `
        UPDATE catalog_exercises
        SET
          code = ?,
          label = ?,
          pillar_id = ?,
          difficulty = ?,
          impact_id = ?,
          family_id = ?,
          type_id = ?,
          equipment_id = ?,
          movement_description = ?,
          start_position = ?,
          outbound_execution = ?,
          return_execution = ?,
          adapted_version = ?,
          tips = ?,
          errors = ?,
          is_active = ?,
          review_status = ?,
          admin_overridden_at = ?,
          updated_at = ?
        WHERE id = ?
        `,
          [
            code,
            label,
            input.pillarId,
            difficulty,
            impactId,
            input.familyId,
            input.typeId,
            equipmentId,
            movementDescription,
            startPosition,
            outboundExecution,
            returnExecution,
            "",
            input.tips.trim(),
            errors,
            input.isActive ? 1 : 0,
            input.reviewStatus,
            now,
            now,
            input.id,
          ],
        );
        await replaceExerciseMuscleGroups(db, input.id, input.muscleGroupIds);
        await replaceExerciseEquipmentOptions(db, input.id, equipmentOptions);
        return;
      }

      const activeRelease = await db.getFirstAsync<{ id: number }>(
        `SELECT id
         FROM catalog_releases
         WHERE status = 'active'
         LIMIT 1`,
      );
      if (!activeRelease) {
        throw new Error("Aucune release catalogue active.");
      }

      const result = await db.runAsync(
        `
      INSERT INTO catalog_exercises (
        code,
        label,
        release_id,
        code,
        source_category,
        source_language,
        locale,
        pillar_id,
        difficulty,
        impact_id,
        family_id,
        type_id,
        equipment_id,
        movement_description,
        start_position,
        outbound_execution,
        return_execution,
        adapted_version,
        tips,
        errors,
        is_active,
        review_status,
        translation_status,
        programming_status,
        admin_overridden_at,
        updated_at
      ) VALUES (
        ?, ?, ?, ?, 'admin', 'fr', 'fr',
        ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?,
        'validated', 'eligible', ?, ?
      )
      `,
        [
          code,
          label,
          activeRelease.id,
          `admin:${code}`,
          input.pillarId,
          difficulty,
          impactId,
          input.familyId,
          input.typeId,
          equipmentId,
          movementDescription,
          startPosition,
          outboundExecution,
          returnExecution,
          "",
          input.tips.trim(),
          errors,
          input.isActive ? 1 : 0,
          input.reviewStatus,
          now,
          now,
        ],
      );
      await replaceExerciseMuscleGroups(
        db,
        result.lastInsertRowId,
        input.muscleGroupIds,
      );
      await replaceExerciseEquipmentOptions(
        db,
        result.lastInsertRowId,
        equipmentOptions,
      );
      await db.runAsync(
        `
      UPDATE catalog_exercises
      SET progression_exercise_id = NULL, regression_exercise_id = NULL
      WHERE id = ?
      `,
        [result.lastInsertRowId],
      );
    }),
  );
}

export async function deleteCatalogExerciseLocal(id: number): Promise<void> {
  await ensureCatalogReady();
  await withDatabase(async (db) => {
    const rows = await db.getAllAsync<{ usage_count: number }>(
      `
      SELECT COUNT(*) AS usage_count
      FROM catalog_session_templates
      WHERE exercise_id = ?
      `,
      [id],
    );
    const usageCount = rows[0]?.usage_count ?? 0;

    if (usageCount > 0) {
      throw new Error(
        `Suppression impossible: ${usageCount} session(s) utilisent cet exercice.`,
      );
    }

    await db.runAsync(
      `
      UPDATE catalog_exercises
      SET regression_exercise_id = NULL
      WHERE regression_exercise_id = ?
      `,
      [id],
    );
    await db.runAsync(
      `
      UPDATE catalog_exercises
      SET progression_exercise_id = NULL
      WHERE progression_exercise_id = ?
      `,
      [id],
    );
    await db.runAsync("DELETE FROM catalog_exercises WHERE id = ?", [id]);
  });
}


async function findOrCreateEquipmentId(
  db: LocalDatabase,
  rawValue: string,
) {
  const label = requireTrimmed(rawValue, "Équipement exercice");
  const code = normalizeCatalogCode(label);
  const existingRows = await db.getAllAsync<{ id: number }>(
    `
    SELECT id
    FROM catalog_equipment
    WHERE code = ? OR lower(label) = lower(?)
    LIMIT 1
    `,
    [code, label],
  );
  const existingId = existingRows[0]?.id;

  if (typeof existingId === "number") {
    return existingId;
  }

  await db.runAsync(
    `
    INSERT INTO catalog_equipment (code, label, category)
    VALUES (?, ?, 'sport')
    `,
    [code, label],
  );

  return getRequiredCatalogIdByCode(db, "catalog_equipment", code);
}

async function findLookupIdByCodeOrLabel(
  db: LocalDatabase,
  tableName:
    | "catalog_impacts"
    | "catalog_families"
    | "catalog_types"
    | "catalog_pillars",
  rawValue: string,
  label: string,
) {
  const value = requireTrimmed(rawValue, label);
  const code = normalizeCatalogCode(value);
  const rows = await db.getAllAsync<{ id: number }>(
    `
    SELECT id
    FROM ${tableName}
    WHERE code = ? OR lower(label) = lower(?)
    LIMIT 1
    `,
    [code, value],
  );
  const id = rows[0]?.id;

  if (typeof id !== "number") {
    throw new Error(`${label} introuvable: ${value}`);
  }

  return id;
}

async function replaceExerciseMuscleGroups(
  db: LocalDatabase,
  exerciseId: number,
  muscleGroupIds: number[],
) {
  const ids = Array.from(new Set(muscleGroupIds));

  if (ids.length === 0) {
    throw new Error("Au moins un groupe musculaire est requis.");
  }

  await db.runAsync(
    "DELETE FROM catalog_exercise_muscle_groups WHERE exercise_id = ?",
    [exerciseId],
  );

  for (const muscleGroupId of ids) {
    await db.runAsync(
      `
      INSERT INTO catalog_exercise_muscle_groups (exercise_id, muscle_group_id)
      VALUES (?, ?)
      `,
      [exerciseId, muscleGroupId],
    );
  }
}

async function replaceExerciseEquipmentOptions(
  db: LocalDatabase,
  exerciseId: number,
  options: CatalogEquipmentOption[],
) {
  if (options.length === 0)
    throw new Error("Au moins une option matériel est requise.");
  const signatures = new Set<string>();
  await db.runAsync(
    "DELETE FROM catalog_exercise_equipment_options WHERE exercise_id = ?",
    [exerciseId],
  );
  for (const [optionIndex, option] of options.entries()) {
    if (option.kind === "bodyweight" && option.equipmentCodes.length > 0) {
      throw new Error(
        "Une option sans matériel ne doit référencer aucun équipement.",
      );
    }
    if (option.kind === "equipment" && option.equipmentCodes.length === 0) {
      throw new Error("Une option matériel doit contenir un équipement.");
    }
    const equipmentCodes = Array.from(new Set(option.equipmentCodes)).sort();
    const signature = `${option.kind}:${equipmentCodes.join("+")}`;
    if (signatures.has(signature)) {
      throw new Error("Deux options matériel identiques sont interdites.");
    }
    signatures.add(signature);
    const result = await db.runAsync(
      `INSERT INTO catalog_exercise_equipment_options (exercise_id, option_index, kind)
       VALUES (?, ?, ?)`,
      [exerciseId, optionIndex, option.kind],
    );
    if (option.kind === "equipment") {
      for (const code of equipmentCodes) {
        await db.runAsync(
          `INSERT INTO catalog_exercise_equipment_option_items (option_id, equipment_id)
           VALUES (?, ?)`,
          [
            result.lastInsertRowId,
            await getRequiredCatalogIdByCode(db, "catalog_equipment", code),
          ],
        );
      }
    }
  }
}

async function getRequiredCodeById(
  db: LocalDatabase,
  tableName: "catalog_equipment",
  id: number,
) {
  const row = await db.getFirstAsync<{ code: string }>(
    `SELECT code FROM ${tableName} WHERE id = ?`,
    [id],
  );
  if (!row)
    throw new Error(`Identifiant catalogue introuvable: ${tableName}.${id}`);
  return row.code;
}
