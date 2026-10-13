import {
  localCatalogProgrammingPort,
  type CatalogEquipmentOption,
  type CatalogExercise,
  type CatalogFormat,
  type CatalogProgrammingPort,
  type CatalogProgrammingSnapshot,
} from "@features/catalog/programming";

import type {
  ACREAPillar,
  ACREAPrescriptionKind,
  ACREASessionPrescription,
  ACREASessionPhase,
} from "../data/acreaSeed";

export type WeeklyProgramCandidateAlternative = {
  exerciseName: string;
  level: number;
};

export type WeeklyProgramCandidate = {
  sessionTemplateId: number;
  exerciseId: number;
  exerciseCode: string;
  exerciseName: string;
  formatId: number;
  formatCode: string;
  formatLabel: string;
  pillar: ACREAPillar;
  phase: ACREASessionPhase;
  prescriptionKind: ACREAPrescriptionKind;
  level: number;
  durationSeconds: number;
  completeExerciseSheet: boolean;
  equipmentOptions: CatalogEquipmentOption[];
  muscleGroupCodes: string[];
  impactCode: string;
  regression: WeeklyProgramCandidateAlternative | null;
  progression: WeeklyProgramCandidateAlternative | null;
};

export async function listWeeklyProgramCandidates(): Promise<
  WeeklyProgramCandidate[]
> {
  const snapshot = await localCatalogProgrammingPort.loadSnapshot();

  return buildCandidates(snapshot);
}

export async function getWeeklyProgramCandidateSnapshot(
  catalog: CatalogProgrammingPort = localCatalogProgrammingPort,
) {
  // The compact index is fetched on the first generation request, never at
  // application bootstrap.  Existing full caches are recognized as ready.
  if (catalog === localCatalogProgrammingPort) {
    const { ensureCatalogLibraryIndex } = await import(
      "@features/catalog/services/catalogRepository"
    );
    await ensureCatalogLibraryIndex();
  }
  const snapshot = await catalog.loadSnapshot();
  const candidates = buildCandidates(snapshot);
  const latestUpdate =
    [
      ...snapshot.exercises.map((exercise) => exercise.updatedAt),
      ...snapshot.exercises.flatMap((exercise) =>
        exercise.media.map((media) => media.updatedAt),
      ),
      ...snapshot.formats.map((format) => format.updatedAt),
      ...snapshot.sessionTemplates.map((template) => template.updatedAt),
    ]
      .sort()
      .at(-1) ?? "seed";
  const completeExerciseSheetCount = candidates.filter(
    (candidate) => candidate.completeExerciseSheet,
  ).length;

  return {
    candidates,
    catalogVersion: `${latestUpdate}:${candidates.length}:complete-${completeExerciseSheetCount}`,
    formats: snapshot.formats,
  };
}

export function resolveCatalogFormatForPrescription(
  formats: CatalogFormat[],
  prescription: ACREASessionPrescription,
) {
  const expectedType = prescription.kind === "repetitions" ? "repetitions" : "intervalles";
  const expectedRest = prescription.kind === "fixed" ? 30 : prescription.restSeconds;
  const match = formats.find((format) =>
    format.sourceStatus === "seed base formats metier" &&
    format.formatType === expectedType &&
    format.seriesCount === prescription.series &&
    format.restSeconds === expectedRest &&
    (prescription.kind === "repetitions"
      ? format.repetitions === prescription.repetitions
      : format.intervalSeconds === prescription.effortSeconds),
  );
  if (!match) {
    throw new Error(
      `Format catalogue absent pour ${prescription.kind}:${prescription.series}:${prescription.repetitions ?? prescription.effortSeconds}:${expectedRest}.`,
    );
  }
  return match;
}

function buildCandidates(
  snapshot: CatalogProgrammingSnapshot,
) {
  const exercisesById = new Map(
    snapshot.exercises.map((exercise) => [exercise.id, exercise]),
  );
  const candidates = new Map<string, WeeklyProgramCandidate>();

  for (const session of snapshot.sessionTemplates) {
    if (!session.isActive) {
      continue;
    }

    const exercise = exercisesById.get(session.exerciseId);
    if (
      !exercise ||
      !exercise.isActive ||
      exercise.releaseStatus !== "active" ||
      exercise.programmingStatus !== "eligible" ||
      !isACREAPillar(exercise.pillarCode)
    ) {
      continue;
    }

    for (const level of session.levels) {
      const format = selectCompatibleFormat(exercise, snapshot.formats, level);
      if (!format) {
        continue;
      }
      const candidate = toCandidate(
        session.id,
        level,
        exercise,
        format,
        exercisesById,
        session.phase,
      );
      candidates.set(candidateKey(candidate), candidate);
    }
  }

  return Array.from(candidates.values()).sort(compareCandidatePriority);
}

