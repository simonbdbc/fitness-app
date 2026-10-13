import type { LocalDatabase } from "@shared/db";

import type {
  CatalogEquipmentOption,
  CatalogFormat,
  CatalogInterval,
  CatalogRepetition,
  CatalogRest,
  CatalogSeries,
  CatalogSessionTemplate,
} from "../types";
import {
  mapEquipmentRow,
  mapExerciseMediaRow,
  mapFormatRow,
  mapIntervalRow,
  mapLookupRow,
  mapRepetitionRow,
  mapRestRow,
  mapSeriesRow,
  mapSessionTemplateLevelRow,
  mapSessionTemplateRow,
  type CatalogEquipmentUsageRow,
  type CatalogExerciseMuscleGroupRow,
  type CatalogExerciseMediaRow,
  type CatalogFormatRow,
  type CatalogIntervalRow,
  type CatalogRepetitionRow,
  type CatalogRestRow,
  type CatalogSeriesRow,
  type CatalogSessionTemplateLevelRow,
  type CatalogSessionTemplateRow,
  type EquipmentOptionRow,
  type EquipmentRow,
  type LookupRow,
} from "./catalogRows";

export async function readLookupRows(
  db: LocalDatabase,
  tableName:
    | "catalog_pillars"
    | "catalog_impacts"
    | "catalog_families"
    | "catalog_types"
    | "catalog_muscle_groups"
    | "catalog_equipment",
) {
  const rows = await db.getAllAsync<LookupRow>(
    `SELECT id, code, label FROM ${tableName} ORDER BY id`,
  );
  return rows.map(mapLookupRow);
}

export async function readEquipmentRows(db: LocalDatabase) {
  const rows = await db.getAllAsync<EquipmentRow>(
    `SELECT id, code, label, category
     FROM catalog_equipment
     ORDER BY category, label COLLATE NOCASE`,
  );
  return rows.map(mapEquipmentRow);
}

export async function readSeriesRows(
  db: LocalDatabase,
): Promise<CatalogSeries[]> {
  const rows = await db.getAllAsync<CatalogSeriesRow>(`
    SELECT id, code, label, series, updated_at
    FROM catalog_series
    ORDER BY series, id
  `);
  return rows.map(mapSeriesRow);
}

export async function readRepetitionRows(
  db: LocalDatabase,
): Promise<CatalogRepetition[]> {
  const rows = await db.getAllAsync<CatalogRepetitionRow>(`
    SELECT id, code, label, reps, updated_at
    FROM catalog_repetitions
    ORDER BY CASE WHEN reps IS NULL THEN 1 ELSE 0 END, reps, id
  `);
  return rows.map(mapRepetitionRow);
}

export async function readRestRows(
  db: LocalDatabase,
): Promise<CatalogRest[]> {
  const rows = await db.getAllAsync<CatalogRestRow>(`
    SELECT id, code, label, rest_seconds, updated_at
    FROM catalog_rests
    ORDER BY rest_seconds, id
  `);
  return rows.map(mapRestRow);
}

export async function readIntervalRows(
  db: LocalDatabase,
): Promise<CatalogInterval[]> {
  const rows = await db.getAllAsync<CatalogIntervalRow>(`
    SELECT id, code, label, effort_seconds, updated_at
    FROM catalog_intervals
    ORDER BY effort_seconds, id
  `);
  return rows.map(mapIntervalRow);
}

export async function readFormatRows(
  db: LocalDatabase,
): Promise<CatalogFormat[]> {
  const rows = await db.getAllAsync<CatalogFormatRow>(`
    SELECT
      format.id, format.code, format.format_type,
      format.series_id, series.code AS series_code,
      series.series AS series_count,
      format.repetitions_id, repetitions.code AS repetitions_code,
      repetitions.reps AS repetitions,
      format.rest_id, rests.code AS rest_code,
      rests.rest_seconds AS rest_seconds,
      format.interval_id, intervals.code AS interval_code,
      intervals.effort_seconds AS interval_seconds,
      format.label, format.description, format.source_status, format.updated_at
    FROM catalog_formats format
    JOIN catalog_series series ON series.id = format.series_id
    LEFT JOIN catalog_repetitions repetitions ON repetitions.id = format.repetitions_id
    JOIN catalog_rests rests ON rests.id = format.rest_id
    LEFT JOIN catalog_intervals intervals ON intervals.id = format.interval_id
    ORDER BY format.format_type, format.label COLLATE NOCASE, format.id
  `);
  return rows.map(mapFormatRow);
}

export async function readSessionTemplateRows(
  db: LocalDatabase,
): Promise<CatalogSessionTemplate[]> {
  const rows = await db.getAllAsync<CatalogSessionTemplateRow>(`
    SELECT
      session.id, session.code, session.title, session.description,
      session.exercise_id, exercise.code AS exercise_code,
      exercise.label AS exercise_label, exercise.pillar_id,
      pillar.code AS pillar_code, pillar.label AS pillar_label,
      exercise.family_id, family.code AS family_code,
      family.label AS family_label, session.is_active,
      session.phase, session.source_status, session.updated_at
    FROM catalog_session_templates session
    JOIN catalog_exercises exercise ON exercise.id = session.exercise_id
    JOIN catalog_pillars pillar ON pillar.id = exercise.pillar_id
    JOIN catalog_families family ON family.id = exercise.family_id
    ORDER BY session.title COLLATE NOCASE, session.id
  `);
  return rows.map(mapSessionTemplateRow);
}

