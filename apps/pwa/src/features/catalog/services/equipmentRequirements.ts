import type {
  CatalogEquipmentFilter,
  CatalogEquipmentOption,
  CatalogEquipmentSeed,
  CatalogExercise,
  CatalogExerciseSeed,
} from "../types";

export const canonicalEquipment = [
  equipment("wall", "Wall", "Mur", "maison"),
  equipment("chair", "Chair", "Chaise", "maison"),
  equipment("table", "Table", "Table", "maison"),
  equipment("countertop", "Countertop", "Plan de travail", "maison"),
  equipment("couch", "Couch", "Canapé", "maison"),
  equipment("stair", "Stair", "Marche", "maison"),
  equipment("door", "Door", "Porte", "maison"),
  equipment("towel", "Towel", "Serviette", "maison"),
  equipment("rings", "Rings", "Anneaux", "sport"),
  equipment("pull-up-bar", "Pull-up bar", "Barre de traction", "sport"),
  equipment("low-bar", "Low bar", "Barre basse", "sport"),
  equipment("vertical-bar", "Vertical bar", "Barre verticale", "sport"),
  equipment("parallel-bars", "Parallel bars", "Barres parallèles", "sport"),
  equipment("parallettes", "Parallettes", "Parallettes", "sport"),
  equipment("bench", "Bench", "Banc", "sport"),
  equipment("box", "Box", "Box", "sport"),
  equipment("step", "Step", "Step", "sport"),
  equipment("resistance-band", "Resistance band", "Élastique", "sport"),
  equipment("jump-rope", "Jump rope", "Corde à sauter", "sport"),
  equipment("kettlebell", "Kettlebell", "Kettlebell", "sport"),
  equipment("rowing-machine", "Rowing machine", "Rameur", "sport"),
  equipment("treadmill", "Treadmill", "Tapis de course", "sport"),
  equipment("exercise-mat", "Exercise mat", "Tapis de sol", "sport"),
  equipment("stationary-bike", "Stationary bike", "Vélo", "sport"),
  equipment("no-equipment", "No equipment", "Sans équipement", "sport"),
] as const satisfies readonly CatalogEquipmentSeed[];

const canonicalEquipmentCodes = new Set(canonicalEquipment.map(({ code }) => code));

export function matchesEquipmentFilter(
  exercise: Pick<CatalogExercise, "equipmentCode" | "equipmentOptions">,
  filter: CatalogEquipmentFilter,
): boolean {
  if (filter.kind === "bodyweight") {
    return exercise.equipmentOptions.some((option) => option.kind === "bodyweight");
  }
  return exercise.equipmentOptions.some(
    (option) => option.kind === "equipment" && option.equipmentCodes.includes(filter.equipmentCode),
  );
}

export function equipmentOptionsForExercise(
  exercise: Pick<CatalogExerciseSeed, "equipmentCode">,
): CatalogEquipmentOption[] {
  if (exercise.equipmentCode === "no-equipment") {
    return [{ kind: "bodyweight", equipmentCodes: [] }];
  }
  if (!canonicalEquipmentCodes.has(exercise.equipmentCode)) {
    throw new Error(`Équipement hors référentiel: ${exercise.equipmentCode}`);
  }
  return [{ kind: "equipment", equipmentCodes: [exercise.equipmentCode] }];
}

function equipment(
  code: string,
  labelEn: string,
  label: string,
  category: "maison" | "sport",
): CatalogEquipmentSeed {
  return { code, label, labelEn, category };
}
