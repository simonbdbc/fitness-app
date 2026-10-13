import type {
  SessionTimerPhaseKind,
  SessionTimerPlan,
  SessionTimerPlaybackStatus,
} from "./sessionTimerTypes";

const countdownDurationMs = 3_000;

export type SessionTimerMachineState = {
  countdownEndsAtMs: number | null;
  countdownReturnStatus: SessionTimerPlaybackStatus;
  elapsedMs: number;
  lastTickAtMs: number | null;
  observedAtMs: number;
  planKey: string;
  seriesIndex: number;
  seriesPhaseKind: SessionTimerPhaseKind;
  seriesRestElapsedMs: number;
  sessionElapsedMs: number;
  status: SessionTimerPlaybackStatus;
};

export type SessionTimerMachineAction =
  | { state: SessionTimerMachineState; type: "hydrate" }
  | { planKey: string; type: "planChanged" }
  | { nowMs: number; plan: SessionTimerPlan; type: "tick" }
  | { nowMs: number; plan: SessionTimerPlan; type: "toggle" }
  | { nowMs: number; plan: SessionTimerPlan; type: "completeEffort" }
  | { nowMs: number; plan: SessionTimerPlan; type: "finish" }
  | { planKey: string; type: "reset" };

export function createSessionTimerPlanKey(plan: SessionTimerPlan | null) {
  if (!plan) {
    return "none";
  }

  return JSON.stringify({
    id: plan.id,
    mode: plan.mode,
    phases: plan.phases.map((phase) => ({
      durationSeconds: phase.durationSeconds,
      id: phase.id,
      isManual: phase.isManual,
      kind: phase.kind,
      seriesIndex: phase.seriesIndex,
    })),
    series: plan.series,
    totalSeconds: plan.totalSeconds,
    workoutPhase: plan.workoutPhase,
  });
}

export function createInitialSessionTimerState(
  planKey: string,
): SessionTimerMachineState {
  return {
    countdownEndsAtMs: null,
    countdownReturnStatus: "idle",
    elapsedMs: 0,
    lastTickAtMs: null,
    observedAtMs: 0,
    planKey,
    seriesIndex: 0,
    seriesPhaseKind: "effort",
    seriesRestElapsedMs: 0,
    sessionElapsedMs: 0,
    status: "idle",
  };
}

export function reduceSessionTimerState(
  currentState: SessionTimerMachineState,
  action: SessionTimerMachineAction,
): SessionTimerMachineState {
  if (action.type === "hydrate") {
    return action.state;
  }

  if (action.type === "planChanged" || action.type === "reset") {
    return createInitialSessionTimerState(action.planKey);
  }

  const planKey = createSessionTimerPlanKey(action.plan);
  const state =
    currentState.planKey === planKey
      ? currentState
      : createInitialSessionTimerState(planKey);

  switch (action.type) {
    case "tick":
      return advanceTimer(state, action.plan, action.nowMs);
    case "toggle":
      return toggleTimer(state, action.plan, action.nowMs);
    case "completeEffort":
      return completeEffort(state, action.plan, action.nowMs);
    case "finish":
      return finishTimer(state, action.plan, action.nowMs);
  }
}

export function countdownRemainingSeconds(state: SessionTimerMachineState) {
  if (state.status !== "countdown" || state.countdownEndsAtMs === null) {
    return null;
  }

  return Math.max(
    0,
    Math.ceil((state.countdownEndsAtMs - state.observedAtMs) / 1_000),
  );
}

export function millisecondsToSeconds(milliseconds: number) {
  return Math.max(0, Math.floor(milliseconds / 1_000));
}

function toggleTimer(
  state: SessionTimerMachineState,
  plan: SessionTimerPlan,
  nowMs: number,
) {
  if (state.status === "completed") {
    return state;
  }

  if (state.status === "countdown") {
    return {
      ...state,
      countdownEndsAtMs: null,
      countdownReturnStatus: "idle" as const,
      lastTickAtMs:
        state.countdownReturnStatus === "running" ? nowMs : null,
      observedAtMs: nowMs,
      status: state.countdownReturnStatus,
    };
  }

  if (state.status === "running") {
    const advancedState = advanceTimer(state, plan, nowMs);

    if (advancedState.status === "completed") {
      return advancedState;
    }

    return {
      ...advancedState,
      lastTickAtMs: null,
      observedAtMs: nowMs,
      status: "paused" as const,
    };
  }

  return startCountdown(state, plan, nowMs);
}

function startCountdown(
  state: SessionTimerMachineState,
  plan: SessionTimerPlan,
  nowMs: number,
) {
  if (
    state.status === "completed" ||
    (plan.mode === "intervals" &&
      state.elapsedMs >= plan.totalSeconds * 1_000)
  ) {
    return state;
  }

  return {
    ...state,
    countdownEndsAtMs: nowMs + countdownDurationMs,
    countdownReturnStatus:
      state.status === "paused" ? ("paused" as const) : ("idle" as const),
    lastTickAtMs: null,
    observedAtMs: nowMs,
    status: "countdown" as const,
  };
}

