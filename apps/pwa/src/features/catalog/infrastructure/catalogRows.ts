import type {
  CatalogEquipment,
  CatalogEquipmentOption,
  CatalogEquipmentUsage,
  CatalogExercise,
  CatalogExerciseMedia,
  CatalogFormat,
  CatalogInterval,
  CatalogRepetition,
  CatalogRest,
  CatalogSeries,
  CatalogSessionTemplate,
  CatalogSessionTemplateLevel,
} from "../types";

export type CatalogExerciseDataRow = {
  id: number;
  slug: string;
  label_fr: string;
  label_en: string;
  code: string;
  label: string;
  release_id: number;
  release_code: string;
  release_status: CatalogExercise["releaseStatus"];
  source_key: string | null;
  source_url: string;
  source_category: string;
  source_language: string;
  locale: string;
  pillar_id: number;
  pillar_code: string;
  pillar_label: string;
  difficulty: number;
  impact_id: number;
  impact_code: string;
  impact_label: string;
  family_id: number;
  family_code: string;
  family_label: string;
  type_id: number;
  type_code: string;
  type_label: string;
  equipment_id: number | null;
  equipment_code: string | null;
  equipment_label: string | null;
  regression_exercise_id: number | null;
  regression_exercise_code: string | null;
  regression_exercise_label: string | null;
  progression_exercise_id: number | null;
  progression_exercise_code: string | null;
  progression_exercise_label: string | null;
  movement_description: string;
  start_position: string;
  outbound_execution: string;
  return_execution: string;
  adapted_version: string;
  tips: string;
  errors: string;
  is_active: number;
  review_status: CatalogExercise["reviewStatus"];
  translation_status: CatalogExercise["translationStatus"];
  programming_status: CatalogExercise["programmingStatus"];
  archived_at: string | null;
  admin_overridden_at: string | null;
  updated_at: string;
};

export type CatalogExerciseMuscleGroupRow = {
  exercise_id: number;
  id: number;
  code: string;
  label: string;
};

export type CatalogExerciseMediaRow = {
  id: number;
  exercise_id: number;
  kind: CatalogExerciseMedia["kind"];
  uri: string;
  file_name: string;
  mime_type: "image/webp";
  width: number;
  height: number;
  frame_count: number;
  loop_count: number | null;
  sha256: string | null;
  status: CatalogExerciseMedia["status"];
  updated_at: string;
};

export type LookupRow = { id: number; code: string; label: string };

export type EquipmentRow = LookupRow & {
  category: CatalogEquipment["category"];
};

export type EquipmentOptionRow = {
  exercise_id: number;
  option_id: number;
  kind: "bodyweight" | "equipment";
  equipment_code: string | null;
};

export type CatalogEquipmentUsageRow = LookupRow & {
  category: CatalogEquipment["category"];
  exercise_count: number;
  profile_count: number;
};

export type CatalogFormatRow = {
  id: number;
  code: string;
  format_type: CatalogFormat["formatType"];
  series_id: number;
  series_code: string;
  repetitions_id: number | null;
  repetitions_code: string | null;
  rest_id: number;
  rest_code: string;
  interval_id: number | null;
  interval_code: string | null;
  label: string;
  description: string;
  series_count: number;
  repetitions: number | null;
  rest_seconds: number;
  interval_seconds: number | null;
  source_status: string;
  updated_at: string;
};

export type CatalogSeriesRow = {
  id: number;
  code: string;
  label: string;
  series: number;
  updated_at: string;
};

export type CatalogRepetitionRow = {
  id: number;
  code: string;
  reps: number | null;
  label: string;
  updated_at: string;
};

export type CatalogRestRow = {
  id: number;
  code: string;
  label: string;
  rest_seconds: number;
  updated_at: string;
};

export type CatalogIntervalRow = {
  id: number;
  code: string;
  effort_seconds: number;
  label: string;
  updated_at: string;
};

