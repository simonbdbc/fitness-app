import type {
  SessionTimerEventKind,
  SessionTimerPhaseKind,
  SessionTimerPhase,
  SessionTimerPlan,
  SessionTimerPlanMode,
  SessionTimerPlaybackStatus,
  SessionTimerSeriesPlan,
  SessionTimerSeriesSnapshot,
  SessionTimerSeriesState,
  SessionTimerSnapshot,
  TimerFormatInput,
  TimerIntervalsFormatInput,
  TimerRepetitionsFormatInput,
} from "./sessionTimerTypes";

export function createSessionTimerSnapshot({
  countdownRemainingSeconds = null,
  elapsedSeconds,
  plan,
  seriesState,
  sessionElapsedSeconds = elapsedSeconds,
  status,
}: {
  countdownRemainingSeconds?: number | null;
  elapsedSeconds: number;
  plan: SessionTimerPlan;
  seriesState?: SessionTimerSeriesState | null;
  sessionElapsedSeconds?: number;
  status: SessionTimerPlaybackStatus;
}): SessionTimerSnapshot {
  return plan.mode === "series"
    ? createSeriesSnapshot({
        countdownRemainingSeconds,
        elapsedSeconds,
        plan,
        seriesState,
        sessionElapsedSeconds,
        status,
      })
    : createIntervalSnapshot({
        countdownRemainingSeconds,
        elapsedSeconds,
        plan,
        sessionElapsedSeconds,
        status,
      });
}


function createIntervalSnapshot({
  countdownRemainingSeconds,
  elapsedSeconds,
  plan,
  sessionElapsedSeconds,
  status,
}: {
  countdownRemainingSeconds: number | null;
  elapsedSeconds: number;
  plan: SessionTimerPlan;
  sessionElapsedSeconds: number;
  status: SessionTimerPlaybackStatus;
}): SessionTimerSnapshot {
  const normalizedElapsedSeconds = clampSeconds(
    elapsedSeconds,
    0,
    plan.totalSeconds,
  );
  const isComplete =
    status === "completed" || normalizedElapsedSeconds >= plan.totalSeconds;
  const activePhase = isComplete
    ? null
    : plan.phases.find(
        (phase) =>
          normalizedElapsedSeconds >= phase.startsAtSeconds &&
          normalizedElapsedSeconds < phase.endsAtSeconds,
      ) ?? null;
  const phaseElapsedSeconds = activePhase
    ? normalizedElapsedSeconds - activePhase.startsAtSeconds
    : 0;
  const phaseRemainingSeconds = activePhase
    ? Math.max(0, activePhase.durationSeconds - phaseElapsedSeconds)
    : 0;
  const completedPhaseCount = isComplete
    ? plan.phases.length
    : plan.phases.filter(
        (phase) => normalizedElapsedSeconds >= phase.endsAtSeconds,
      ).length;

  return buildSnapshot({
    activePhase,
    completedPhaseCount,
    countdownRemainingSeconds,
    elapsedSeconds: normalizedElapsedSeconds,
    isComplete,
    phaseElapsedSeconds,
    phaseRemainingSeconds,
    plan,
    sessionElapsedSeconds,
    series: null,
    status,
  });
}

