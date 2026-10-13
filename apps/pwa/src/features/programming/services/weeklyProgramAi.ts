import { localTrainingHistoryPort } from "@features/training/history";

import type { ACREAProfile, ACREAWeekPlan } from "../data/acreaSeed";
import {
  getWeeklyProgramCandidateSnapshot,
  resolveCatalogFormatForPrescription,
} from "./catalogProgrammingCandidates";
import { loadWeeklyProgramExerciseState } from "./exerciseProgressionRepository";
import { generateWithWeeklyAiRuntime } from "./weeklyAiRuntime";
import {
  buildWeeklyProgramAiInput,
  getIsoWeek,
  type IsoWeek,
} from "./weeklyProgramContract";
import {
  loadWeeklyProgramSnapshot,
  loadWeeklyProgramStoredState,
  replaceWeeklyProgramFuture,
  replaceWeeklyProgramSnapshot,
} from "./weeklyProgramRepository";
import {
  computeWeeklyProgramProfileFingerprint,
  buildPartialRegenerationSchedule,
  isoDateForWeekday,
  nextPreferredDateAfter,
  remapTrainingCodes,
  sortTrainingsByScheduledDate,
  weekdayLabel,
} from "./weeklyProgramSchedule";

const operationsByKey = new Map<string, Promise<unknown>>();

export type WeeklyProgramRegenerationState = {
  canRegenerate: boolean;
  effectiveDate: string | null;
  hasProgram: boolean;
  hasProgress: boolean;
  reason: "available" | "profile-unchanged" | "no-preferred-day";
  replaceableTrainingCount: number;
};

export function generateWeeklyProgram(
  profile: ACREAProfile,
): Promise<ACREAWeekPlan> {
  assertLevelTestCompleted(profile);
  const week = getIsoWeek(new Date());
  const generationKey = `${profile.id}:${week.isoWeekYear}:${week.isoWeekNumber}`;
  return runSerialized(generationKey, () =>
    generateOrLoadWeeklyProgram(profile, week),
  );
}

/** Reads the current persisted week without creating or replacing a plan. */
export async function loadCurrentWeeklyProgram(
  profile: ACREAProfile,
): Promise<ACREAWeekPlan | null> {
  const week = getIsoWeek(new Date());
  return loadWeeklyProgramSnapshot(
    profile.id,
    week.isoWeekYear,
    week.isoWeekNumber,
  );
}

export async function getWeeklyProgramRegenerationState(
  profile: ACREAProfile,
  requestedAt: Date,
): Promise<WeeklyProgramRegenerationState> {
  assertLevelTestCompleted(profile);
  const effectiveDate = nextPreferredDateAfter(
    requestedAt,
    profile.preferredWeekdays,
  );
  if (!effectiveDate) {
    return {
      canRegenerate: false,
      effectiveDate: null,
      hasProgram: false,
      hasProgress: false,
      reason: "no-preferred-day",
      replaceableTrainingCount: 0,
    };
  }
  const requestedWeek = getIsoWeek(requestedAt);
  const targetWeek = getIsoWeek(localDateAtNoon(effectiveDate));
  const [currentStored, targetStored, fingerprint] = await Promise.all([
    loadWeeklyProgramStoredState(
      profile.id,
      requestedWeek.isoWeekYear,
      requestedWeek.isoWeekNumber,
    ),
    sameWeek(requestedWeek, targetWeek)
      ? Promise.resolve(null)
      : loadWeeklyProgramStoredState(
          profile.id,
          targetWeek.isoWeekYear,
          targetWeek.isoWeekNumber,
        ),
    computeWeeklyProgramProfileFingerprint(profile),
  ]);
  const stored = targetStored ?? currentStored;
  const replaceableStored =
    targetStored ?? (sameWeek(requestedWeek, targetWeek) ? currentStored : null);
  const replaceable =
    replaceableStored?.trainings.filter(
      (training) =>
        training.scheduledDate >= effectiveDate &&
        training.status !== "terminee" &&
        !training.hasFeedback,
    ) ?? [];
  const unchanged = stored?.profileFingerprint === fingerprint;
  return {
    canRegenerate: !unchanged,
    effectiveDate,
    hasProgram: Boolean(stored),
    hasProgress:
      stored?.trainings.some(
        (training) => training.status !== "a faire" || training.hasFeedback,
      ) ?? false,
    reason: unchanged ? "profile-unchanged" : "available",
    replaceableTrainingCount: replaceable.length,
  };
}