export type CatalogSessionTemplateRow = {
  id: number;
  code: string;
  title: string;
  description: string;
  exercise_id: number;
  exercise_code: string;
  exercise_label: string;
  pillar_id: number;
  pillar_code: string;
  pillar_label: string;
  family_id: number;
  family_code: string;
  family_label: string;
  phase: "warmup" | "main" | "cooldown";
  is_active: number;
  source_status: string;
  updated_at: string;
};

export type CatalogSessionTemplateLevelRow = {
  session_template_id: number;
  session_template_code: string;
  level: number;
  updated_at: string;
};

export function mapCatalogExerciseDataRow(
  row: CatalogExerciseDataRow,
  muscleGroupRows: CatalogExerciseMuscleGroupRow[],
  equipmentOptions: CatalogEquipmentOption[],
  media: CatalogExerciseMedia[],
): CatalogExercise {
  const family = mapLookupFields(
    row.family_id,
    row.family_code,
    row.family_label,
  );
  const startPositionSteps = splitTextLines(row.start_position);
  const outboundExecutionSteps = splitTextLines(row.outbound_execution);
  const returnExecutionSteps = splitTextLines(row.return_execution);
  const errors = splitTextLines(row.errors);

  return {
    id: row.id,
    slug: row.slug || row.code,
    sourceKey:
      row.source_key || `${row.release_code}:${row.slug || row.code}`,
    labelFr: row.label_fr || row.label,
    labelEn: row.label_en || row.label,
    categorySlug: row.source_category,
    code: row.code,
    label: row.label,
    name: row.label,
    pillarId: row.pillar_id,
    pillarCode: row.pillar_code,
    pillarLabel: row.pillar_label,
    difficulty: row.difficulty,
    levelMin: row.difficulty,
    levelMax: row.difficulty,
    impactId: row.impact_id,
    impactCode: row.impact_code,
    impactLabel: row.impact_label,
    impact: row.impact_code,
    family,
    families: [family],
    type: mapLookupFields(row.type_id, row.type_code, row.type_label),
    muscleGroups: muscleGroupRows.map((groupRow) =>
      mapLookupFields(groupRow.id, groupRow.code, groupRow.label),
    ),
    equipmentId: row.equipment_id,
    equipmentCode: row.equipment_code ?? "bodyweight",
    equipmentLabel: row.equipment_label ?? "Sans matériel",
    equipment: row.equipment_label ?? "Sans matériel",
    equipmentOptions,
    regressionExerciseId: row.regression_exercise_id,
    regressionExerciseCode: row.regression_exercise_code,
    regression: row.regression_exercise_label,
    progressionExerciseId: row.progression_exercise_id,
    progressionExerciseCode: row.progression_exercise_code,
    progression: row.progression_exercise_label ?? "",
    movementDescription: row.movement_description,
    description: row.movement_description,
    startPosition: row.start_position,
    outboundExecution: row.outbound_execution,
    returnExecution: row.return_execution,
    adaptedVersion: row.adapted_version,
    tips: row.tips,
    errors: row.errors,
    startPositionSteps,
    outboundExecutionSteps,
    returnExecutionSteps,
    positionSteps: startPositionSteps,
    executionSteps: [...outboundExecutionSteps, ...returnExecutionSteps],
    commonErrors: errors,
    releaseId: row.release_id,
    releaseCode: row.release_code,
    releaseStatus: row.release_status,
    sourceCategory: row.source_category,
    sourceLanguage: row.source_language,
    locale: row.locale,
    isActive: row.is_active === 1,
    reviewStatus: row.review_status,
    translationStatus: row.translation_status,
    programmingStatus: row.programming_status,
    archivedAt: row.archived_at,
    adminOverriddenAt: row.admin_overridden_at,
    media,
    sourceStatus: `release ${row.release_code}`,
    updatedAt: row.updated_at,
  };
}

