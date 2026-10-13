// @vitest-environment node

import { describe, expect, it, vi } from "vitest";

import type {
  CatalogExercise,
  CatalogProgrammingPort,
  CatalogProgrammingSnapshot,
} from "@features/catalog/programming";

vi.mock("@features/catalog/programming", () => ({
  localCatalogProgrammingPort: {
    loadSnapshot: async () => ({
      exercises: [],
      formats: [],
      sessionTemplates: [],
    }),
  },
}));

import {
  getWeeklyProgramCandidateSnapshot,
  hasCompleteExerciseSheet,
} from "./catalogProgrammingCandidates";

describe("weekly programming candidate completeness", () => {
  it("ranks complete eligible sheets first without admitting ineligible sheets", async () => {
    const incompleteEligible = exercise({ id: 1, media: [] });
    const completeEligible = exercise({ id: 2 });
    const completeIneligible = exercise({
      id: 3,
      programmingStatus: "library_only",
    });
    const catalog = port(
      snapshot(
        [incompleteEligible, completeEligible, completeIneligible],
        [
          session(10, incompleteEligible),
          session(20, completeEligible),
          session(5, completeIneligible),
        ],
      ),
    );

    const result = await getWeeklyProgramCandidateSnapshot(catalog);

    expect(
      result.candidates.map((candidate) => ({
        code: candidate.exerciseCode,
        complete: candidate.completeExerciseSheet,
      })),
    ).toEqual([
      { code: "exercise-2", complete: true },
      { code: "exercise-1", complete: false },
    ]);
    expect(result.catalogVersion).toBe(
      "2026-02-01T00:00:00.000Z:2:complete-1",
    );
  });

  it("requires approved French texts plus an integrity-checked poster and looping animation", () => {
    const complete = exercise({ id: 1 });

    expect(hasCompleteExerciseSheet(complete)).toBe(true);
    expect(
      hasCompleteExerciseSheet({
        ...complete,
        reviewStatus: "a_verifier",
      }),
    ).toBe(false);
    expect(
      hasCompleteExerciseSheet({
        ...complete,
        locale: "en",
      }),
    ).toBe(false);
    expect(
      hasCompleteExerciseSheet({
        ...complete,
        startPosition: "   ",
      }),
    ).toBe(false);
    expect(
      hasCompleteExerciseSheet({
        ...complete,
        media: complete.media.map((media) =>
          media.kind === "animation" ? { ...media, loopCount: 1 } : media,
        ),
      }),
    ).toBe(false);
  });
});

function port(snapshotValue: CatalogProgrammingSnapshot): CatalogProgrammingPort {
  return {
    loadSnapshot: async () => snapshotValue,
  };
}

function snapshot(
  exercises: CatalogExercise[],
  sessionTemplates: CatalogProgrammingSnapshot["sessionTemplates"],
): CatalogProgrammingSnapshot {
  return {
    exercises,
    formats: [
      {
        id: 1,
        code: "series-3-repetitions-8-rest-90",
        formatType: "repetitions",
        seriesId: 1,
        seriesCode: "series-3",
        seriesCount: 3,
        repetitionsId: 1,
        repetitionsCode: "repetitions-8",
        repetitions: 8,
        restId: 1,
        restCode: "rest-90",
        restSeconds: 90,
        intervalId: null,
        intervalCode: null,
        intervalSeconds: null,
        label: "3 x 8, repos 90 s",
        description: "Format de test",
        sourceStatus: "seed base formats metier",
        updatedAt: "2026-01-01T00:00:00.000Z",
      },
    ],
    sessionTemplates,
  };
}

function session(
  id: number,
  linkedExercise: CatalogExercise,
): CatalogProgrammingSnapshot["sessionTemplates"][number] {
  return {
    id,
    code: `session-${id}`,
    title: `Session ${id}`,
    description: "Session de test",
    exerciseId: linkedExercise.id,
    exerciseCode: linkedExercise.code,
    exerciseLabel: linkedExercise.label,
    pillarId: linkedExercise.pillarId,
    pillarCode: linkedExercise.pillarCode,
    pillarLabel: linkedExercise.pillarLabel,
    familyId: linkedExercise.family.id,
    familyCode: linkedExercise.family.code,
    familyLabel: linkedExercise.family.label,
    phase: "main",
    levels: [2],
    isActive: true,
    sourceStatus: "test",
    updatedAt: "2026-01-01T00:00:00.000Z",
  };
}

