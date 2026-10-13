import type {
  CatalogExerciseMediaSeed,
  CatalogExerciseSeed,
  CatalogReleaseSeed,
} from "../types";

/**
 * This is the only exercise content that ships in the application bundle.
 * The rest of the library is delivered through the progressive catalog RPCs.
 */
export const exerciseLibraryReleaseCode = "exercise-library-v2";
export const exerciseLibraryRevision = "54d959ad25ff4ebc";
export const exerciseLibraryExerciseCount = 6;

const updatedAt = "2026-08-12T00:00:00.000Z";

export function exerciseLibrarySourceKey(slug: string) {
  return `${exerciseLibraryReleaseCode}:${slug}`;
}

function media(
  pillar: string,
  slug: string,
  posterSha256: string,
  animationSha256: string,
  animationFrameCount: number,
): readonly CatalogExerciseMediaSeed[] {
  const baseUri = `library/${exerciseLibraryRevision}/${pillar}/no-equipment/${slug}`;
  return [
    {
      kind: "poster",
      uri: `${baseUri}/${slug}-poster.webp`,
      fileName: `${slug}-poster.webp`,
      mimeType: "image/webp",
      width: 360,
      height: 360,
      frameCount: 1,
      loopCount: null,
      sha256: posterSha256,
      status: "ready",
      updatedAt,
    },
    {
      kind: "animation",
      uri: `${baseUri}/${slug}-animate.webp`,
      fileName: `${slug}-animate.webp`,
      mimeType: "image/webp",
      width: 360,
      height: 360,
      frameCount: animationFrameCount,
      loopCount: 0,
      sha256: animationSha256,
      status: "ready",
      updatedAt,
    },
  ];
}

function coreExercise(input: {
  slug: string;
  label: string;
  pillar: "strength" | "cardio" | "proprioception";
  type: "force" | "cardio";
  difficulty: number;
  impact: "modere" | "eleve";
  muscles: readonly string[];
  description: string;
  adaptedVersion: string;
  media: readonly CatalogExerciseMediaSeed[];
}): CatalogExerciseSeed {
  return {
    slug: input.slug,
    sourceKey: exerciseLibrarySourceKey(input.slug),
    labelFr: input.label,
    labelEn: input.label,
    categorySlug: input.pillar,
    equipmentSlug: "no-equipment",
    code: input.slug,
    label: input.label,
    pillarCode: input.pillar,
    difficulty: input.difficulty,
    impactCode: input.impact,
    familyCode: "corps-entier",
    typeCode: input.type,
    equipmentCode: "no-equipment",
    regressionExerciseCode: null,
    progressionExerciseCode: null,
    movementDescription: input.description,
    startPosition: "Installez-vous sur une surface stable et conservez une posture contrôlée.",
    outboundExecution: "Réalisez chaque répétition avec amplitude, contrôle et respiration continue.",
    returnExecution: "Revenez à la position initiale avant de démarrer la répétition suivante.",
    adaptedVersion: input.adaptedVersion,
    tips: "La qualité du mouvement prime sur le nombre de répétitions.",
    errors: "Arrêtez en cas de douleur aiguë ou de perte de contrôle technique.",
    muscleGroupCodes: input.muscles,
    releaseCode: exerciseLibraryReleaseCode,
    sourceCategory: input.pillar,
    sourceLanguage: "fr",
    locale: "fr",
    isActive: true,
    reviewStatus: "valide",
    translationStatus: "validated",
    programmingStatus: "eligible",
    archivedAt: null,
    media: input.media,
  };
}

