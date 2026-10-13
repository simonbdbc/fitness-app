import type { LocalDatabase } from "@shared/db";
import { clampCatalogLevel } from "../domain/catalogValidation";
import {
  getOptionalMappedCatalogId,
  getRequiredCatalogIdByCode,
  getRequiredMappedCatalogId,
} from "../infrastructure/catalogIdentifiers";
import type {
  CatalogExerciseMediaSeed,
  CatalogExerciseSeed,
  CatalogReleaseSeed,
  CatalogReleaseStatus,
  CatalogSeed,
} from "../types";
import { equipmentOptionsForExercise } from "./equipmentRequirements";

export async function resolvePendingProfileEquipment(db: LocalDatabase) {
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
      SELECT 1 FROM catalog_equipment equipment
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

export async function upsertCanonicalFormatsFromSeed(
  db: LocalDatabase,
  seed: CatalogSeed,
) {
  await db.withTransactionAsync(async () => {
    await db.runAsync(
      `UPDATE catalog_formats SET source_status = 'historique'
       WHERE source_status = 'seed base formats metier'`,
    );
    for (const series of seed.series) {
      await db.runAsync(
        `INSERT INTO catalog_series (code, label, series, updated_at)
         VALUES (?, ?, ?, ?)
         ON CONFLICT(code) DO UPDATE SET label = excluded.label,
           series = excluded.series, updated_at = excluded.updated_at`,
        [series.code, series.label, series.series, series.updatedAt],
      );
    }
    for (const repetition of seed.repetitions) {
      await db.runAsync(
        `INSERT INTO catalog_repetitions (code, label, reps, updated_at)
         VALUES (?, ?, ?, ?)
         ON CONFLICT(code) DO UPDATE SET label = excluded.label,
           reps = excluded.reps, updated_at = excluded.updated_at`,
        [repetition.code, repetition.label, repetition.reps, repetition.updatedAt],
      );
    }
    for (const rest of seed.rests) {
      await db.runAsync(
        `INSERT INTO catalog_rests (code, label, rest_seconds, updated_at)
         VALUES (?, ?, ?, ?)
         ON CONFLICT(code) DO UPDATE SET label = excluded.label,
           rest_seconds = excluded.rest_seconds, updated_at = excluded.updated_at`,
        [rest.code, rest.label, rest.restSeconds, rest.updatedAt],
      );
    }
    for (const interval of seed.intervals) {
      await db.runAsync(
        `INSERT INTO catalog_intervals (code, label, effort_seconds, updated_at)
         VALUES (?, ?, ?, ?)
         ON CONFLICT(code) DO UPDATE SET label = excluded.label,
           effort_seconds = excluded.effort_seconds, updated_at = excluded.updated_at`,
        [interval.code, interval.label, interval.effortSeconds, interval.updatedAt],
      );
    }
    for (const format of seed.formats) {
      await db.runAsync(
        `INSERT INTO catalog_formats (
           code, format_type, series_id, repetitions_id, rest_id, interval_id,
           label, description, source_status, updated_at
         ) VALUES (
           ?, ?,
           (SELECT id FROM catalog_series WHERE code = ?),
           (SELECT id FROM catalog_repetitions WHERE code = ?),
           (SELECT id FROM catalog_rests WHERE code = ?),
           (SELECT id FROM catalog_intervals WHERE code = ?),
           ?, ?, ?, ?
         )
         ON CONFLICT(code) DO UPDATE SET
           format_type = excluded.format_type,
           series_id = excluded.series_id,
           repetitions_id = excluded.repetitions_id,
           rest_id = excluded.rest_id,
           interval_id = excluded.interval_id,
           label = excluded.label,
           description = excluded.description,
           source_status = excluded.source_status,
           updated_at = excluded.updated_at`,
        [
          format.code,
          format.formatType,
          format.seriesCode,
          format.repetitionsCode,
          format.restCode,
          format.intervalCode,
          format.label,
          format.description,
          format.sourceStatus,
          format.updatedAt,
        ],
      );
    }
  });
}

export async function upsertExerciseLibraryExercisesFromSeed(
  db: LocalDatabase,
  exercises: readonly CatalogExerciseSeed[],
  release?: CatalogReleaseSeed | readonly CatalogReleaseSeed[],
) {
  await db.withTransactionAsync(async () => {
    for (const exercise of exercises) {
      if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(exercise.code)) {
        throw new Error(
          `Référence documentaire inattendue: ${exercise.code}`,
        );
      }
    }
    const releases = release
      ? Array.isArray(release)
        ? release
        : [release]
      : [];
    for (const releaseSeed of releases) {
      if (releaseSeed.status !== "active") {
        throw new Error(
          `La release locale ${releaseSeed.code} doit être active.`,
        );
      }
      const existingRelease = await db.getFirstAsync<{
        status: CatalogReleaseStatus;
      }>(
        "SELECT status FROM catalog_releases WHERE code = ? LIMIT 1",
        [releaseSeed.code],
      );
      if (existingRelease && existingRelease.status !== "active") {
        throw new Error(
          `La release ${releaseSeed.code} ne peut pas remplacer une release inactive.`,
        );
      }
      await db.runAsync(
        `INSERT INTO catalog_releases (
           code, source, source_revision, locale, expected_exercise_count,
           status, license_id, activation_backup_reference,
           activation_diff_reference, created_at, activated_at, archived_at,
           updated_at
         ) VALUES (?, ?, ?, ?, ?, 'active', ?, ?, ?, ?, ?, NULL, ?)
         ON CONFLICT(code) DO UPDATE SET
           source = excluded.source,
           source_revision = excluded.source_revision,
           locale = excluded.locale,
           expected_exercise_count = excluded.expected_exercise_count,
           license_id = CASE
             WHEN excluded.license_id IS NOT NULL
               AND trim(excluded.license_id) <> ''
             THEN excluded.license_id
             ELSE catalog_releases.license_id
           END,
           updated_at = excluded.updated_at
         WHERE catalog_releases.status = 'active'`,
        [
          releaseSeed.code,
          releaseSeed.source,
          releaseSeed.sourceRevision,
          releaseSeed.locale,
          releaseSeed.expectedExerciseCount,
          releaseSeed.licenseId,
          releaseSeed.activationBackupReference,
          releaseSeed.activationDiffReference,
          releaseSeed.createdAt,
          releaseSeed.activatedAt ?? releaseSeed.createdAt,
          releaseSeed.updatedAt,
        ],
      );
    }

    const [
      releaseRows,
      pillarRows,
      impactRows,
      familyRows,
      typeRows,
      muscleGroupRows,
      equipmentRows,
    ] = await Promise.all(
      [
        "catalog_releases",
        "catalog_pillars",
        "catalog_impacts",
        "catalog_families",
        "catalog_types",
        "catalog_muscle_groups",
        "catalog_equipment",
      ].map((tableName) =>
        db.getAllAsync<{ id: number; code: string }>(
          `SELECT id, code FROM ${tableName}`,
        ),
      ),
    );
    const releaseIds = idsByCode(releaseRows);
    const pillarIds = idsByCode(pillarRows);
    const impactIds = idsByCode(impactRows);
    const familyIds = idsByCode(familyRows);
    const typeIds = idsByCode(typeRows);
    const muscleGroupIds = idsByCode(muscleGroupRows);
    const equipmentIds = idsByCode(equipmentRows);

    for (const exercise of exercises) {
      const metadata = catalogExerciseReleaseMetadata(exercise);
      const targetReleaseId = getRequiredMappedCatalogId(
        releaseIds,
        metadata.releaseCode,
      );
      const existingIdentity = await db.getFirstAsync<{
        release_id: number;
      }>(
        `SELECT release_id
         FROM catalog_exercises
         WHERE code = ?
         LIMIT 1`,
        [exercise.code],
      );
      if (
        existingIdentity &&
        existingIdentity.release_id !== targetReleaseId
      ) {
        // Release ownership is an activation concern, never a seed concern.
        // Skipping the whole identity also preserves its media and relations.
        continue;
      }
      const equipmentOptions = equipmentOptionsForExercise(exercise);
      const primaryEquipmentCode = equipmentOptions.find(
        (option) => option.kind === "equipment",
      )?.equipmentCodes[0];

      await db.runAsync(
        `INSERT INTO catalog_exercises (
           code, slug, label, label_fr, label_en, release_id, source_key, source_category,
           source_language, locale, pillar_id, difficulty, impact_id, family_id, type_id,
           equipment_id, movement_description, start_position,
           outbound_execution, return_execution, adapted_version, tips, errors,
           is_active, review_status, translation_status, programming_status,
           archived_at, admin_overridden_at, updated_at
         ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT(code) DO UPDATE SET
           slug = excluded.slug,
           label = CASE WHEN catalog_exercises.admin_overridden_at IS NULL
             THEN excluded.label ELSE catalog_exercises.label END,
           label_fr = excluded.label_fr,
           label_en = excluded.label_en,
           release_id = excluded.release_id,
           source_key = excluded.source_key,
           source_category = excluded.source_category,
           source_language = excluded.source_language,
           locale = excluded.locale,
           pillar_id = CASE WHEN catalog_exercises.admin_overridden_at IS NULL
             THEN excluded.pillar_id ELSE catalog_exercises.pillar_id END,
           difficulty = CASE WHEN catalog_exercises.admin_overridden_at IS NULL
             THEN excluded.difficulty ELSE catalog_exercises.difficulty END,
           impact_id = CASE WHEN catalog_exercises.admin_overridden_at IS NULL
             THEN excluded.impact_id ELSE catalog_exercises.impact_id END,
           family_id = CASE WHEN catalog_exercises.admin_overridden_at IS NULL
             THEN excluded.family_id ELSE catalog_exercises.family_id END,
           type_id = CASE WHEN catalog_exercises.admin_overridden_at IS NULL
             THEN excluded.type_id ELSE catalog_exercises.type_id END,
           equipment_id = CASE WHEN catalog_exercises.admin_overridden_at IS NULL
             THEN excluded.equipment_id ELSE catalog_exercises.equipment_id END,
           regression_exercise_id = CASE
             WHEN catalog_exercises.admin_overridden_at IS NULL
               THEN NULL ELSE catalog_exercises.regression_exercise_id END,
           progression_exercise_id = CASE
             WHEN catalog_exercises.admin_overridden_at IS NULL
               THEN NULL ELSE catalog_exercises.progression_exercise_id END,
           movement_description = CASE
             WHEN catalog_exercises.admin_overridden_at IS NULL
               THEN excluded.movement_description
             ELSE catalog_exercises.movement_description END,
           start_position = CASE WHEN catalog_exercises.admin_overridden_at IS NULL
             THEN excluded.start_position ELSE catalog_exercises.start_position END,
           outbound_execution = CASE
             WHEN catalog_exercises.admin_overridden_at IS NULL
               THEN excluded.outbound_execution
             ELSE catalog_exercises.outbound_execution END,
           return_execution = CASE
             WHEN catalog_exercises.admin_overridden_at IS NULL
               THEN excluded.return_execution
             ELSE catalog_exercises.return_execution END,
           adapted_version = CASE
             WHEN catalog_exercises.admin_overridden_at IS NULL
               THEN excluded.adapted_version
             ELSE catalog_exercises.adapted_version END,
           tips = CASE WHEN catalog_exercises.admin_overridden_at IS NULL
             THEN excluded.tips ELSE catalog_exercises.tips END,
           errors = CASE WHEN catalog_exercises.admin_overridden_at IS NULL
             THEN excluded.errors ELSE catalog_exercises.errors END,
           is_active = CASE WHEN catalog_exercises.admin_overridden_at IS NULL
             THEN excluded.is_active ELSE catalog_exercises.is_active END,
           review_status = CASE WHEN catalog_exercises.admin_overridden_at IS NULL
             THEN excluded.review_status ELSE catalog_exercises.review_status END,
           translation_status = CASE WHEN catalog_exercises.admin_overridden_at IS NULL
             THEN excluded.translation_status ELSE catalog_exercises.translation_status END,
           programming_status = CASE WHEN catalog_exercises.admin_overridden_at IS NULL
             THEN excluded.programming_status ELSE catalog_exercises.programming_status END,
           archived_at = CASE WHEN catalog_exercises.admin_overridden_at IS NULL
             THEN excluded.archived_at ELSE catalog_exercises.archived_at END,
           updated_at = CASE WHEN catalog_exercises.admin_overridden_at IS NULL
             THEN excluded.updated_at ELSE catalog_exercises.updated_at END`,
        [
          exercise.code,
          exercise.code,
          exercise.label,
          exercise.label,
          exercise.labelEn ?? exercise.label,
          targetReleaseId,
          metadata.sourceKey,
          metadata.sourceCategory,
          metadata.sourceLanguage,
          metadata.locale,
          getRequiredMappedCatalogId(pillarIds, exercise.pillarCode),
          exercise.difficulty,
          getRequiredMappedCatalogId(impactIds, exercise.impactCode),
          getRequiredMappedCatalogId(familyIds, exercise.familyCode),
          getRequiredMappedCatalogId(typeIds, exercise.typeCode),
          getOptionalMappedCatalogId(equipmentIds, primaryEquipmentCode),
          exercise.movementDescription,
          exercise.startPosition,
          exercise.outboundExecution,
          exercise.returnExecution,
          exercise.adaptedVersion,
          exercise.tips,
          exercise.errors,
          metadata.isActive ? 1 : 0,
          metadata.reviewStatus,
          metadata.translationStatus,
          metadata.programmingStatus,
          metadata.archivedAt,
          metadata.adminOverriddenAt,
          metadata.updatedAt,
        ],
      );

      const exerciseId = await getRequiredCatalogIdByCode(
        db,
        "catalog_exercises",
        exercise.code,
      );
      const ownership = await db.getFirstAsync<{
        admin_overridden_at: string | null;
      }>(
        `SELECT admin_overridden_at
         FROM catalog_exercises
         WHERE id = ?`,
        [exerciseId],
      );
      if (ownership?.admin_overridden_at) continue;

      await db.runAsync(
        `DELETE FROM catalog_exercise_equipment_options
         WHERE exercise_id = ?`,
        [exerciseId],
      );

      for (const [optionIndex, option] of equipmentOptions.entries()) {
        const result = await db.runAsync(
          `INSERT INTO catalog_exercise_equipment_options (
             exercise_id, option_index, kind
           ) VALUES (?, ?, ?)`,
          [exerciseId, optionIndex, option.kind],
        );
        if (option.kind === "equipment") {
          for (const equipmentCode of option.equipmentCodes) {
            await db.runAsync(
              `INSERT INTO catalog_exercise_equipment_option_items (
                 option_id, equipment_id
               ) VALUES (?, ?)`,
              [
                result.lastInsertRowId,
                getRequiredMappedCatalogId(equipmentIds, equipmentCode),
              ],
            );
          }
        }
      }

      await db.runAsync(
        `DELETE FROM catalog_exercise_muscle_groups
         WHERE exercise_id = ?`,
        [exerciseId],
      );
      for (const muscleGroupCode of exercise.muscleGroupCodes) {
        await db.runAsync(
          `INSERT INTO catalog_exercise_muscle_groups (
             exercise_id, muscle_group_id
           ) VALUES (?, ?)`,
          [
            exerciseId,
            getRequiredMappedCatalogId(muscleGroupIds, muscleGroupCode),
          ],
        );
      }
      await upsertExerciseMedia(db, exerciseId, exercise.media);
    }
  });
}

