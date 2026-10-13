import { matchesEquipmentFilter } from "../services/equipmentRequirements";
import type {
  CatalogAdminSnapshot,
  CatalogExerciseInput,
} from "../services/catalogRemote";
import type {
  CatalogExercise,
  CatalogExerciseReviewStatus,
  CatalogEquipmentOption,
  CatalogFilterOptions,
  CatalogFilters,
} from "../types";
export type LoadStatus = "loading" | "success" | "error";
export type AdminActivityFilter = "all" | "active" | "inactive";

export type AdminCatalogFilters = {
  activity: AdminActivityFilter;
  reviewStatus?: CatalogExerciseReviewStatus;
};

export type ExerciseDraft = {
  id: number | null;
  code: string;
  name: string;
  pillarId: number | null;
  familyIds: number[];
  typeId: number | null;
  muscleGroupIds: number[];
  levelMin: string;
  levelMax: string;
  equipmentOptions: CatalogEquipmentOption[];
  impact: string;
  regression: string;
  progression: string;
  description: string;
  startPositionStepsText: string;
  outboundExecutionStepsText: string;
  returnExecutionStepsText: string;
  tips: string;
  commonErrorsText: string;
  isActive: boolean;
  reviewStatus: CatalogExerciseReviewStatus;
  sourceStatus: string;
};

export const emptyFilterOptions: CatalogFilterOptions = {
  pillars: [],
  families: [],
  types: [],
  muscleGroups: [],
  equipment: [],
  hasBodyweightOption: false,
  levels: [],
};

export const emptyAdminFilters: AdminCatalogFilters = {
  activity: "all",
};

export function catalogReviewBatchSignature(
  exercises: readonly CatalogExercise[],
): string | null {
  if (exercises.length === 0) {
    return null;
  }

  const releaseCodes = new Set(
    exercises.map((exercise) => exercise.releaseCode),
  );
  if (
    releaseCodes.size !== 1 ||
    exercises.some((exercise) => exercise.slug.trim().length === 0)
  ) {
    return null;
  }

  const releaseCode = [...releaseCodes][0];
  const exerciseSlugs = exercises
    .map((exercise) => exercise.slug.trim())
    .sort((left, right) => left.localeCompare(right));

  return JSON.stringify([releaseCode, exerciseSlugs]);
}

export function isCatalogReviewBatchArmed(
  armedSignature: string | null,
  currentSignature: string | null,
) {
  return (
    armedSignature !== null &&
    currentSignature !== null &&
    armedSignature === currentSignature
  );
}

export function filterOptionsFromSnapshot(
  snapshot: CatalogAdminSnapshot,
): CatalogFilterOptions {
  const equipmentCodes = new Set<string>();
  const levels = new Set<number>();
  let hasBodyweightOption = false;

  for (const exercise of snapshot.exercises) {
    for (const option of exercise.equipmentOptions) {
      if (option.kind === "bodyweight") {
        hasBodyweightOption = true;
      } else {
        option.equipmentCodes.forEach((code) => equipmentCodes.add(code));
      }
    }

    if (exercise.equipmentOptions.length === 0) {
      if (matchesEquipmentFilter(exercise, { kind: "bodyweight" })) {
        hasBodyweightOption = true;
      } else if (exercise.equipmentCode) {
        equipmentCodes.add(exercise.equipmentCode);
      }
    }

    for (
      let level = exercise.levelMin;
      level <= exercise.levelMax;
      level += 1
    ) {
      levels.add(level);
    }
  }

  return {
    pillars: [...snapshot.pillars],
    families: [...snapshot.families],
    types: [...snapshot.types],
    muscleGroups: [...snapshot.muscleGroups],
    equipment: snapshot.equipment
      .filter((equipment) => equipmentCodes.has(equipment.code))
      .sort((left, right) => left.label.localeCompare(right.label, "fr")),
    hasBodyweightOption,
    levels: Array.from(levels).sort((left, right) => left - right),
  };
}