function toCandidate(
  sessionTemplateId: number,
  level: number,
  exercise: CatalogExercise,
  format: CatalogFormat,
  exercisesById: Map<number, CatalogExercise>,
  phase: ACREASessionPhase,
): WeeklyProgramCandidate {
  return {
    sessionTemplateId,
    exerciseId: exercise.id,
    exerciseCode: exercise.code,
    exerciseName: exercise.name,
    formatId: format.id,
    formatCode: format.code,
    formatLabel: format.label,
    pillar: exercise.pillarCode as ACREAPillar,
    phase,
    prescriptionKind:
      phase === "main"
        ? format.formatType === "intervalles"
          ? "intervals"
          : "repetitions"
        : "fixed",
    level,
    durationSeconds: estimateFormatDurationSeconds(format),
    completeExerciseSheet: hasCompleteExerciseSheet(exercise),
    equipmentOptions: exercise.equipmentOptions,
    muscleGroupCodes: exercise.muscleGroups.map((group) => group.code),
    impactCode: exercise.impactCode,
    regression: resolveAlternative(
      exercise.regressionExerciseId,
      exercisesById,
    ),
    progression: resolveAlternative(
      exercise.progressionExerciseId,
      exercisesById,
    ),
  };
}

/**
 * A complete sheet is an editorially approved, programming-eligible exercise
 * with every instruction required by the weekly program and an integrity-
 * checked poster/looping animation pair. This is only a ranking signal: the
 * eligibility gate in buildCandidates remains authoritative.
 */
export function hasCompleteExerciseSheet(exercise: CatalogExercise) {
  if (
    !exercise.isActive ||
    exercise.releaseStatus !== "active" ||
    exercise.reviewStatus !== "valide" ||
    exercise.translationStatus !== "validated" ||
    exercise.programmingStatus !== "eligible" ||
    exercise.locale !== "fr" ||
    !Number.isInteger(exercise.difficulty) ||
    exercise.difficulty < 1 ||
    exercise.difficulty > 10 ||
    exercise.equipmentOptions.length === 0 ||
    exercise.muscleGroups.length === 0
  ) {
    return false;
  }

  const requiredTexts = [
    exercise.name,
    exercise.pillarCode,
    exercise.impactCode,
    exercise.family.code,
    exercise.type.code,
    exercise.movementDescription,
    exercise.startPosition,
    exercise.outboundExecution,
    exercise.returnExecution,
    exercise.adaptedVersion,
    exercise.tips,
    exercise.errors,
  ];
  if (requiredTexts.some((value) => value.trim().length === 0)) {
    return false;
  }

  const poster = exercise.media.find(isReadyProgrammingPoster);
  const animation = exercise.media.find(isReadyProgrammingAnimation);
  if (!poster || !animation) {
    return false;
  }

  return (
    poster.fileName.slice(0, -"-poster.webp".length) ===
    animation.fileName.slice(0, -"-animate.webp".length)
  );
}

function isTraceableHttpsUrl(value: string) {
  try {
    const url = new URL(value);
    return (
      url.protocol === "https:" &&
      url.hostname.length > 0 &&
      url.username.length === 0 &&
      url.password.length === 0
    );
  } catch {
    return false;
  }
}

function compareCandidatePriority(
  left: WeeklyProgramCandidate,
  right: WeeklyProgramCandidate,
) {
  return (
    Number(right.completeExerciseSheet) - Number(left.completeExerciseSheet) ||
    left.sessionTemplateId - right.sessionTemplateId ||
    left.exerciseId - right.exerciseId ||
    left.formatId - right.formatId ||
    left.level - right.level
  );
}

function isReadyProgrammingPoster(media: CatalogExercise["media"][number]) {
  return (
    media.kind === "poster" &&
    media.status === "ready" &&
    media.mimeType === "image/webp" &&
    /^[a-z0-9]+(?:-[a-z0-9]+)*-poster\.webp$/.test(media.fileName) &&
    media.width === 360 &&
    media.height === 360 &&
    media.frameCount === 1 &&
    hasMediaIntegrity(media.sha256, media.uri, media.fileName)
  );
}