function advanceTimer(
  state: SessionTimerMachineState,
  plan: SessionTimerPlan,
  nowMs: number,
): SessionTimerMachineState {
  const normalizedNowMs = Math.max(state.observedAtMs, nowMs);

  if (state.status === "countdown") {
    if (
      state.countdownEndsAtMs === null ||
      normalizedNowMs < state.countdownEndsAtMs
    ) {
      return { ...state, observedAtMs: normalizedNowMs };
    }

    const countdownEndsAtMs = state.countdownEndsAtMs;
    const runningState: SessionTimerMachineState = {
      ...state,
      countdownEndsAtMs: null,
      countdownReturnStatus: "idle",
      lastTickAtMs: countdownEndsAtMs,
      observedAtMs: countdownEndsAtMs,
      status: "running",
    };

    return advanceTimer(runningState, plan, normalizedNowMs);
  }

  if (state.status !== "running") {
    return { ...state, observedAtMs: normalizedNowMs };
  }

  const previousTickAtMs = state.lastTickAtMs ?? normalizedNowMs;
  const deltaMs = Math.max(0, normalizedNowMs - previousTickAtMs);

  if (plan.mode === "intervals") {
    const totalMs = plan.totalSeconds * 1_000;
    const consumedMs = Math.min(deltaMs, Math.max(0, totalMs - state.elapsedMs));
    const elapsedMs = state.elapsedMs + consumedMs;

    return {
      ...state,
      elapsedMs,
      lastTickAtMs: normalizedNowMs,
      observedAtMs: normalizedNowMs,
      sessionElapsedMs: state.sessionElapsedMs + consumedMs,
      status: elapsedMs >= totalMs ? "completed" : "running",
    };
  }

  if (!plan.series) {
    return state;
  }

  if (state.seriesPhaseKind === "effort") {
    return {
      ...state,
      lastTickAtMs: normalizedNowMs,
      observedAtMs: normalizedNowMs,
      sessionElapsedMs: state.sessionElapsedMs + deltaMs,
    };
  }

  return advanceSeriesRest(
    state,
    plan,
    previousTickAtMs,
    normalizedNowMs,
  );
}

function advanceSeriesRest(
  state: SessionTimerMachineState,
  plan: SessionTimerPlan,
  previousTickAtMs: number,
  nowMs: number,
): SessionTimerMachineState {
  const restDurationMs = (plan.series?.restSeconds ?? 0) * 1_000;
  const remainingRestMs = Math.max(
    0,
    restDurationMs - state.seriesRestElapsedMs,
  );
  const deltaMs = Math.max(0, nowMs - previousTickAtMs);
  const consumedRestMs = Math.min(deltaMs, remainingRestMs);
  const restCompletedAtMs = previousTickAtMs + consumedRestMs;
  const advancedState: SessionTimerMachineState = {
    ...state,
    elapsedMs: Math.min(
      plan.totalSeconds * 1_000,
      state.elapsedMs + consumedRestMs,
    ),
    lastTickAtMs: nowMs,
    observedAtMs: nowMs,
    seriesRestElapsedMs: state.seriesRestElapsedMs + consumedRestMs,
    sessionElapsedMs: state.sessionElapsedMs + consumedRestMs,
  };

  if (advancedState.seriesRestElapsedMs < restDurationMs) {
    return advancedState;
  }

  const nextSeriesState = beginNextSeries(advancedState, restCompletedAtMs);

  return advanceTimer(nextSeriesState, plan, nowMs);
}

function completeEffort(
  state: SessionTimerMachineState,
  plan: SessionTimerPlan,
  nowMs: number,
) {
  const advancedState = advanceTimer(state, plan, nowMs);

  if (
    !plan.series ||
    plan.mode !== "series" ||
    advancedState.status !== "running" ||
    advancedState.seriesPhaseKind !== "effort"
  ) {
    return advancedState;
  }

  if (advancedState.seriesIndex >= plan.series.totalSeries - 1) {
    return {
      ...advancedState,
      countdownEndsAtMs: null,
      elapsedMs: plan.totalSeconds * 1_000,
      lastTickAtMs: null,
      observedAtMs: nowMs,
      status: "completed" as const,
    };
  }

  if (plan.series.restSeconds === 0) {
    return beginNextSeries(advancedState, nowMs);
  }

  return {
    ...advancedState,
    countdownEndsAtMs: null,
    countdownReturnStatus: "idle" as const,
    lastTickAtMs: nowMs,
    observedAtMs: nowMs,
    seriesPhaseKind: "repos" as const,
    seriesRestElapsedMs: 0,
    status: "running" as const,
  };
}

function beginNextSeries(
  state: SessionTimerMachineState,
  transitionAtMs: number,
): SessionTimerMachineState {
  return {
    ...state,
    countdownEndsAtMs: null,
    countdownReturnStatus: "idle",
    lastTickAtMs: transitionAtMs,
    observedAtMs: transitionAtMs,
    seriesIndex: state.seriesIndex + 1,
    seriesPhaseKind: "effort",
    seriesRestElapsedMs: 0,
    status: "running",
  };
}

function finishTimer(
  state: SessionTimerMachineState,
  plan: SessionTimerPlan,
  nowMs: number,
): SessionTimerMachineState {
  const advancedState = advanceTimer(state, plan, nowMs);

  return {
    ...advancedState,
    countdownEndsAtMs: null,
    countdownReturnStatus: "idle",
    elapsedMs: plan.totalSeconds * 1_000,
    lastTickAtMs: null,
    observedAtMs: nowMs,
    seriesIndex: plan.series
      ? Math.max(0, plan.series.totalSeries - 1)
      : advancedState.seriesIndex,
    seriesPhaseKind: "effort",
    seriesRestElapsedMs: 0,
    status: "completed",
  };
}