function exercise({
  id,
  media,
  programmingStatus = "eligible",
}: {
  id: number;
  media?: CatalogExercise["media"];
  programmingStatus?: CatalogExercise["programmingStatus"];
}): CatalogExercise {
  const slug = `exercise-${id}`;
  const resolvedMedia = media ?? [poster(id, slug), animation(id, slug)];

  return {
    id,
    slug,
    sourceKey: `test-release:${slug}`,
    labelFr: `Exercice ${id}`,
    labelEn: `Exercise ${id}`,
    categorySlug: "strength",
    code: slug,
    label: `Exercice ${id}`,
    name: `Exercice ${id}`,
    pillarId: 1,
    pillarCode: "strength",
    pillarLabel: "Renforcement",
    difficulty: 2,
    levelMin: 2,
    levelMax: 2,
    impactId: 1,
    impactCode: "faible",
    impactLabel: "Faible",
    impact: "faible",
    family: { id: 1, code: "haut-du-corps", label: "Haut du corps" },
    families: [
      { id: 1, code: "haut-du-corps", label: "Haut du corps" },
    ],
    type: { id: 1, code: "force", label: "Force" },
    muscleGroups: [{ id: 1, code: "pecs", label: "Pectoraux" }],
    equipmentId: null,
    equipmentCode: "no-equipment",
    equipmentLabel: "Sans matériel",
    equipment: "Sans matériel",
    equipmentOptions: [{ kind: "bodyweight", equipmentCodes: [] }],
    regressionExerciseId: null,
    regressionExerciseCode: null,
    regression: null,
    progressionExerciseId: null,
    progressionExerciseCode: null,
    progression: "",
    movementDescription: "Renforce le haut du corps avec contrôle.",
    description: "Renforce le haut du corps avec contrôle.",
    startPosition: "Placez les mains sous les épaules.",
    outboundExecution: "Descendez avec contrôle.",
    returnExecution: "Repoussez jusqu'à la position initiale.",
    adaptedVersion: "Réduisez l'amplitude si nécessaire.",
    tips: "Gardez le tronc gainé.",
    errors: "Ne cambrez pas le dos.",
    startPositionSteps: ["Placez les mains sous les épaules."],
    outboundExecutionSteps: ["Descendez avec contrôle."],
    returnExecutionSteps: ["Repoussez jusqu'à la position initiale."],
    positionSteps: ["Placez les mains sous les épaules."],
    executionSteps: [
      "Descendez avec contrôle.",
      "Repoussez jusqu'à la position initiale.",
    ],
    commonErrors: ["Ne cambrez pas le dos."],
    releaseId: 1,
    releaseCode: "catalog-active",
    releaseStatus: "active",
    sourceCategory: "strength",
    sourceLanguage: "en",
    locale: "fr",
    isActive: true,
    reviewStatus: "valide",
    translationStatus: "validated",
    programmingStatus,
    archivedAt: null,
    adminOverriddenAt: null,
    media: resolvedMedia,
    sourceStatus: "test",
    updatedAt: "2026-01-01T00:00:00.000Z",
  };
}

function poster(exerciseId: number, slug: string): CatalogExercise["media"][number] {
  return {
    id: exerciseId * 10,
    exerciseId,
    kind: "poster",
    uri: `docs/bibliotheque/strength/no-equipment/${slug}/${slug}-poster.webp`,
    fileName: `${slug}-poster.webp`,
    mimeType: "image/webp",
    width: 360,
    height: 360,
    frameCount: 1,
    loopCount: null,
    sha256: "a".repeat(64),
    status: "ready",
    updatedAt: "2026-02-01T00:00:00.000Z",
  };
}

function animation(
  exerciseId: number,
  slug: string,
): CatalogExercise["media"][number] {
  return {
    id: exerciseId * 10 + 1,
    exerciseId,
    kind: "animation",
    uri: `docs/bibliotheque/strength/no-equipment/${slug}/${slug}-animate.webp`,
    fileName: `${slug}-animate.webp`,
    mimeType: "image/webp",
    width: 360,
    height: 360,
    frameCount: 24,
    loopCount: 0,
    sha256: "b".repeat(64),
    status: "ready",
    updatedAt: "2026-02-01T00:00:00.000Z",
  };
}
