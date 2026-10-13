import type {
  CatalogExercise,
  CatalogExerciseFamily,
} from "../types";
export type CatalogFamilyGroup = {
  family: CatalogExerciseFamily;
  exercises: CatalogExercise[];
};

export type CatalogPillarGroup = {
  pillarId: number;
  pillarCode: string;
  pillarLabel: string;
  totalCount: number;
  families: CatalogFamilyGroup[];
};

const pillarOrder = [
  "warm-up",
  "cardio",
  "strength",
  "proprioception",
  "flexibility",
] as const;

export function groupExercises(
  exercises: CatalogExercise[],
  selectedFamilyId?: number,
): CatalogPillarGroup[] {
  const exercisesByPillar = new Map<
    number,
    {
      pillarCode: string;
      pillarLabel: string;
      families: Map<
        number,
        { family: CatalogExerciseFamily; exercises: CatalogExercise[] }
      >;
    }
  >();

  for (const exercise of exercises) {
    const family =
      selectedFamilyId &&
      exercise.families.find((candidate) => candidate.id === selectedFamilyId)
        ? exercise.families.find(
            (candidate) => candidate.id === selectedFamilyId,
          )
        : exercise.families[0];

    if (!family) {
      continue;
    }

    const pillarGroup = exercisesByPillar.get(exercise.pillarId) ?? {
      pillarCode: exercise.pillarCode,
      pillarLabel: exercise.pillarLabel,
      families: new Map<
        number,
        { family: CatalogExerciseFamily; exercises: CatalogExercise[] }
      >(),
    };
    const familyGroup = pillarGroup.families.get(family.id) ?? {
      family,
      exercises: [],
    };

    familyGroup.exercises.push(exercise);
    pillarGroup.families.set(family.id, familyGroup);
    exercisesByPillar.set(exercise.pillarId, pillarGroup);
  }

  return Array.from(exercisesByPillar.entries())
    .sort(([, leftGroup], [, rightGroup]) =>
      compareByKnownPillarOrder(leftGroup.pillarCode, rightGroup.pillarCode),
    )
    .map(([pillarId, pillarGroup]) => {
      const familyGroups = Array.from(pillarGroup.families.values())
        .sort((left, right) =>
          left.family.label.localeCompare(right.family.label, "fr"),
        )
        .map((familyGroup) => ({
          family: familyGroup.family,
          exercises: [...familyGroup.exercises].sort(compareExercises),
        }));

      return {
        pillarId,
        pillarCode: pillarGroup.pillarCode,
        pillarLabel: pillarGroup.pillarLabel,
        families: familyGroups,
        totalCount: familyGroups.reduce(
          (count, familyGroup) => count + familyGroup.exercises.length,
          0,
        ),
      };
    });
}

export function compareExercises(left: CatalogExercise, right: CatalogExercise) {
  return (
    left.levelMin - right.levelMin ||
    left.levelMax - right.levelMax ||
    left.name.localeCompare(right.name, "fr")
  );
}

export function compareByKnownPillarOrder(left: string, right: string) {
  const leftIndex = pillarOrder.indexOf(left as (typeof pillarOrder)[number]);
  const rightIndex = pillarOrder.indexOf(right as (typeof pillarOrder)[number]);

  if (leftIndex !== -1 || rightIndex !== -1) {
    if (leftIndex === -1) {
      return 1;
    }

    if (rightIndex === -1) {
      return -1;
    }

    return leftIndex - rightIndex;
  }

  return left.localeCompare(right, "fr");
}

export function exerciseLevelLabel(exercise: CatalogExercise) {
  if (exercise.programmingStatus !== "eligible") {
    return "Niveau à évaluer";
  }

  return exercise.levelMin === exercise.levelMax
    ? `Niveau ${exercise.levelMin}`
    : `Niveaux ${exercise.levelMin}-${exercise.levelMax}`;
}

export function impactLabel(impact: string) {
  if (impact === "modere") {
    return "modéré";
  }

  if (impact === "eleve") {
    return "élevé";
  }

  return impact.charAt(0).toUpperCase() + impact.slice(1);
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

export function impactBadgeVariant(impact: string) {
  if (impact === "faible") {
    return "success";
  }

  if (impact === "modere") {
    return "warning";
  }

  if (impact === "eleve") {
    return "danger";
  }

  return "muted";
}

export function errorMessageFromUnknown(error: unknown) {
  if (error instanceof Error && error.message.trim()) {
    return error.message;
  }

  return "Impossible de charger la bibliothèque.";
}