function isReadyProgrammingAnimation(
  media: CatalogExercise["media"][number],
) {
  return (
    media.kind === "animation" &&
    media.status === "ready" &&
    media.mimeType === "image/webp" &&
    /^[a-z0-9]+(?:-[a-z0-9]+)*\.webp$/.test(media.fileName) &&
    media.width === 360 &&
    media.height === 360 &&
    media.frameCount >= 2 &&
    media.loopCount === 0 &&
    hasMediaIntegrity(media.sha256, media.uri, media.fileName)
  );
}

function hasMediaIntegrity(
  sha256: string | null,
  uri: string,
  fileName: string,
) {
  if (!/^[a-f0-9]{64}$/.test(sha256 ?? "")) {
    return false;
  }

  const uriWithoutQuery = uri.split(/[?#]/, 1)[0];
  return (
    uriWithoutQuery === fileName || uriWithoutQuery.endsWith(`/${fileName}`)
  );
}

function selectCompatibleFormat(
  exercise: CatalogExercise,
  formats: CatalogFormat[],
  level: number,
) {
  const compatibleFormats = formats.filter((format) => {
    if (format.sourceStatus !== "seed base formats metier") {
      return false;
    }
    if (
      exercise.pillarCode === "cardio" ||
      exercise.pillarCode === "proprioception"
    ) {
      return format.formatType === "intervalles";
    }

    return format.formatType === "repetitions" && format.repetitions !== null;
  });

  let bestFormat: CatalogFormat | null = null;
  let bestScore = Number.POSITIVE_INFINITY;
  for (const format of compatibleFormats) {
    const score = formatCompatibilityScore(exercise, format, level);
    if (score < bestScore) {
      bestFormat = format;
      bestScore = score;
    }
  }

  return bestFormat;
}

function formatCompatibilityScore(
  exercise: CatalogExercise,
  format: CatalogFormat,
  level: number,
) {
  const advanced = level >= 5;
  const targetSeries = advanced ? 4 : 3;
  const targetExecutions = advanced ? 5 : 8;
  const targetRest = advanced ? 120 : 90;
  const targetDuration =
    exercise.pillarCode === "cardio"
      ? level <= 3
        ? 360
        : 480
      : 360;
  const targetIntervalSeconds = 60;

  return (
    Math.abs((format.seriesCount ?? 1) - targetSeries) * 30 +
    Math.abs((format.repetitions ?? targetExecutions) - targetExecutions) * 4 +
    Math.abs(format.restSeconds - targetRest) / 3 +
    Math.abs(estimateFormatDurationSeconds(format) - targetDuration) / 10 +
    (format.formatType === "intervalles"
      ? Math.abs((format.intervalSeconds ?? targetIntervalSeconds) - targetIntervalSeconds) * 4
      : 0)
  );
}

function candidateKey(candidate: WeeklyProgramCandidate) {
  // A single exercise can deliberately back several templates (warmup, main
  // and cooldown). The template identity is therefore part of the candidate
  // identity; otherwise the last phase read from SQLite silently replaces the
  // preceding ones.
  return `${candidate.sessionTemplateId}:${candidate.exerciseId}:${candidate.formatId}:${candidate.level}`;
}

function resolveAlternative(
  exerciseId: number | null,
  exercisesById: Map<number, CatalogExercise>,
): WeeklyProgramCandidateAlternative | null {
  if (exerciseId === null) {
    return null;
  }

  const exercise = exercisesById.get(exerciseId);
  if (!exercise) {
    return null;
  }

  return {
    exerciseName: exercise.name,
    level: exercise.difficulty,
  };
}

function estimateFormatDurationSeconds(format: CatalogFormat) {
  if (format.formatType === "intervalles") {
    const effortSeconds = format.seriesCount * (format.intervalSeconds ?? 60);
    const restSeconds =
      Math.max(0, format.seriesCount - 1) * format.restSeconds;

    return clampDuration(effortSeconds + restSeconds);
  }

  const seriesCount = format.seriesCount;
  const executionCount = format.repetitions ?? 1;
  const effortSeconds = seriesCount * executionCount * 4;
  const restSeconds = Math.max(0, seriesCount - 1) * format.restSeconds;

  return clampDuration(effortSeconds + restSeconds);
}

function clampDuration(value: number) {
  return Math.max(30, Math.min(65_535, Math.round(value)));
}

function isACREAPillar(value: string): value is ACREAPillar {
  return (
    value === "strength" || value === "cardio" || value === "proprioception"
  );
}