export async function regenerateWeeklyProgram(
  profile: ACREAProfile,
  requestedAt: Date,
): Promise<ACREAWeekPlan> {
  assertLevelTestCompleted(profile);
  const effectiveDate = nextPreferredDateAfter(
    requestedAt,
    profile.preferredWeekdays,
  );
  if (!effectiveDate) {
    throw new Error("Sélectionne au moins un jour préféré avant de régénérer.");
  }
  const targetWeek = getIsoWeek(localDateAtNoon(effectiveDate));
  const key = `${profile.id}:${targetWeek.isoWeekYear}:${targetWeek.isoWeekNumber}`;
  return runSerialized(key, () =>
    regenerate(profile, requestedAt, effectiveDate, targetWeek),
  );
}

function assertLevelTestCompleted(profile: ACREAProfile) {
  if (profile.levelTestStatus !== "completed" || profile.levelTestVersion < 3) {
    throw new Error("L’évaluation de niveau ACREA doit être validée avant de générer le programme.");
  }
}

async function generateOrLoadWeeklyProgram(
  profile: ACREAProfile,
  week: IsoWeek,
): Promise<ACREAWeekPlan> {
  const stored = await loadWeeklyProgramStoredState(
    profile.id,
    week.isoWeekYear,
    week.isoWeekNumber,
  );
  if (
    stored &&
    stored.levelEvaluationVersion < profile.levelTestVersion
  ) {
    const requestedAt = new Date();
    const effectiveDate = nextPreferredDateAfter(
      requestedAt,
      profile.preferredWeekdays,
    );
    if (!effectiveDate) {
      throw new Error("Sélectionne au moins un jour préféré avant de générer.");
    }
    const targetWeek = getIsoWeek(localDateAtNoon(effectiveDate));
    if (!sameWeek(week, targetWeek)) {
      const [targetStored, fingerprint] = await Promise.all([
        loadWeeklyProgramStoredState(
          profile.id,
          targetWeek.isoWeekYear,
          targetWeek.isoWeekNumber,
        ),
        computeWeeklyProgramProfileFingerprint(profile),
      ]);
      if (
        targetStored?.profileFingerprint === fingerprint &&
        targetStored.levelEvaluationVersion >= profile.levelTestVersion
      ) {
        const targetPlan = await loadWeeklyProgramSnapshot(
          profile.id,
          targetWeek.isoWeekYear,
          targetWeek.isoWeekNumber,
        );
        if (targetPlan) return targetPlan;
      }
    }
    return regenerate(
      profile,
      requestedAt,
      effectiveDate,
      targetWeek,
    );
  }
  const persisted = await loadWeeklyProgramSnapshot(
    profile.id,
    week.isoWeekYear,
    week.isoWeekNumber,
  );
  if (persisted) {
    return persisted;
  }

  const [catalog, history, exerciseState] = await Promise.all([
    getWeeklyProgramCandidateSnapshot(),
    localTrainingHistoryPort.loadRecentWeeklyProgramHistory(profile.id),
    loadWeeklyProgramExerciseState(profile.id),
  ]);
  const input = buildWeeklyProgramAiInput({
    profile,
    candidates: catalog.candidates,
    catalogVersion: catalog.catalogVersion,
    recentStats: history.recentStats,
    candidateRecentStats: history.candidateRecentStats,
    exerciseProgressions: exerciseState.exerciseProgressions,
    exerciseHistories: exerciseState.exerciseHistories,
    week,
  });
  const generated = await generateWithWeeklyAiRuntime(input);
  const plan = resolvePlanFormats({
    ...generated,
    trainings: sortTrainingsByScheduledDate(generated.trainings),
  }, catalog.formats);
  await ensurePlanExerciseSheets(plan);
  const fingerprint = await computeWeeklyProgramProfileFingerprint(profile);
  await replaceWeeklyProgramSnapshot(
    profile.id,
    plan,
    fingerprint,
    profile.levelTestVersion,
  );

  return plan;
}