export async function readSessionTemplateLevelRows(db: LocalDatabase) {
  const rows = await db.getAllAsync<CatalogSessionTemplateLevelRow>(`
    SELECT link.session_template_id,
           session.code AS session_template_code,
           link.level, link.updated_at
    FROM catalog_session_template_levels link
    JOIN catalog_session_templates session ON session.id = link.session_template_id
    ORDER BY link.level, link.session_template_id
  `);
  return rows.map(mapSessionTemplateLevelRow);
}

export function getCatalogEquipmentUsageRows(
  db: LocalDatabase,
  code: string,
) {
  return db.getAllAsync<CatalogEquipmentUsageRow>(
    `SELECT equipment.id, equipment.code, equipment.label, equipment.category,
            COUNT(DISTINCT options.exercise_id) AS exercise_count,
            (SELECT COUNT(*) FROM acrea_profile_equipment inventory
             WHERE inventory.equipment_id = equipment.id) AS profile_count
     FROM catalog_equipment equipment
     LEFT JOIN catalog_exercise_equipment_option_items items ON items.equipment_id = equipment.id
     LEFT JOIN catalog_exercise_equipment_options options ON options.id = items.option_id
     WHERE equipment.code = ?
     GROUP BY equipment.id, equipment.code, equipment.label, equipment.category
     LIMIT 1`,
    [code],
  );
}

export async function getMuscleGroupRowsByExerciseId(
  db: LocalDatabase,
  exerciseIds: number[],
) {
  const placeholders = exerciseIds.map(() => "?").join(", ");
  const rows = await db.getAllAsync<CatalogExerciseMuscleGroupRow>(
    `SELECT link.exercise_id, g.id, g.code, g.label
     FROM catalog_exercise_muscle_groups link
     JOIN catalog_muscle_groups g ON g.id = link.muscle_group_id
     WHERE link.exercise_id IN (${placeholders})
     ORDER BY link.exercise_id, g.label COLLATE NOCASE`,
    exerciseIds,
  );
  const grouped = new Map<number, CatalogExerciseMuscleGroupRow[]>();
  for (const row of rows) {
    const groupRows = grouped.get(row.exercise_id) ?? [];
    groupRows.push(row);
    grouped.set(row.exercise_id, groupRows);
  }
  return grouped;
}

export async function getEquipmentOptionsByExerciseId(
  db: LocalDatabase,
  exerciseIds: number[],
) {
  const placeholders = exerciseIds.map(() => "?").join(", ");
  const rows = await db.getAllAsync<EquipmentOptionRow>(
    `SELECT options.exercise_id, options.id AS option_id, options.kind,
            equipment.code AS equipment_code
     FROM catalog_exercise_equipment_options options
     LEFT JOIN catalog_exercise_equipment_option_items items
       ON items.option_id = options.id
     LEFT JOIN catalog_equipment equipment ON equipment.id = items.equipment_id
     WHERE options.exercise_id IN (${placeholders})
     ORDER BY options.exercise_id, options.option_index, equipment.code`,
    exerciseIds,
  );
  const grouped = new Map<number, Map<number, CatalogEquipmentOption>>();
  for (const row of rows) {
    const exerciseOptions = grouped.get(row.exercise_id) ?? new Map();
    const current =
      exerciseOptions.get(row.option_id) ??
      (row.kind === "bodyweight"
        ? { kind: "bodyweight", equipmentCodes: [] as [] }
        : { kind: "equipment", equipmentCodes: [] as string[] });
    if (current.kind === "equipment" && row.equipment_code) {
      current.equipmentCodes.push(row.equipment_code);
    }
    exerciseOptions.set(row.option_id, current);
    grouped.set(row.exercise_id, exerciseOptions);
  }
  return new Map(
    Array.from(grouped, ([exerciseId, options]) => [
      exerciseId,
      Array.from(options.values()),
    ]),
  );
}

export async function getMediaByExerciseId(
  db: LocalDatabase,
  exerciseIds: number[],
) {
  if (exerciseIds.length === 0) {
    return new Map<number, ReturnType<typeof mapExerciseMediaRow>[]>();
  }
  const placeholders = exerciseIds.map(() => "?").join(", ");
  const rows = await db.getAllAsync<CatalogExerciseMediaRow>(
    `SELECT id, exercise_id, kind, uri, file_name, mime_type, width, height,
            frame_count, loop_count, sha256, source_url, status, updated_at
     FROM catalog_exercise_media
     WHERE exercise_id IN (${placeholders})
     ORDER BY exercise_id,
              CASE kind WHEN 'poster' THEN 1 ELSE 2 END`,
    exerciseIds,
  );
  const grouped = new Map<number, ReturnType<typeof mapExerciseMediaRow>[]>();
  for (const row of rows) {
    const media = grouped.get(row.exercise_id) ?? [];
    media.push(mapExerciseMediaRow(row));
    grouped.set(row.exercise_id, media);
  }
  return grouped;
}
