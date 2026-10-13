import { withDatabase } from "@shared/db";

import type {
  CatalogAdminSnapshot,
  CatalogEquipmentUsage,
  CatalogExercise,
  CatalogFilterOptions,
  CatalogFilters,
  CatalogFormat,
  CatalogRelease,
  CatalogTimerOptions,
} from "../types";
import {
  getEquipmentOptionsByExerciseId,
  getMediaByExerciseId,
  getMuscleGroupRowsByExerciseId,
  readEquipmentRows,
  readFormatRows,
  readIntervalRows,
  readLookupRows,
  readRepetitionRows,
  readRestRows,
  readSeriesRows,
  readSessionTemplateLevelRows,
  readSessionTemplateRows,
} from "./catalogQueries";
import {
  mapCatalogEquipmentUsageRow,
  mapCatalogExerciseDataRow,
  mapEquipmentRow,
  mapLookupRow,
  type CatalogEquipmentUsageRow,
  type CatalogExerciseDataRow,
  type EquipmentRow,
  type LookupRow,
} from "./catalogRows";

export function queryCatalogExercises(
  filters: CatalogFilters = {},
  releaseCode?: string,
  slugs?: readonly string[],
): Promise<CatalogExercise[]> {
  return withDatabase(async (db) => {
    const conditions: string[] = [];
    const params: (number | string)[] = [];

    if (releaseCode) {
      conditions.push("release.code = ?");
      params.push(releaseCode);
    } else if (!filters.includeArchived) {
      conditions.push("release.status = 'active'");
    }
    if (!filters.includeArchived) {
      conditions.push("e.is_active = 1");
    }
    if (slugs) {
      if (slugs.length === 0) return [];
      conditions.push(`e.slug IN (${slugs.map(() => "?").join(", ")})`);
      params.push(...slugs);
    }
    if (filters.pillarId) {
      conditions.push("e.pillar_id = ?");
      params.push(filters.pillarId);
    }
    if (filters.familyId) {
      conditions.push("e.family_id = ?");
      params.push(filters.familyId);
    }
    if (filters.typeId) {
      conditions.push("e.type_id = ?");
      params.push(filters.typeId);
    }
    if (filters.muscleGroupId) {
      conditions.push(`exists (
        select 1 from catalog_exercise_muscle_groups filtered_group
        where filtered_group.exercise_id = e.id
          and filtered_group.muscle_group_id = ?
      )`);
      params.push(filters.muscleGroupId);
    }
    if (filters.equipment?.kind === "bodyweight") {
      conditions.push(`(
        EXISTS (
          SELECT 1 FROM catalog_exercise_equipment_options filtered_option
          WHERE filtered_option.exercise_id = e.id
            AND filtered_option.kind = 'bodyweight'
        ) OR (
          NOT EXISTS (
            SELECT 1 FROM catalog_exercise_equipment_options any_option
            WHERE any_option.exercise_id = e.id
          ) AND e.equipment_id IS NULL
        )
      )`);
    }
    if (filters.equipment?.kind === "equipment") {
      conditions.push(`(
        EXISTS (
          SELECT 1
          FROM catalog_exercise_equipment_options filtered_option
          JOIN catalog_exercise_equipment_option_items filtered_item
            ON filtered_item.option_id = filtered_option.id
          JOIN catalog_equipment filtered_equipment
            ON filtered_equipment.id = filtered_item.equipment_id
          WHERE filtered_option.exercise_id = e.id
            AND filtered_option.kind = 'equipment'
            AND filtered_equipment.code = ?
        ) OR (
          NOT EXISTS (
            SELECT 1 FROM catalog_exercise_equipment_options any_option
            WHERE any_option.exercise_id = e.id
          ) AND equipment.code = ?
        )
      )`);
      params.push(
        filters.equipment.equipmentCode,
        filters.equipment.equipmentCode,
      );
    }
    if (typeof filters.level === "number") {
      conditions.push(
        "e.difficulty = ? AND e.programming_status = 'eligible'",
      );
      params.push(filters.level);
    }
    const query = filters.query?.trim();
    if (query) {
      conditions.push(`(
        ${catalogAccentFoldedLike("e.code")}
        OR ${catalogAccentFoldedLike("e.label")}
        OR ${catalogAccentFoldedLike("e.movement_description")}
        OR ${catalogAccentFoldedLike("e.adapted_version")}
        OR EXISTS (
          SELECT 1
          FROM catalog_exercise_muscle_groups search_group_link
          JOIN catalog_muscle_groups search_group
            ON search_group.id = search_group_link.muscle_group_id
          WHERE search_group_link.exercise_id = e.id
            AND (
              ${catalogAccentFoldedLike("search_group.label")}
              OR ${catalogAccentFoldedLike("search_group.code")}
            )
        )
      )`);
      const normalizedPattern = `%${normalizeCatalogSearchTerm(query)}%`;
      params.push(...Array.from({ length: 6 }, () => normalizedPattern));
    }

    const whereClause =
      conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";
    const rows = await db.getAllAsync<CatalogExerciseDataRow>(
      `SELECT
        e.id, e.slug, e.label_fr, e.label_en, e.code, e.label, e.release_id,
        release.code AS release_code, release.status AS release_status,
        e.source_key, e.source_url, e.source_category, e.source_language,
        e.locale, e.pillar_id,
        pillar.code AS pillar_code, pillar.label AS pillar_label,
        e.difficulty, e.impact_id,
        impact.code AS impact_code, impact.label AS impact_label,
        e.family_id, family.code AS family_code,
        family.label AS family_label, e.type_id,
        catalog_type.code AS type_code, catalog_type.label AS type_label,
        e.equipment_id, equipment.code AS equipment_code,
        equipment.label AS equipment_label, e.regression_exercise_id,
        regression.code AS regression_exercise_code,
        regression.label AS regression_exercise_label,
        e.progression_exercise_id,
        progression.code AS progression_exercise_code,
        progression.label AS progression_exercise_label,
        e.movement_description, e.start_position, e.outbound_execution,
        e.return_execution, e.adapted_version, e.tips, e.errors,
        e.is_active, e.review_status, e.translation_status,
        e.programming_status, e.archived_at, e.admin_overridden_at,
        e.updated_at
       FROM catalog_exercises e
       JOIN catalog_releases release ON release.id = e.release_id
       JOIN catalog_pillars pillar ON pillar.id = e.pillar_id
       JOIN catalog_impacts impact ON impact.id = e.impact_id
       JOIN catalog_families family ON family.id = e.family_id
       JOIN catalog_types catalog_type ON catalog_type.id = e.type_id
       LEFT JOIN catalog_equipment equipment ON equipment.id = e.equipment_id
       LEFT JOIN catalog_exercises regression ON regression.id = e.regression_exercise_id
       LEFT JOIN catalog_exercises progression ON progression.id = e.progression_exercise_id
       ${whereClause}
       ORDER BY CASE pillar.code
         WHEN 'warm-up' THEN 1 WHEN 'cardio' THEN 2
         WHEN 'strength' THEN 3 WHEN 'proprioception' THEN 4
         WHEN 'flexibility' THEN 5 ELSE 99 END,
         e.difficulty, e.label COLLATE NOCASE`,
      params,
    );
    if (rows.length === 0) return [];

    // Expo SQLite Web finalizes shorthand statements on a shared worker.
    // Keep these reads ordered to avoid finalizing a statement still in use.
    const exerciseIds = rows.map((row) => row.id);
    const muscleGroups = await getMuscleGroupRowsByExerciseId(db, exerciseIds);
    const equipmentOptions = await getEquipmentOptionsByExerciseId(
      db,
      exerciseIds,
    );
    const media = await getMediaByExerciseId(db, exerciseIds);
    return rows.map((row) =>
      mapCatalogExerciseDataRow(
        row,
        muscleGroups.get(row.id) ?? [],
        equipmentOptions.get(row.id) ?? [],
        media.get(row.id) ?? [],
      ),
    );
  });
}