export function mapExerciseMediaRow(
  row: CatalogExerciseMediaRow,
): CatalogExerciseMedia {
  return {
    id: row.id,
    exerciseId: row.exercise_id,
    kind: row.kind,
    uri: row.uri,
    fileName: row.file_name,
    mimeType: row.mime_type,
    width: row.width,
    height: row.height,
    frameCount: row.frame_count,
    loopCount: row.loop_count,
    sha256: row.sha256,
    status: row.status,
    updatedAt: row.updated_at,
  };
}

export function mapLookupRow(row: LookupRow) {
  return mapLookupFields(row.id, row.code, row.label);
}

export function mapEquipmentRow(row: EquipmentRow): CatalogEquipment {
  return { ...mapLookupRow(row), category: row.category };
}

export function mapSeriesRow(row: CatalogSeriesRow): CatalogSeries {
  return {
    id: row.id,
    code: row.code,
    label: row.label,
    series: row.series,
    updatedAt: row.updated_at,
  };
}

export function mapRepetitionRow(
  row: CatalogRepetitionRow,
): CatalogRepetition {
  return {
    id: row.id,
    code: row.code,
    label: row.label,
    reps: row.reps,
    updatedAt: row.updated_at,
  };
}

export function mapRestRow(row: CatalogRestRow): CatalogRest {
  return {
    id: row.id,
    code: row.code,
    label: row.label,
    restSeconds: row.rest_seconds,
    updatedAt: row.updated_at,
  };
}

export function mapIntervalRow(row: CatalogIntervalRow): CatalogInterval {
  return {
    id: row.id,
    code: row.code,
    label: row.label,
    effortSeconds: row.effort_seconds,
    updatedAt: row.updated_at,
  };
}

export function mapFormatRow(row: CatalogFormatRow): CatalogFormat {
  return {
    id: row.id,
    code: row.code,
    formatType: row.format_type,
    seriesId: row.series_id,
    seriesCode: row.series_code,
    seriesCount: row.series_count,
    repetitionsId: row.repetitions_id,
    repetitionsCode: row.repetitions_code,
    repetitions: row.repetitions,
    restId: row.rest_id,
    restCode: row.rest_code,
    restSeconds: row.rest_seconds,
    intervalId: row.interval_id,
    intervalCode: row.interval_code,
    intervalSeconds: row.interval_seconds,
    label: row.label,
    description: row.description,
    sourceStatus: row.source_status,
    updatedAt: row.updated_at,
  };
}

export function mapSessionTemplateRow(
  row: CatalogSessionTemplateRow,
): CatalogSessionTemplate {
  return {
    id: row.id,
    code: row.code,
    title: row.title,
    description: row.description,
    exerciseId: row.exercise_id,
    exerciseCode: row.exercise_code,
    exerciseLabel: row.exercise_label,
    pillarId: row.pillar_id,
    pillarCode: row.pillar_code,
    pillarLabel: row.pillar_label,
    familyId: row.family_id,
    familyCode: row.family_code,
    familyLabel: row.family_label,
    phase: row.phase,
    levels: [],
    isActive: row.is_active === 1,
    sourceStatus: row.source_status,
    updatedAt: row.updated_at,
  };
}

export function mapSessionTemplateLevelRow(
  row: CatalogSessionTemplateLevelRow,
): CatalogSessionTemplateLevel {
  return {
    sessionTemplateId: row.session_template_id,
    sessionTemplateCode: row.session_template_code,
    level: row.level,
    updatedAt: row.updated_at,
  };
}

export function mapCatalogEquipmentUsageRow(
  row: CatalogEquipmentUsageRow,
): CatalogEquipmentUsage {
  return {
    id: row.id,
    code: row.code,
    label: row.label,
    category: row.category,
    exerciseCount: row.exercise_count,
    profileCount: row.profile_count,
    updatedAt: "",
  };
}

function mapLookupFields(id: number, code: string, label: string) {
  return { id, code, label, updatedAt: "" };
}

function splitTextLines(value: string) {
  return value
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
}