async function regenerate(
  profile: ACREAProfile,
  requestedAt: Date,
  effectiveDate: string,
  targetWeek: IsoWeek,
  depth = 0,
): Promise<ACREAWeekPlan> {
  if (depth > 8) {
    throw new Error("Aucun créneau futur disponible pour régénérer le programme.");
  }
  const fingerprint = await computeWeeklyProgramProfileFingerprint(profile);
  const requestedWeek = getIsoWeek(requestedAt);
  const [currentStored, targetStored] = await Promise.all([
    loadWeeklyProgramStoredState(
      profile.id,
      requestedWeek.isoWeekYear,
      requestedWeek.isoWeekNumber,
    ),
    sameWeek(requestedWeek, targetWeek)
      ? Promise.resolve(null)
      : loadWeeklyProgramStoredState(
          profile.id,
          targetWeek.isoWeekYear,
          targetWeek.isoWeekNumber,
        ),
  ]);
  const stored = targetStored ?? (sameWeek(requestedWeek, targetWeek) ? currentStored : null);
  const referenceStored = stored ?? currentStored;
  if (depth === 0 && referenceStored?.profileFingerprint === fingerprint) {
    throw new Error("Le programme utilise déjà les réglages enregistrés.");
  }

  if (!stored) {
    const { slots } = buildPartialRegenerationSchedule({
      effectiveDate,
      existingTrainings: [],
      preferredWeekdays: profile.preferredWeekdays,
      requestedAt: localDateAtNoon(effectiveDate),
      weeklyFrequency: profile.weeklyFrequency,
    });
    if (slots.length === 0) {
      return regenerateInFollowingWeek(
        profile,
        targetWeek,
        fingerprint,
        depth,
      );
    }
    const plan = await generatePlanForSlots(profile, targetWeek, slots);
    await ensurePlanExerciseSheets(plan);
    await replaceWeeklyProgramSnapshot(
      profile.id,
      plan,
      fingerprint,
      profile.levelTestVersion,
    );
    return plan;
  }

  const { preserved, replaceable, slots } = buildPartialRegenerationSchedule({
    effectiveDate,
    existingTrainings: stored.trainings,
    preferredWeekdays: profile.preferredWeekdays,
    requestedAt: localDateAtNoon(effectiveDate),
    weeklyFrequency: profile.weeklyFrequency,
  });

  const currentPlan = await loadWeeklyProgramSnapshot(
    profile.id,
    targetWeek.isoWeekYear,
    targetWeek.isoWeekNumber,
  );
  if (!currentPlan) throw new Error("Programme courant introuvable.");
  if (slots.length === 0) {
    return regenerateInFollowingWeek(
      profile,
      targetWeek,
      fingerprint,
      depth,
    );
  }
  const generated = await generatePlanForSlots(profile, targetWeek, slots);
  const replacementPlan = {
    ...generated,
    trainings: remapTrainingCodes(
      generated.trainings,
      new Set(preserved.map(({ code }) => code)),
    ),
  };
  await ensurePlanExerciseSheets(replacementPlan);

  await replaceWeeklyProgramFuture({
    expectedReplaceableTrainingIds: replaceable.map(({ id }) => id),
    plan: replacementPlan,
    profileFingerprint: fingerprint,
    profileId: profile.id,
    profileEffectiveFrom: effectiveDate,
    levelEvaluationVersion: profile.levelTestVersion,
  });
  const updated = await loadWeeklyProgramSnapshot(
    profile.id,
    targetWeek.isoWeekYear,
    targetWeek.isoWeekNumber,
  );
  if (!updated) throw new Error("Programme régénéré introuvable.");
  return updated;
}

async function regenerateInFollowingWeek(
  profile: ACREAProfile,
  week: IsoWeek,
  fingerprint: string,
  depth: number,
) {
  const sunday = localDateAtNoon(
    isoDateForWeekday(week.isoWeekYear, week.isoWeekNumber, 7),
  );
  const effectiveDate = nextPreferredDateAfter(
    sunday,
    profile.preferredWeekdays,
  );
  if (!effectiveDate) {
    throw new Error("Sélectionne au moins un jour préféré avant de régénérer.");
  }
  const targetDate = localDateAtNoon(effectiveDate);
  const targetWeek = getIsoWeek(targetDate);
  const stored = await loadWeeklyProgramStoredState(
    profile.id,
    targetWeek.isoWeekYear,
    targetWeek.isoWeekNumber,
  );
  if (stored?.profileFingerprint === fingerprint) {
    const plan = await loadWeeklyProgramSnapshot(
      profile.id,
      targetWeek.isoWeekYear,
      targetWeek.isoWeekNumber,
    );
    if (plan) return plan;
  }
  return regenerate(profile, targetDate, effectiveDate, targetWeek, depth + 1);
}

