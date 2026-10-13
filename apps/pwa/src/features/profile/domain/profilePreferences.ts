import type {
  ACREAImpact,
  ACREAObjectiveCode,
  ACREAProfileState,
} from "@features/programming";
export const weekdayOptions = [
  [1, "Lun"],
  [2, "Mar"],
  [3, "Mer"],
  [4, "Jeu"],
  [5, "Ven"],
  [6, "Sam"],
  [7, "Dim"],
] as const;
export const objectiveOptions: [ACREAObjectiveCode, string, string][] = [
  ["complete", "Complet", "Développer une condition physique équilibrée."],
  ["strength", "Renforcement", "Donner la priorité au renforcement."],
  ["cardio", "Cardio", "Développer l'endurance cardio-respiratoire."],
  [
    "proprioception",
    "Proprioception",
    "Développer le contrôle et la stabilité.",
  ],
];
export const muscleGroupOptions = [
  ["bras", "Bras"],
  ["epaules", "Épaules"],
  ["dos", "Dos"],
  ["jambes", "Jambes"],
  ["fessiers", "Fessiers"],
  ["abdos", "Abdos"],
  ["pecs", "Pectoraux"],
] as const;

export function formatDate(value: string) {
  if (!value) return "prochain jour préféré";
  return new Intl.DateTimeFormat("fr-FR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(new Date(`${value}T12:00:00`));
}

export function errorMessage(error: unknown) {
  return error instanceof Error
    ? error.message
    : "La régénération du programme a échoué.";
}

export function toggleValue<T>(values: T[], value: T) {
  return values.includes(value)
    ? values.filter((item) => item !== value)
    : [...values, value];
}

export function impactLimit(profile: ACREAProfileState) {
  return (
    profile.restrictions.find((item) => item.type === "impactLimit")
      ?.maximumImpact ?? null
  );
}

export function setImpactLimit(
  profile: ACREAProfileState,
  maximumImpact: ACREAImpact,
): ACREAProfileState {
  return {
    ...profile,
    restrictions: [
      ...profile.restrictions.filter((item) => item.type !== "impactLimit"),
      { type: "impactLimit", maximumImpact },
    ],
  };
}

export function temporaryPain(profile: ACREAProfileState) {
  return (
    profile.restrictions.find((item) => item.type === "temporaryPain")
      ?.muscleGroupCodes ?? []
  );
}

export function setTemporaryPain(
  profile: ACREAProfileState,
  muscleGroupCode: string,
): ACREAProfileState {
  const next = toggleValue(temporaryPain(profile), muscleGroupCode);
  return {
    ...profile,
    restrictions: [
      ...profile.restrictions.filter((item) => item.type !== "temporaryPain"),
      ...(next.length === 0
        ? []
        : [{ type: "temporaryPain" as const, muscleGroupCodes: next }]),
    ],
  };
}

export function restrictionLabel(restriction: ACREAProfileState["restrictions"][number]) {
  switch (restriction.type) {
    case "impactLimit":
      return `impact ${restriction.maximumImpact} maximum`;
    case "exerciseExclusion":
      return `exercice ${restriction.exerciseCode} exclu`;
    case "pillarLimit":
      return `${restriction.pillar} limité au niveau ${restriction.maximumLevel}`;
    case "equipmentExclusion":
      return `matériel ${restriction.equipmentCode} exclu`;
    case "temporaryPain":
      return `douleur temporaire ${restriction.muscleGroupCodes.join(", ")}`;
  }
}