function normalizeCatalogSearchTerm(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("fr")
    .replaceAll("œ", "oe")
    .replaceAll("æ", "ae");
}

function catalogAccentFoldedLike(column: string) {
  const replacements = [
    ["à", "a"],
    ["â", "a"],
    ["ä", "a"],
    ["À", "a"],
    ["Â", "a"],
    ["Ä", "a"],
    ["ç", "c"],
    ["Ç", "c"],
    ["é", "e"],
    ["è", "e"],
    ["ê", "e"],
    ["ë", "e"],
    ["É", "e"],
    ["È", "e"],
    ["Ê", "e"],
    ["Ë", "e"],
    ["î", "i"],
    ["ï", "i"],
    ["Î", "i"],
    ["Ï", "i"],
    ["ô", "o"],
    ["ö", "o"],
    ["Ô", "o"],
    ["Ö", "o"],
    ["ù", "u"],
    ["û", "u"],
    ["ü", "u"],
    ["Ù", "u"],
    ["Û", "u"],
    ["Ü", "u"],
    ["ÿ", "y"],
    ["Ÿ", "y"],
    ["œ", "oe"],
    ["Œ", "oe"],
    ["æ", "ae"],
    ["Æ", "ae"],
  ] as const;
  const expression = replacements.reduce(
    (current, [source, replacement]) =>
      `replace(${current}, '${source}', '${replacement}')`,
    `lower(${column})`,
  );

  return `${expression} LIKE ?`;
}