export function applyCatalogFilters(
  exercises: CatalogExercise[],
  filters: CatalogFilters,
) {
  return exercises.filter((exercise) => {
    if (filters.pillarId && exercise.pillarId !== filters.pillarId) {
      return false;
    }

    if (filters.familyId && exercise.family.id !== filters.familyId) {
      return false;
    }

    if (
      filters.equipment &&
      !matchesEquipmentFilter(exercise, filters.equipment)
    ) {
      return false;
    }

    if (typeof filters.level === "number") {
      if (exercise.programmingStatus !== "eligible") {
        return false;
      }
      return (
        exercise.levelMin <= filters.level && exercise.levelMax >= filters.level
      );
    }

    return true;
  });
}

export function applyAdminFilters(
  exercises: CatalogExercise[],
  filters: AdminCatalogFilters,
) {
  return exercises
    .filter((exercise) => {
      if (filters.activity === "active" && !exercise.isActive) {
        return false;
      }

      if (filters.activity === "inactive" && exercise.isActive) {
        return false;
      }

      if (
        filters.reviewStatus &&
        exercise.reviewStatus !== filters.reviewStatus
      ) {
        return false;
      }

      return true;
    })
    .sort(compareExercises);
}

export function countReviewStatuses(exercises: CatalogExercise[]) {
  return exercises.reduce(
    (counts, exercise) => ({
      ...counts,
      [exercise.reviewStatus]: counts[exercise.reviewStatus] + 1,
    }),
    {
      a_verifier: 0,
      valide: 0,
      a_revoir: 0,
    } satisfies Record<CatalogExerciseReviewStatus, number>,
  );
}

export function draftFromExercise(exercise: CatalogExercise): ExerciseDraft {
  return {
    id: exercise.id,
    code: exercise.code,
    name: exercise.name,
    pillarId: exercise.pillarId,
    familyIds: [exercise.family.id],
    typeId: exercise.type.id,
    muscleGroupIds: exercise.muscleGroups.map((group) => group.id),
    levelMin: `${exercise.levelMin}`,
    levelMax: `${exercise.levelMax}`,
    equipmentOptions: exercise.equipmentOptions.map((option) => ({
      ...option,
      equipmentCodes: [...option.equipmentCodes],
    })) as CatalogEquipmentOption[],
    impact: exercise.impact ?? "",
    regression: exercise.regression ?? "",
    progression: exercise.progression,
    description: exercise.description,
    startPositionStepsText: JSON.stringify(
      exercise.startPositionSteps,
      null,
      2,
    ),
    outboundExecutionStepsText: JSON.stringify(
      exercise.outboundExecutionSteps,
      null,
      2,
    ),
    returnExecutionStepsText: JSON.stringify(
      exercise.returnExecutionSteps,
      null,
      2,
    ),
    tips: exercise.tips,
    commonErrorsText: JSON.stringify(exercise.commonErrors, null, 2),
    isActive: exercise.isActive,
    reviewStatus: exercise.reviewStatus,
    sourceStatus: exercise.sourceStatus,
  };
}

export function inputFromExerciseDraft(draft: ExerciseDraft): CatalogExerciseInput {
  const levelMin = numberFromText(draft.levelMin);
  const levelMax = numberFromText(draft.levelMax || draft.levelMin);

  return {
    id: draft.id ?? 0,
    code: draft.code || codeFromLabel("exercise", draft.name),
    name: requireValue(draft.name, "Nom exercice"),
    pillarId: requireNumber(draft.pillarId, "Pilier exercice"),
    pillarCode: "",
    familyId: requireNonEmptyNumbers(draft.familyIds, "Famille exercice")[0],
    typeId: requireNumber(draft.typeId, "Type exercice"),
    muscleGroupIds: requireNonEmptyNumbers(
      draft.muscleGroupIds,
      "Groupes musculaires exercice",
    ),
    levelMin,
    levelMax,
    equipmentOptions: validateEquipmentOptions(draft.equipmentOptions),
    impact: nullableValue(draft.impact),
    regression: nullableValue(draft.regression),
    progression: draft.progression,
    description: requireValue(draft.description, "Description exercice"),
    startPositionSteps: parseStringList(draft.startPositionStepsText),
    outboundExecutionSteps: parseStringList(draft.outboundExecutionStepsText),
    returnExecutionSteps: parseStringList(draft.returnExecutionStepsText),
    tips: draft.tips,
    commonErrors: parseStringList(draft.commonErrorsText),
    isActive: draft.isActive,
    reviewStatus: draft.reviewStatus,
    sourceStatus: requireValue(draft.sourceStatus, "Statut source exercice"),
  };
}