async function generatePlanForSlots(
  profile: ACREAProfile,
  week: IsoWeek,
  slots: Array<{ date: string; weekday: number }>,
): Promise<ACREAWeekPlan> {
  const [catalog, history, exerciseState] = await Promise.all([
    getWeeklyProgramCandidateSnapshot(),
    localTrainingHistoryPort.loadRecentWeeklyProgramHistory(profile.id),
    loadWeeklyProgramExerciseState(profile.id),
  ]);
  const generationProfile = {
    ...profile,
    weeklyFrequency: slots.length,
    preferredWeekdays: slots.map(({ weekday }) => weekday),
  };
  const input = buildWeeklyProgramAiInput({
    profile: generationProfile,
    candidates: catalog.candidates,
    catalogVersion: catalog.catalogVersion,
    recentStats: history.recentStats,
    candidateRecentStats: history.candidateRecentStats,
    exerciseProgressions: exerciseState.exerciseProgressions,
    exerciseHistories: exerciseState.exerciseHistories,
    week,
  });
  const generated = resolvePlanFormats(
    await generateWithWeeklyAiRuntime(input),
    catalog.formats,
  );
  if (generated.trainings.length !== slots.length) {
    throw new Error("Le moteur IA n'a pas généré le nombre de séances attendu.");
  }
  return {
    ...generated,
    trainings: generated.trainings.map((training, index) => ({
      ...training,
      day: weekdayLabel(slots[index].weekday),
      scheduledDate: slots[index].date,
    })),
  };
}

function localDateAtNoon(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    throw new Error(`Date locale invalide: ${value}`);
  }
  const date = new Date(`${value}T12:00:00`);
  if (Number.isNaN(date.getTime())) {
    throw new Error(`Date locale invalide: ${value}`);
  }
  return date;
}

function sameWeek(left: IsoWeek, right: IsoWeek) {
  return (
    left.isoWeekYear === right.isoWeekYear &&
    left.isoWeekNumber === right.isoWeekNumber
  );
}

function runSerialized<T>(key: string, operation: () => Promise<T>) {
  const previous = operationsByKey.get(key) ?? Promise.resolve();
  const current = waitForPreviousOperation(previous).then(operation);
  operationsByKey.set(key, current);
  return current.finally(() => {
    if (operationsByKey.get(key) === current) operationsByKey.delete(key);
  });
}

function waitForPreviousOperation(operation: Promise<unknown>): Promise<void> {
  // Each caller receives its own rejection. Settling here only prevents a
  // failed predecessor from poisoning the serialized queue.
  return operation.then(
    () => undefined,
    () => undefined,
  );
}

function resolvePlanFormats(
  plan: ACREAWeekPlan,
  formats: Awaited<ReturnType<typeof getWeeklyProgramCandidateSnapshot>>["formats"],
): ACREAWeekPlan {
  return {
    ...plan,
    trainings: plan.trainings.map((training) => ({
      ...training,
      seances: training.seances.map((seance) => ({
        ...seance,
        sessions: seance.sessions.map((session) => {
          const format = resolveCatalogFormatForPrescription(formats, session.prescription);
          return {
            ...session,
            formatId: format.id,
            formatCode: format.code,
            formatLabel: format.label,
          };
        }),
      })),
    })),
  };
}

async function ensurePlanExerciseSheets(plan: ACREAWeekPlan) {
  const { ensureCatalogExerciseDetails } = await import(
    "@features/catalog/services/catalogRepository"
  );
  const slugs = [...new Set(
    plan.trainings.flatMap((training) =>
      training.seances.flatMap((seance) =>
        seance.sessions.map((session) => session.exerciseCode),
      ),
    ),
  )];
  for (let index = 0; index < slugs.length; index += 25) {
    await ensureCatalogExerciseDetails(slugs.slice(index, index + 25));
  }
}