export function queryCatalogFilterOptions(
  releaseCode?: string,
): Promise<CatalogFilterOptions> {
  return withDatabase(async (db) => {
    const releasePredicate = releaseCode
      ? "release.code = ?"
      : "release.status = 'active'";
    const releaseParams = releaseCode ? [releaseCode] : [];
    const pillarRows = await db.getAllAsync<LookupRow>(`
      SELECT p.id, p.code, p.label FROM catalog_pillars p
      WHERE EXISTS (
        SELECT 1 FROM catalog_exercises e
        JOIN catalog_releases release ON release.id = e.release_id
        WHERE e.pillar_id = p.id AND e.is_active = 1
          AND ${releasePredicate}
      )
      ORDER BY CASE p.code
        WHEN 'warm-up' THEN 1 WHEN 'cardio' THEN 2
        WHEN 'strength' THEN 3 WHEN 'proprioception' THEN 4
        WHEN 'flexibility' THEN 5 ELSE 99 END, p.label COLLATE NOCASE
    `, releaseParams);
    const familyRows = await db.getAllAsync<LookupRow>(`
      SELECT f.id, f.code, f.label FROM catalog_families f
      WHERE EXISTS (
        SELECT 1 FROM catalog_exercises e
        JOIN catalog_releases release ON release.id = e.release_id
        WHERE e.family_id = f.id AND e.is_active = 1
          AND ${releasePredicate}
      )
      ORDER BY f.label COLLATE NOCASE
    `, releaseParams);
    const typeRows = await db.getAllAsync<LookupRow>(`
      SELECT t.id, t.code, t.label FROM catalog_types t
      WHERE EXISTS (
        SELECT 1 FROM catalog_exercises e
        JOIN catalog_releases release ON release.id = e.release_id
        WHERE e.type_id = t.id AND e.is_active = 1
          AND ${releasePredicate}
      )
      ORDER BY t.label COLLATE NOCASE
    `, releaseParams);
    const muscleGroupRows = await db.getAllAsync<LookupRow>(`
      SELECT g.id, g.code, g.label FROM catalog_muscle_groups g
      WHERE EXISTS (
        SELECT 1 FROM catalog_exercise_muscle_groups link
        JOIN catalog_exercises e ON e.id = link.exercise_id
        JOIN catalog_releases release ON release.id = e.release_id
        WHERE link.muscle_group_id = g.id
          AND e.is_active = 1 AND ${releasePredicate}
      ) ORDER BY g.label COLLATE NOCASE
    `, releaseParams);
    const equipmentRows = await db.getAllAsync<EquipmentRow>(`
      SELECT DISTINCT equipment.id, equipment.code,
             equipment.label, equipment.category
      FROM catalog_equipment equipment
      WHERE EXISTS (
        SELECT 1 FROM catalog_exercise_equipment_option_items item
        JOIN catalog_exercise_equipment_options option ON option.id = item.option_id
        JOIN catalog_exercises e ON e.id = option.exercise_id
        JOIN catalog_releases release ON release.id = e.release_id
        WHERE item.equipment_id = equipment.id AND option.kind = 'equipment'
          AND e.is_active = 1 AND ${releasePredicate}
      ) OR EXISTS (
        SELECT 1 FROM catalog_exercises e
        JOIN catalog_releases release ON release.id = e.release_id
        WHERE e.equipment_id = equipment.id AND e.is_active = 1
          AND ${releasePredicate}
          AND NOT EXISTS (
            SELECT 1 FROM catalog_exercise_equipment_options option
            WHERE option.exercise_id = e.id
          )
      ) ORDER BY equipment.label COLLATE NOCASE
    `, [...releaseParams, ...releaseParams]);
    const bodyweightRow = await db.getFirstAsync<{
      has_bodyweight_option: number;
    }>(`SELECT CASE WHEN EXISTS (
          SELECT 1 FROM catalog_exercise_equipment_options option
          JOIN catalog_exercises e ON e.id = option.exercise_id
          JOIN catalog_releases release ON release.id = e.release_id
          WHERE option.kind = 'bodyweight' AND e.is_active = 1
            AND ${releasePredicate}
        ) OR EXISTS (
          SELECT 1 FROM catalog_exercises e
          JOIN catalog_releases release ON release.id = e.release_id
          WHERE e.equipment_id IS NULL AND e.is_active = 1
            AND ${releasePredicate} AND NOT EXISTS (
            SELECT 1 FROM catalog_exercise_equipment_options option
            WHERE option.exercise_id = e.id
          )
        ) THEN 1 ELSE 0 END AS has_bodyweight_option`, [
      ...releaseParams,
      ...releaseParams,
    ]);
    const levelRows = await db.getAllAsync<{ difficulty: number }>(`
      SELECT DISTINCT e.difficulty
      FROM catalog_exercises e
      JOIN catalog_releases release ON release.id = e.release_id
      WHERE e.is_active = 1 AND ${releasePredicate}
        AND e.programming_status = 'eligible'
      ORDER BY e.difficulty
    `, releaseParams);

    return {
      pillars: pillarRows.map(mapLookupRow),
      families: familyRows.map(mapLookupRow),
      types: typeRows.map(mapLookupRow),
      muscleGroups: muscleGroupRows.map(mapLookupRow),
      equipment: equipmentRows.map(mapEquipmentRow),
      hasBodyweightOption: bodyweightRow?.has_bodyweight_option === 1,
      levels: levelRows.map((row) => row.difficulty),
    };
  });
}