export function replaceEquipmentOption(
  options: CatalogEquipmentOption[],
  optionIndex: number,
  option: CatalogEquipmentOption,
) {
  return options.map((current, index) =>
    index === optionIndex ? option : current,
  );
}

export function validateEquipmentOptions(options: CatalogEquipmentOption[]) {
  if (options.length === 0) {
    throw new Error("Au moins une option d'équipement est requise.");
  }

  const signatures = new Set<string>();
  return options.map((option) => {
    const equipmentCodes = Array.from(new Set(option.equipmentCodes)).sort();
    if (option.kind === "equipment" && equipmentCodes.length === 0) {
      throw new Error(
        "Chaque option avec équipement doit contenir au moins un élément.",
      );
    }
    const signature = `${option.kind}:${equipmentCodes.join("+")}`;
    if (signatures.has(signature)) {
      throw new Error("Deux options d'équipement sont identiques.");
    }
    signatures.add(signature);
    return option.kind === "bodyweight"
      ? { kind: "bodyweight" as const, equipmentCodes: [] as [] }
      : { kind: "equipment" as const, equipmentCodes };
  });
}

export function parseStringList(value: string) {
  const trimmed = value.trim();

  if (!trimmed) {
    return [];
  }

  try {
    const parsed = JSON.parse(trimmed) as unknown;

    if (Array.isArray(parsed)) {
      return parsed.map(String).filter(Boolean);
    }
  } catch {
    return trimmed
      .split(/[\n,]/)
      .map((item) => item.trim())
      .filter(Boolean);
  }

  return [];
}

export function numberFromText(value: string) {
  const numberValue = Number(value);

  if (!Number.isFinite(numberValue)) {
    throw new Error(`Valeur numérique invalide: ${value}`);
  }

  return numberValue;
}

export function nullableValue(value: string) {
  const trimmed = value.trim();

  return trimmed ? trimmed : null;
}

export function requireValue(value: string, label: string) {
  const trimmed = value.trim();

  if (!trimmed) {
    throw new Error(`${label} est requis.`);
  }

  return trimmed;
}

export function requireNumber(value: number | null | undefined, label: string) {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    throw new Error(`${label} est requis.`);
  }

  return value;
}

export function uniqueNumbers(values: number[]) {
  return Array.from(new Set(values.filter((value) => Number.isFinite(value))));
}

export function requireNonEmptyNumbers(values: number[], label: string) {
  const uniqueValues = uniqueNumbers(values);

  if (uniqueValues.length === 0) {
    throw new Error(`${label} est requis.`);
  }

  return uniqueValues;
}

export function codeFromLabel(prefix: string, label: string) {
  const slug = label
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

  return `${prefix}-${slug || Date.now()}`;
}

export function compareExercises(left: CatalogExercise, right: CatalogExercise) {
  return (
    left.pillarCode.localeCompare(right.pillarCode, "fr") ||
    left.levelMin - right.levelMin ||
    left.levelMax - right.levelMax ||
    left.name.localeCompare(right.name, "fr")
  );
}

export function pillarBadgeVariant(pillar: string) {
  if (pillar === "strength") {
    return "success";
  }

  if (pillar === "cardio") {
    return "warning";
  }

  if (pillar === "equilibre") {
    return "info";
  }

  return "muted";
}

export function reviewStatusBadgeVariant(reviewStatus: CatalogExerciseReviewStatus) {
  if (reviewStatus === "valide") {
    return "success";
  }

  if (reviewStatus === "a_revoir") {
    return "danger";
  }

  return "warning";
}

export function errorMessageFromUnknown(error: unknown) {
  if (error instanceof Error && error.message.trim()) {
    return error.message;
  }

  return "Action catalogue impossible.";
}