export type CatalogSeedWriteOptions = {
  /**
   * Rows whose state transition has already been validated and committed by
   * the authoritative backend. For a public snapshot, these sets describe
   * the exact active visibility returned through RLS; locally merged fallback
   * and historical rows are excluded.
   */
  authoritativeExerciseCodes?: ReadonlySet<string>;
  authoritativeReleaseCodes?: ReadonlySet<string>;
  authoritativeVisibility?: {
    activeReleaseCode: string;
    exerciseCodes: ReadonlySet<string>;
  };
  /**
   * Index rows deliberately omit long-form instructions and media.  They may
   * create a new exercise, but must never overwrite a detail already cached
   * on the device (including an older complete-library installation).
   */
  partialExerciseCodes?: ReadonlySet<string>;
};

export async function replaceCatalogCacheFromSeed(
  db: LocalDatabase,
  seed: CatalogSeed,
  options: CatalogSeedWriteOptions = {},
) {
  await db.withTransactionAsync(async () => {
    await upsertCatalogReleases(db, seed, options);

    const releaseIds = new Map<string, number>();
    const releaseStatuses = new Map<string, CatalogReleaseStatus>();
    const pillarIds = new Map<string, number>();
    const impactIds = new Map<string, number>();
    const familyIds = new Map<string, number>();
    const typeIds = new Map<string, number>();
    const muscleGroupIds = new Map<string, number>();
    const equipmentIds = new Map<string, number>();
    const exerciseIds = new Map<string, number>();
    const replaceableExerciseCodes = new Set<string>();
    const seriesIds = new Map<string, number>();
    const repetitionIds = new Map<string, number>();
    const restIds = new Map<string, number>();
    const intervalIds = new Map<string, number>();
    const sessionTemplateIds = new Map<string, number>();

    for (const release of await db.getAllAsync<{
      id: number;
      code: string;
      status: CatalogReleaseStatus;
    }>("SELECT id, code, status FROM catalog_releases")) {
      releaseIds.set(release.code, release.id);
      releaseStatuses.set(release.code, release.status);
    }

    for (const [tableName, rows, idMap] of [
      ["catalog_pillars", seed.pillars, pillarIds],
      ["catalog_impacts", seed.impacts, impactIds],
      ["catalog_families", seed.families, familyIds],
      ["catalog_types", seed.types, typeIds],
      ["catalog_muscle_groups", seed.muscleGroups, muscleGroupIds],
    ] as const) {
      for (const row of rows) {
        await upsertLookup(db, tableName, row);
        idMap.set(row.code, await getRequiredCatalogIdByCode(db, tableName, row.code));
      }
    }

    for (const equipment of seed.equipment) {
      await db.runAsync(
        `INSERT INTO catalog_equipment (code, label, category)
         VALUES (?, ?, ?)
         ON CONFLICT(code) DO UPDATE SET
           label = excluded.label,
           category = excluded.category`,
        [equipment.code, equipment.label, equipment.category ?? "sport"],
      );
      equipmentIds.set(
        equipment.code,
        await getRequiredCatalogIdByCode(db, "catalog_equipment", equipment.code),
      );
    }

    for (const series of seed.series) {
      await db.runAsync(
        `
        INSERT INTO catalog_series (code, label, series, updated_at)
        VALUES (?, ?, ?, ?)
        ON CONFLICT(code) DO UPDATE SET
          label = excluded.label,
          series = excluded.series,
          updated_at = excluded.updated_at
        `,
        [series.code, series.label, series.series, series.updatedAt],
      );
      seriesIds.set(
        series.code,
        await getRequiredCatalogIdByCode(db, "catalog_series", series.code),
      );
    }

    for (const repetition of seed.repetitions) {
      await db.runAsync(
        `
        INSERT INTO catalog_repetitions (
          code,
          label,
          reps,
          updated_at
        ) VALUES (?, ?, ?, ?)
        ON CONFLICT(code) DO UPDATE SET
          label = excluded.label,
          reps = excluded.reps,
          updated_at = excluded.updated_at
        `,
        [
          repetition.code,
          repetition.label,
          repetition.reps,
          repetition.updatedAt,
        ],
      );
      repetitionIds.set(
        repetition.code,
        await getRequiredCatalogIdByCode(db, "catalog_repetitions", repetition.code),
      );
    }

    for (const rest of seed.rests) {
      await db.runAsync(
        `
        INSERT INTO catalog_rests (code, label, rest_seconds, updated_at)
        VALUES (?, ?, ?, ?)
        ON CONFLICT(code) DO UPDATE SET
          label = excluded.label,
          rest_seconds = excluded.rest_seconds,
          updated_at = excluded.updated_at
        `,
        [rest.code, rest.label, rest.restSeconds, rest.updatedAt],
      );
      restIds.set(
        rest.code,
        await getRequiredCatalogIdByCode(db, "catalog_rests", rest.code),
      );
    }

    for (const interval of seed.intervals) {
      await db.runAsync(
        `
        INSERT INTO catalog_intervals (
          code,
          label,
          effort_seconds,
          updated_at
        ) VALUES (?, ?, ?, ?)
        ON CONFLICT(code) DO UPDATE SET
          label = excluded.label,
          effort_seconds = excluded.effort_seconds,
          updated_at = excluded.updated_at
        `,
        [
          interval.code,
          interval.label,
          interval.effortSeconds,
          interval.updatedAt,
        ],
      );
      intervalIds.set(
        interval.code,
        await getRequiredCatalogIdByCode(db, "catalog_intervals", interval.code),
      );
    }

    for (const format of seed.formats) {
      await db.runAsync(
        `
        INSERT INTO catalog_formats (
          code,
          format_type,
          series_id,
          repetitions_id,
          rest_id,
          interval_id,
          label,
          description,
          source_status,
          updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(code) DO UPDATE SET
          format_type = excluded.format_type,
          series_id = excluded.series_id,
          repetitions_id = excluded.repetitions_id,
          rest_id = excluded.rest_id,
          interval_id = excluded.interval_id,
          label = excluded.label,
          description = excluded.description,
          source_status = excluded.source_status,
          updated_at = excluded.updated_at
        `,
        [
          format.code,
          format.formatType,
          getRequiredMappedCatalogId(seriesIds, format.seriesCode ?? ""),
          getOptionalMappedCatalogId(repetitionIds, format.repetitionsCode),
          getRequiredMappedCatalogId(restIds, format.restCode ?? ""),
          getOptionalMappedCatalogId(intervalIds, format.intervalCode),
          format.label,
          format.description,
          format.sourceStatus,
          format.updatedAt,
        ],
      );
    }

    for (const exercise of seed.exercises) {
      const metadata = catalogExerciseReleaseMetadata(exercise);
      const isAuthoritative =
        options.authoritativeExerciseCodes?.has(exercise.code) ?? false;
      const existingExercise = await db.getFirstAsync<{
        admin_overridden_at: string | null;
        id: number;
      }>(
        `SELECT id, admin_overridden_at
         FROM catalog_exercises
         WHERE code = ?
         LIMIT 1`,
        [exercise.code],
      );
      const incomingOverrideAt = metadata.adminOverriddenAt;
      const acceptsFallback =
        options.authoritativeReleaseCodes === undefined ||
        isAuthoritative ||
        releaseStatuses.get(metadata.releaseCode) === "prepared";
      if (!acceptsFallback) {
        if (existingExercise) {
          exerciseIds.set(exercise.code, existingExercise.id);
        }
        continue;
      }
      const authoritativeMayReplace =
        isAuthoritative &&
        (!existingExercise?.admin_overridden_at ||
          (incomingOverrideAt !== null &&
            incomingOverrideAt >= existingExercise.admin_overridden_at));
      const isPartial = options.partialExerciseCodes?.has(exercise.code) ?? false;
      const shouldReplaceExercise =
        !existingExercise || (authoritativeMayReplace && !isPartial);
      if (shouldReplaceExercise) {
        replaceableExerciseCodes.add(exercise.code);
      }
      const equipmentOptions = equipmentOptionsForExercise(exercise);
      const primaryEquipmentCode = equipmentOptions.find(
        (option) => option.kind === "equipment",
      )?.equipmentCodes[0];
      await db.runAsync(
        `
        INSERT INTO catalog_exercises (
          code,
          slug,
          label,
          label_fr,
          label_en,
          release_id,
          source_key,
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
          archived_at,
          admin_overridden_at,
          updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(code) DO UPDATE SET
          slug = excluded.slug,
          label = excluded.label,
          label_fr = excluded.label_fr,
          label_en = excluded.label_en,
          release_id = excluded.release_id,
          source_key = excluded.source_key,
          source_category = excluded.source_category,
          source_language = excluded.source_language,
          locale = excluded.locale,
          pillar_id = excluded.pillar_id,
          difficulty = excluded.difficulty,
          impact_id = excluded.impact_id,
          family_id = excluded.family_id,
          type_id = excluded.type_id,
          equipment_id = excluded.equipment_id,
          movement_description = excluded.movement_description,
          start_position = excluded.start_position,
          outbound_execution = excluded.outbound_execution,
          return_execution = excluded.return_execution,
          adapted_version = excluded.adapted_version,
          tips = excluded.tips,
          errors = excluded.errors,
          is_active = CASE WHEN ? = 1
            THEN excluded.is_active ELSE catalog_exercises.is_active END,
          review_status = CASE WHEN ? = 1
            THEN excluded.review_status ELSE catalog_exercises.review_status END,
          translation_status = CASE WHEN ? = 1
            THEN excluded.translation_status ELSE catalog_exercises.translation_status END,
          programming_status = CASE WHEN ? = 1
            THEN excluded.programming_status ELSE catalog_exercises.programming_status END,
          archived_at = CASE WHEN ? = 1
            THEN excluded.archived_at ELSE catalog_exercises.archived_at END,
          admin_overridden_at = CASE WHEN ? = 1
            THEN excluded.admin_overridden_at
            ELSE catalog_exercises.admin_overridden_at END,
          updated_at = excluded.updated_at
        WHERE ? = 1
        `,
        [
          exercise.code,
          exercise.code,
          exercise.label,
          exercise.label,
          exercise.labelEn ?? exercise.label,
          getRequiredMappedCatalogId(releaseIds, metadata.releaseCode),
          metadata.sourceKey,
          metadata.sourceCategory,
          metadata.sourceLanguage,
          metadata.locale,
          getRequiredMappedCatalogId(pillarIds, exercise.pillarCode),
          exercise.difficulty,
          getRequiredMappedCatalogId(impactIds, exercise.impactCode),
          getRequiredMappedCatalogId(familyIds, exercise.familyCode),
          getRequiredMappedCatalogId(typeIds, exercise.typeCode),
          getOptionalMappedCatalogId(equipmentIds, primaryEquipmentCode),
          exercise.movementDescription,
          exercise.startPosition,
          exercise.outboundExecution,
          exercise.returnExecution,
          exercise.adaptedVersion,
          exercise.tips,
          exercise.errors,
          metadata.isActive ? 1 : 0,
          metadata.reviewStatus,
          metadata.translationStatus,
          metadata.programmingStatus,
          metadata.archivedAt,
          metadata.adminOverriddenAt,
          metadata.updatedAt,
          isAuthoritative ? 1 : 0,
          isAuthoritative ? 1 : 0,
          isAuthoritative ? 1 : 0,
          isAuthoritative ? 1 : 0,
          isAuthoritative ? 1 : 0,
          isAuthoritative ? 1 : 0,
          shouldReplaceExercise ? 1 : 0,
        ],
      );

      const exerciseId = await getRequiredCatalogIdByCode(
        db,
        "catalog_exercises",
        exercise.code,
      );
      exerciseIds.set(exercise.code, exerciseId);

      if (shouldReplaceExercise) {
        await db.runAsync(
          `DELETE FROM catalog_exercise_equipment_options
           WHERE exercise_id = ?`,
          [exerciseId],
        );
        for (const [optionIndex, option] of equipmentOptions.entries()) {
          const result = await db.runAsync(
            `INSERT INTO catalog_exercise_equipment_options (
               exercise_id, option_index, kind
             ) VALUES (?, ?, ?)`,
            [exerciseId, optionIndex, option.kind],
          );
          if (option.kind === "equipment") {
            for (const equipmentCode of option.equipmentCodes) {
              await db.runAsync(
                `INSERT INTO catalog_exercise_equipment_option_items (
                   option_id, equipment_id
                 ) VALUES (?, ?)`,
                [
                  result.lastInsertRowId,
                  getRequiredMappedCatalogId(equipmentIds, equipmentCode),
                ],
              );
            }
          }
        }

        await db.runAsync(
          `DELETE FROM catalog_exercise_muscle_groups
           WHERE exercise_id = ?`,
          [exerciseId],
        );
        for (const muscleGroupCode of exercise.muscleGroupCodes) {
          await db.runAsync(
            `
            INSERT INTO catalog_exercise_muscle_groups (
              exercise_id,
              muscle_group_id
            ) VALUES (?, ?)
            ON CONFLICT(exercise_id, muscle_group_id) DO NOTHING
            `,
            [
              exerciseId,
              getRequiredMappedCatalogId(muscleGroupIds, muscleGroupCode),
            ],
          );
        }
        await upsertExerciseMedia(db, exerciseId, exercise.media);
      }
    }

    for (const exercise of seed.exercises) {
      if (!replaceableExerciseCodes.has(exercise.code)) continue;
      await db.runAsync(
        `
        UPDATE catalog_exercises
        SET
          regression_exercise_id = ?,
          progression_exercise_id = ?
        WHERE code = ?
        `,
        [
          getOptionalMappedCatalogId(exerciseIds, exercise.regressionExerciseCode),
          getOptionalMappedCatalogId(exerciseIds, exercise.progressionExerciseCode),
          exercise.code,
        ],
      );
    }

    await applyAuthoritativeCatalogVisibility(db, seed, options);

    for (const session of seed.sessionTemplates) {
      await db.runAsync(
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
        ON CONFLICT(code) DO UPDATE SET
          title = excluded.title,
          description = excluded.description,
          exercise_id = excluded.exercise_id,
          phase = excluded.phase,
          is_active = excluded.is_active,
          source_status = excluded.source_status,
          updated_at = excluded.updated_at
        `,
        [
          session.code,
          session.title,
          session.description,
          getRequiredMappedCatalogId(exerciseIds, session.exerciseCode),
          session.phase ?? inferSessionPhase(session.exerciseCode),
          session.isActive ? 1 : 0,
          session.sourceStatus,
          session.updatedAt,
        ],
      );
      sessionTemplateIds.set(
        session.code,
        await getRequiredCatalogIdByCode(
          db,
          "catalog_session_templates",
          session.code,
        ),
      );
      await db.runAsync(
        `DELETE FROM catalog_session_template_levels
         WHERE session_template_id = ?`,
        [sessionTemplateIds.get(session.code) ?? 0],
      );
    }

    for (const link of seed.sessionTemplateLevels) {
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
        [
          getRequiredMappedCatalogId(sessionTemplateIds, link.sessionTemplateCode),
          clampCatalogLevel(link.level),
          link.updatedAt,
        ],
      );
    }
    await resolvePendingProfileEquipment(db);
  });
}

async function applyAuthoritativeCatalogVisibility(
  db: LocalDatabase,
  seed: CatalogSeed,
  options: CatalogSeedWriteOptions,
) {
  const visibility = options.authoritativeVisibility;
  if (!visibility) return;

  const activeRelease = (seed.releases ?? []).find(
    (release) =>
      release.code === visibility.activeReleaseCode &&
      release.status === "active",
  );
  if (!activeRelease) {
    throw new Error(
      "La visibilité autoritative doit référencer la release active.",
    );
  }

  const authoritativeExercises = seed.exercises.filter((exercise) =>
    visibility.exerciseCodes.has(exercise.code),
  );
  if (authoritativeExercises.length !== visibility.exerciseCodes.size) {
    throw new Error(
      "Le snapshot catalogue autoritatif référence un exercice absent.",
    );
  }
  for (const exercise of authoritativeExercises) {
    if (
      catalogExerciseReleaseMetadata(exercise).releaseCode !==
      activeRelease.code
    ) {
      throw new Error(
        `L'exercice ${exercise.code} n'appartient pas à la release active.`,
      );
    }
  }

  const transitionedAt =
    activeRelease.activatedAt ?? activeRelease.updatedAt;

  // Le snapshot public ne contient que la release active et ses exercices.
  // Les autres releases opérationnelles suivent exactement cette frontière,
  // tandis que les releases préparées restent intactes pour permettre une
  // prévisualisation locale vérifiée sans les rendre programmables.
  await db.runAsync(
    `UPDATE catalog_exercises
     SET is_active = 0,
         archived_at = COALESCE(archived_at, ?)
     WHERE release_id IN (
       SELECT id FROM catalog_releases WHERE status <> 'prepared'
     )
       AND (is_active <> 0 OR archived_at IS NULL)`,
    [transitionedAt],
  );

  for (const exercise of authoritativeExercises) {
    const result = await db.runAsync(
      `UPDATE catalog_exercises
       SET is_active = 1,
           archived_at = NULL
       WHERE code = ?
         AND release_id = (
           SELECT id
           FROM catalog_releases
           WHERE code = ? AND status = 'active'
         )`,
      [exercise.code, activeRelease.code],
    );
    if (result.changes !== 1) {
      throw new Error(
        `Transition autoritative impossible pour ${exercise.code}.`,
      );
    }
  }
}

function inferSessionPhase(exerciseCode: string) {
  if (
    [
      "proprioception-mobilite-epaules",
      "proprioception-mobilite-hanches",
      "proprioception-mobilite-poignets",
    ].includes(exerciseCode)
  ) {
    return "warmup";
  }
  if (
    [
      "proprioception-mobilite-poignets-epaules-hanches",
      "renforcement-mobilite-colonne-douce",
    ].includes(exerciseCode)
  ) {
    return "cooldown";
  }
  return "main";
}

async function upsertLookup(
  db: LocalDatabase,
  tableName:
    | "catalog_pillars"
    | "catalog_impacts"
    | "catalog_families"
    | "catalog_types"
    | "catalog_muscle_groups"
    | "catalog_equipment",
  row: { code: string; label: string },
) {
  await db.runAsync(
    `
    INSERT INTO ${tableName} (code, label)
    VALUES (?, ?)
    ON CONFLICT(code) DO UPDATE SET
      label = excluded.label
    `,
    [row.code, row.label],
  );
}

function idsByCode(rows: { id: number; code: string }[]) {
  return new Map(rows.map((row) => [row.code, row.id]));
}

const canonicalCatalogReleaseCode = "exercise-library-v2";
const catalogMetadataUpdatedAt = "2026-08-11T00:00:00.000Z";

function catalogExerciseReleaseMetadata(exercise: CatalogExerciseSeed) {
  const sourceCategory = exercise.sourceCategory ?? "";
  const releaseCode = exercise.releaseCode ?? canonicalCatalogReleaseCode;

  return {
    releaseCode,
    sourceKey: exercise.sourceKey ?? `${releaseCode}:${exercise.slug}`,
    sourceCategory,
    sourceLanguage:
      exercise.sourceLanguage ?? "fr",
    locale: exercise.locale ?? "fr",
    isActive: exercise.isActive ?? true,
    reviewStatus:
      exercise.reviewStatus ?? "a_verifier",
    translationStatus:
      exercise.translationStatus ??
      "translated",
    programmingStatus:
      exercise.programmingStatus ??
      "library_only",
    archivedAt: exercise.archivedAt ?? null,
    adminOverriddenAt: exercise.adminOverriddenAt ?? null,
    updatedAt: catalogMetadataUpdatedAt,
  };
}

async function upsertCatalogReleases(
  db: LocalDatabase,
  seed: CatalogSeed,
  options: CatalogSeedWriteOptions,
) {
  const defaults: readonly CatalogReleaseSeed[] = [];

  for (const release of defaults) {
    await db.runAsync(
      `INSERT INTO catalog_releases (
         code, source, source_revision, locale, expected_exercise_count,
         status, license_id, created_at, activated_at, archived_at, updated_at
       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(code) DO UPDATE SET
         source = excluded.source,
         source_revision = CASE
           WHEN excluded.source_revision = '' THEN catalog_releases.source_revision
           ELSE excluded.source_revision
         END,
         locale = excluded.locale,
         expected_exercise_count = excluded.expected_exercise_count,
         updated_at = excluded.updated_at
       WHERE ? = 1
         AND catalog_releases.status = excluded.status`,
      [
        ...releaseValues(release),
        options.authoritativeReleaseCodes ? 0 : 1,
      ],
    );
  }

  const releaseSeeds = seed.releases ?? [];
  for (const release of releaseSeeds) {
    const isAuthoritative =
      options.authoritativeReleaseCodes?.has(release.code) ?? false;
    await db.runAsync(
      `INSERT INTO catalog_releases (
         code, source, source_revision, locale, expected_exercise_count,
         status, license_id, activation_backup_reference,
         activation_diff_reference, created_at, activated_at, archived_at,
         updated_at
       ) VALUES (?, ?, ?, ?, ?, 'prepared', ?, ?, ?, ?, NULL, NULL, ?)
       ON CONFLICT(code) DO UPDATE SET
         source = excluded.source,
         source_revision = excluded.source_revision,
         locale = excluded.locale,
         expected_exercise_count = excluded.expected_exercise_count,
         license_id = CASE
           WHEN catalog_releases.status = 'prepared'
             AND excluded.license_id IS NOT NULL
             AND trim(excluded.license_id) <> ''
           THEN excluded.license_id
           ELSE catalog_releases.license_id
         END,
         updated_at = excluded.updated_at
       WHERE ? = 1 OR catalog_releases.status = 'prepared'`,
      [
        release.code,
        release.source,
        release.sourceRevision,
        release.locale,
        release.expectedExerciseCount,
        release.licenseId,
        release.activationBackupReference,
        release.activationDiffReference,
        release.createdAt,
        release.updatedAt,
        isAuthoritative ? 1 : 0,
      ],
    );
  }

  const authoritativeReleases = releaseSeeds.filter((release) =>
    options.authoritativeReleaseCodes?.has(release.code),
  );
  if (authoritativeReleases.length === 0) return;

  const activeReleases = authoritativeReleases.filter(
    (release) => release.status === "active",
  );
  if (activeReleases.length !== 1) {
    throw new Error(
      "Un snapshot catalogue autoritatif doit déclarer exactement une release active.",
    );
  }
  const desiredActive = activeReleases[0];
  await db.runAsync(
    `UPDATE catalog_releases
     SET status = 'archived',
         archived_at = COALESCE(archived_at, ?),
         updated_at = ?
     WHERE status = 'active' AND code <> ?`,
    [
      desiredActive.activatedAt ?? desiredActive.updatedAt,
      desiredActive.updatedAt,
      desiredActive.code,
    ],
  );
  for (const release of authoritativeReleases) {
    await db.runAsync(
      `UPDATE catalog_releases
       SET status = ?,
           license_id = ?,
           activation_backup_reference = ?,
           activation_diff_reference = ?,
           activated_at = ?,
           archived_at = ?,
           updated_at = ?
       WHERE code = ?`,
      [
        release.status,
        release.licenseId,
        release.activationBackupReference,
        release.activationDiffReference,
        release.activatedAt,
        release.archivedAt,
        release.updatedAt,
        release.code,
      ],
    );
  }

}

function releaseValues(release: CatalogReleaseSeed) {
  return [
    release.code,
    release.source,
    release.sourceRevision,
    release.locale,
    release.expectedExerciseCount,
    release.status,
    release.licenseId,
    release.createdAt,
    release.activatedAt,
    release.archivedAt,
    release.updatedAt,
  ];
}

async function upsertExerciseMedia(
  db: LocalDatabase,
  exerciseId: number,
  media: readonly CatalogExerciseMediaSeed[] | undefined,
) {
  if (media === undefined) return;

  const kinds = new Set(media.map((item) => item.kind));
  if (kinds.size !== media.length) {
    throw new Error("Un seul média poster et animation est autorisé par exercice.");
  }
  for (const item of media) {
    if (
      item.mimeType !== "image/webp" ||
      item.width <= 0 ||
      item.height <= 0 ||
      item.frameCount <= 0 ||
      (item.status === "ready" &&
        item.kind === "poster" &&
        item.frameCount !== 1) ||
      (item.status === "ready" &&
        item.kind === "animation" &&
        item.frameCount < 2)
    ) {
      throw new Error(`Média catalogue invalide: ${item.fileName}.`);
    }
  }

  await db.runAsync(
    "DELETE FROM catalog_exercise_media WHERE exercise_id = ?",
    [exerciseId],
  );
  for (const item of media) {
    await db.runAsync(
      `INSERT INTO catalog_exercise_media (
         exercise_id, kind, uri, file_name, mime_type, width, height,
         frame_count, loop_count, sha256, source_url, status, updated_at
       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        exerciseId,
        item.kind,
        item.uri,
        item.fileName,
        item.mimeType,
        item.width,
        item.height,
        item.frameCount,
        item.loopCount,
        item.sha256,
        null,
        item.status,
        item.updatedAt,
      ],
    );
  }
}