function createSeriesSnapshot({
  countdownRemainingSeconds,
  elapsedSeconds,
  plan,
  seriesState,
  sessionElapsedSeconds,
  status,
}: {
  countdownRemainingSeconds: number | null;
  elapsedSeconds: number;
  plan: SessionTimerPlan;
  seriesState?: SessionTimerSeriesState | null;
  sessionElapsedSeconds: number;
  status: SessionTimerPlaybackStatus;
}): SessionTimerSnapshot {
  const seriesPlan = plan.series;

  if (!seriesPlan) {
    return createIntervalSnapshot({
      countdownRemainingSeconds,
      elapsedSeconds,
      plan,
      sessionElapsedSeconds,
      status,
    });
  }

  const normalizedElapsedSeconds = clampSeconds(
    elapsedSeconds,
    0,
    plan.totalSeconds,
  );
  const currentSeriesIndex = clampSeconds(
    seriesState?.currentSeriesIndex ?? 0,
    0,
    seriesPlan.totalSeries - 1,
  );
  const phaseKind = seriesState?.phaseKind ?? "effort";
  const restElapsedSeconds = clampSeconds(
    seriesState?.restElapsedSeconds ?? 0,
    0,
    seriesPlan.restSeconds,
  );
  const isComplete = status === "completed";
  const activePhase = isComplete
    ? null
    : plan.phases.find(
        (phase) =>
          phase.seriesIndex === currentSeriesIndex && phase.kind === phaseKind,
      ) ?? null;
  const phaseElapsedSeconds = phaseKind === "repos" ? restElapsedSeconds : 0;
  const phaseRemainingSeconds =
    phaseKind === "repos"
      ? Math.max(0, seriesPlan.restSeconds - restElapsedSeconds)
      : 0;
  const completedPhaseCount = isComplete
    ? plan.phases.length
    : currentSeriesIndex * 2 + (phaseKind === "repos" ? 1 : 0);

  return buildSnapshot({
    activePhase,
    completedPhaseCount,
    countdownRemainingSeconds,
    elapsedSeconds: normalizedElapsedSeconds,
    isComplete,
    phaseElapsedSeconds,
    phaseRemainingSeconds,
    plan,
    sessionElapsedSeconds,
    series: {
      currentSeriesNumber: currentSeriesIndex + 1,
      totalSeries: seriesPlan.totalSeries,
      targetRepetitions: seriesPlan.targetRepetitions,
      restSeconds: seriesPlan.restSeconds,
    },
    status,
  });
}

function buildSnapshot({
  activePhase,
  completedPhaseCount,
  countdownRemainingSeconds,
  elapsedSeconds,
  isComplete,
  phaseElapsedSeconds,
  phaseRemainingSeconds,
  plan,
  sessionElapsedSeconds,
  series,
  status,
}: {
  activePhase: SessionTimerPhase | null;
  completedPhaseCount: number;
  countdownRemainingSeconds: number | null;
  elapsedSeconds: number;
  isComplete: boolean;
  phaseElapsedSeconds: number;
  phaseRemainingSeconds: number;
  plan: SessionTimerPlan;
  sessionElapsedSeconds: number;
  series: SessionTimerSeriesSnapshot | null;
  status: SessionTimerPlaybackStatus;
}): SessionTimerSnapshot {
  return {
    status,
    mode: plan.mode,
    elapsedSeconds,
    sessionElapsedSeconds,
    totalSeconds: plan.totalSeconds,
    totalRemainingSeconds: Math.max(0, plan.totalSeconds - elapsedSeconds),
    phase: activePhase,
    phaseIndex: activePhase ? activePhase.index : plan.phases.length,
    phaseElapsedSeconds,
    phaseRemainingSeconds,
    completedPhaseCount,
    countdownRemainingSeconds,
    eventKind: resolveTimerEventKind({
      phase: activePhase,
      phaseRemainingSeconds,
      status,
      isComplete,
    }),
    globalProgressPercent: percentage(elapsedSeconds, plan.totalSeconds),
    phaseProgressPercent: activePhase?.isManual
      ? 0
      : activePhase
        ? percentage(phaseElapsedSeconds, activePhase.durationSeconds)
        : 100,
    isComplete,
    isManualPhase: Boolean(activePhase?.isManual),
    series,
    totalSeries: resolveTotalSeries(plan),
  };
}

function resolveTotalSeries(plan: SessionTimerPlan) {
  const totalSeries = plan.phases.reduce((maximum, phase) => {
    if (phase.seriesIndex === null) {
      return maximum;
    }

    return Math.max(maximum, phase.seriesIndex + 1);
  }, 0);

  return totalSeries > 0 ? totalSeries : null;
}

function resolveTimerEventKind({
  phase,
  phaseRemainingSeconds,
  status,
  isComplete,
}: {
  phase: SessionTimerPhase | null;
  phaseRemainingSeconds: number;
  status: SessionTimerPlaybackStatus;
  isComplete: boolean;
}): SessionTimerEventKind {
  if (isComplete) {
    return "fin";
  }

  if (status === "countdown") {
    return "decompte";
  }

  if (status === "idle" || !phase) {
    return "preparation";
  }

  if (phaseRemainingSeconds > 0 && phaseRemainingSeconds <= 3) {
    return "decompte";
  }

  return phase.kind;
}

function percentage(value: number, total: number) {
  if (total <= 0) {
    return 0;
  }

  return Math.max(0, Math.min(100, (value / total) * 100));
}

function clampSeconds(value: number, minimum: number, maximum: number) {
  return Math.max(minimum, Math.min(maximum, Math.floor(value)));
}