export const exerciseLibraryCoreExerciseSeeds: readonly CatalogExerciseSeed[] = [
  coreExercise({
    slug: "push-up",
    label: "Pompe",
    pillar: "strength",
    type: "force",
    difficulty: 7,
    impact: "modere",
    muscles: ["abdos", "bras", "dos", "epaules", "fessiers", "jambes", "pecs"],
    description: "Poussée horizontale au poids du corps depuis une planche haute stable.",
    adaptedVersion: "Utilisez une variante inclinée ou sur les genoux si nécessaire.",
    media: media("strength", "push-up", "5d4d7094ae5a0c470f8eec6869a3ced8f55fb3b8b76f18debcbb8a1920dd61da", "0c09953f530a7864ca95f766f7d0bc301824d14c6f3bcf806a2363efc2b6f632", 12),
  }),
  coreExercise({
    slug: "air-squat",
    label: "Air Squat",
    pillar: "strength",
    type: "force",
    difficulty: 5,
    impact: "eleve",
    muscles: ["abdos", "dos", "epaules", "fessiers", "jambes", "pecs"],
    description: "Squat fondamental au poids du corps, avec appuis stables et genoux dans l’axe.",
    adaptedVersion: "Réduisez l’amplitude ou utilisez un appui stable si nécessaire.",
    media: media("strength", "air-squat", "92bd3cba493c6ee533ad0367fb141bc4869d7b6eb97a1612709bf23fcc08cc83", "e01a2f6f885746ad4878950c77140de81c8088736547b04c9c40e5ab36ed4340", 12),
  }),
  coreExercise({
    slug: "burpee",
    label: "Burpee",
    pillar: "cardio",
    type: "cardio",
    difficulty: 7,
    impact: "eleve",
    muscles: ["abdos", "bras", "dos", "epaules", "fessiers", "jambes", "pecs"],
    description: "Enchaînement cardio corps entier, adapté au protocole ACREA sans pompe.",
    adaptedVersion: "Marchez les pieds en arrière et supprimez le saut pour réduire l’impact.",
    media: media("cardio", "burpee", "a9fede02e1366f6c8edec05051abc9d321a8f3088ecd661de7f9b59fa5cbc8e1", "8ad1cd7144a12febb5176a9fc70d618e6449d2e017d161d0d013be1495ef028e", 8),
  }),
  coreExercise({
    slug: "mountain-climber",
    label: "Mountain Climber",
    pillar: "cardio",
    type: "cardio",
    difficulty: 6,
    impact: "eleve",
    muscles: ["abdos", "dos", "epaules", "fessiers", "jambes", "pecs"],
    description: "Alternance des genoux en planche haute, avec tronc stable et cadence contrôlée.",
    adaptedVersion: "Réduisez la cadence ou alternez les pieds sans saut.",
    media: media("cardio", "mountain-climber", "fd1a4ab00c41dce401a0bfc2a32cd1b1bbda4be8138393cc7a0c7d0c5f9f08fc", "1b52d7eb7da14f1847a7da29c73616ea136b63fc64aadebe39f592566c7c8589", 6),
  }),
  coreExercise({
    slug: "lying-leg-raise",
    label: "Relevé de jambes au sol",
    pillar: "proprioception",
    type: "force",
    difficulty: 4,
    impact: "modere",
    muscles: ["abdos", "bras", "dos", "fessiers", "jambes"],
    description: "Relèvement contrôlé des jambes allongé, sans décoller le bas du dos.",
    adaptedVersion: "Fléchissez légèrement les genoux ou réduisez l’amplitude.",
    media: media("proprioception", "lying-leg-raise", "cd4549b6bb1ba954413f09bb560da3f4e1773bed4664de90272c30b3c5dd1553", "db4c8b8d235da339b7476bc156281c55cf491831cc3f10193b32bffe093a2c9d", 2),
  }),
  coreExercise({
    slug: "lean-planche",
    label: "Lean Planche",
    pillar: "proprioception",
    type: "force",
    difficulty: 8,
    impact: "modere",
    muscles: ["abdos", "bras", "dos", "epaules", "fessiers", "jambes", "pecs"],
    description: "Inclinaison contrôlée vers l’avant depuis une planche haute, bras tendus.",
    adaptedVersion: "Réduisez l’inclinaison et gardez les épaules au-dessus des poignets.",
    media: media("proprioception", "lean-planche", "f7203d9145df2d7f1fc503dfe8a25482b0d79f4db7b2eaa116f9318dded0541a", "441e663f905266db5bdba8a32e102d324b9453234b45cadaf8f1ea41c565a2d9", 8),
  }),
];

export const exerciseLibraryCoreReleaseSeeds: readonly CatalogReleaseSeed[] = [
  {
    code: exerciseLibraryReleaseCode,
    source: "docs/bibliotheque",
    sourceRevision: exerciseLibraryRevision,
    locale: "fr",
    expectedExerciseCount: exerciseLibraryExerciseCount,
    status: "active",
    licenseId: null,
    activationBackupReference: null,
    activationDiffReference: null,
    createdAt: updatedAt,
    activatedAt: updatedAt,
    archivedAt: null,
    updatedAt,
  },
];