export function queryCatalogEquipmentUsage(): Promise<
  CatalogEquipmentUsage[]
> {
  return withDatabase(async (db) => {
    const rows = await db.getAllAsync<CatalogEquipmentUsageRow>(`
      SELECT equipment.id, equipment.code, equipment.label, equipment.category,
             COUNT(DISTINCT options.exercise_id) AS exercise_count,
             (SELECT COUNT(*) FROM acrea_profile_equipment inventory
              WHERE inventory.equipment_id = equipment.id) AS profile_count
      FROM catalog_equipment equipment
      LEFT JOIN catalog_exercise_equipment_option_items items ON items.equipment_id = equipment.id
      LEFT JOIN catalog_exercise_equipment_options options ON options.id = items.option_id
      GROUP BY equipment.id, equipment.code, equipment.label, equipment.category
      ORDER BY equipment.label COLLATE NOCASE, equipment.code COLLATE NOCASE
    `);
    return rows.map(mapCatalogEquipmentUsageRow);
  });
}

export async function queryCatalogAdminSnapshot(): Promise<CatalogAdminSnapshot> {
  const exercises = await queryCatalogExercises({ includeArchived: true });
  return withDatabase(async (db) => {
    // Do not run shorthand Expo SQLite reads concurrently on the Web worker.
    const pillars = await readLookupRows(db, "catalog_pillars");
    const impacts = await readLookupRows(db, "catalog_impacts");
    const families = await readLookupRows(db, "catalog_families");
    const types = await readLookupRows(db, "catalog_types");
    const muscleGroups = await readLookupRows(db, "catalog_muscle_groups");
    const equipment = await readEquipmentRows(db);
    const series = await readSeriesRows(db);
    const repetitions = await readRepetitionRows(db);
    const rests = await readRestRows(db);
    const intervals = await readIntervalRows(db);
    const formats = await readFormatRows(db);
    const sessionsWithoutLevels = await readSessionTemplateRows(db);
    const sessionTemplateLevels = await readSessionTemplateLevelRows(db);
    const releases = await db.getAllAsync<{
        id: number;
        code: string;
        source: string;
        source_revision: string;
        locale: string;
        expected_exercise_count: number;
        status: CatalogRelease["status"];
        license_id: string | null;
        activation_backup_reference: string | null;
        activation_diff_reference: string | null;
        created_at: string;
        activated_at: string | null;
        archived_at: string | null;
        updated_at: string;
      }>(`SELECT * FROM catalog_releases ORDER BY id`);
    const levelsBySessionId = new Map<number, number[]>();
    for (const link of sessionTemplateLevels) {
      const levels = levelsBySessionId.get(link.sessionTemplateId) ?? [];
      levels.push(link.level);
      levelsBySessionId.set(link.sessionTemplateId, levels);
    }
    const sessionTemplates = sessionsWithoutLevels.map((session) => ({
      ...session,
      levels: levelsBySessionId.get(session.id) ?? [],
    }));
    return {
      releases: releases.map((release) => ({
        id: release.id,
        code: release.code,
        source: release.source,
        sourceRevision: release.source_revision,
        locale: release.locale,
        expectedExerciseCount: release.expected_exercise_count,
        status: release.status,
        licenseId: release.license_id,
        activationBackupReference: release.activation_backup_reference,
        activationDiffReference: release.activation_diff_reference,
        createdAt: release.created_at,
        activatedAt: release.activated_at,
        archivedAt: release.archived_at,
        updatedAt: release.updated_at,
      })),
      pillars,
      impacts,
      families,
      types,
      muscleGroups,
      equipment,
      exercises,
      series,
      repetitions,
      rests,
      intervals,
      formats,
      sessionTemplates,
      sessionTemplateLevels,
      exerciseLevels: exercises.map((exercise) => ({
        exerciseId: exercise.id,
        exerciseCode: exercise.code,
        level: exercise.difficulty,
        isActive: exercise.isActive,
        sourceStatus: "derived from catalog_exercises.difficulty",
        updatedAt: exercise.updatedAt,
      })),
    };
  });
}

export function queryCatalogTimerOptions(): Promise<CatalogTimerOptions> {
  return withDatabase(async (db) => {
    const [series, repetitions, rests, intervals] = await Promise.all([
      readSeriesRows(db),
      readRepetitionRows(db),
      readRestRows(db),
      readIntervalRows(db),
    ]);
    return { series, repetitions, rests, intervals };
  });
}

export function queryCatalogFormats(): Promise<CatalogFormat[]> {
  return withDatabase(readFormatRows);
}
