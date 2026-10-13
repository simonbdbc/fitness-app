import { useEffect, useMemo, useReducer, useRef, useState } from "react";
import { AppState, Platform } from "react-native";

import {
  countdownRemainingSeconds,
  createInitialSessionTimerState,
  createSessionTimerPlanKey,
  millisecondsToSeconds,
  reduceSessionTimerState,
} from "../domain/sessionTimerMachine";
import {
  createSessionTimerSnapshot,
  type SessionTimerPlan,
} from "../services/sessionTimer";
import {
  persistSessionTimerState,
  restoreSessionTimerState,
} from "../services/sessionTimerPersistence";

const clockRefreshIntervalMs = 250;

export function useSessionTimer(
  plan: SessionTimerPlan | null,
  persistenceKey?: string | null,
) {
  const planKey = createSessionTimerPlanKey(plan);
  const restorationKey =
    persistenceKey && plan ? `${persistenceKey}:${planKey}` : null;
  const [machineState, dispatch] = useReducer(
    reduceSessionTimerState,
    planKey,
    createInitialSessionTimerState,
  );
  const [restoredKey, setRestoredKey] = useState<string | null>(null);
  const isRestoring =
    restorationKey !== null && restoredKey !== restorationKey;
  const currentState =
    machineState.planKey === planKey
      ? machineState
      : createInitialSessionTimerState(planKey);
  const planRef = useRef(plan);
  planRef.current = plan;
  const stateRef = useRef(currentState);
  stateRef.current = currentState;
  const isRestoringRef = useRef(isRestoring);
  isRestoringRef.current = isRestoring;

  useEffect(() => {
    let active = true;

    if (!restorationKey) {
      setRestoredKey(null);
      return () => {
        active = false;
      };
    }

    void restoreSessionTimerState(persistenceKey, plan).then((state) => {
      if (!active) return;
      dispatch({ state, type: "hydrate" });
      setRestoredKey(restorationKey);
    });

    return () => {
      active = false;
    };
  }, [persistenceKey, planKey, restorationKey]);

  const isClockActive =
    !isRestoring &&
    (currentState.status === "countdown" ||
      currentState.status === "running");

  useEffect(() => {
    if (!isClockActive) {
      return undefined;
    }

    const intervalId = setInterval(() => {
      const currentPlan = planRef.current;

      if (currentPlan) {
        dispatch({ nowMs: Date.now(), plan: currentPlan, type: "tick" });
      }
    }, clockRefreshIntervalMs);

    return () => clearInterval(intervalId);
  }, [isClockActive, planKey]);

  const elapsedSeconds = millisecondsToSeconds(currentState.elapsedMs);
  const sessionElapsedSeconds = millisecondsToSeconds(
    currentState.sessionElapsedMs,
  );
  const seriesRestElapsedSeconds = millisecondsToSeconds(
    currentState.seriesRestElapsedMs,
  );
  const remainingCountdownSeconds = countdownRemainingSeconds(currentState);

  useEffect(() => {
    if (!isRestoring) {
      void persistSessionTimerState(persistenceKey, currentState, plan);
    }
  }, [
    elapsedSeconds,
    currentState.seriesIndex,
    currentState.seriesPhaseKind,
    currentState.status,
    isRestoring,
    persistenceKey,
    seriesRestElapsedSeconds,
    sessionElapsedSeconds,
  ]);

  useEffect(() => {
    const persistCurrentState = () => {
      if (isRestoringRef.current) return;
      void persistSessionTimerState(
        persistenceKey,
        stateRef.current,
        planRef.current,
      );
    };

    if (Platform.OS === "web" && typeof document !== "undefined") {
      const persistWhenHidden = () => {
        if (document.visibilityState === "hidden") persistCurrentState();
      };
      document.addEventListener("visibilitychange", persistWhenHidden);
      return () => {
        persistCurrentState();
        document.removeEventListener("visibilitychange", persistWhenHidden);
      };
    }

    const subscription = AppState.addEventListener("change", (nextState) => {
      if (nextState !== "active") persistCurrentState();
    });

    return () => {
      persistCurrentState();
      subscription.remove();
    };
  }, [persistenceKey]);

  const snapshot = useMemo(() => {
    if (!plan || isRestoring) {
      return null;
    }

    return createSessionTimerSnapshot({
      countdownRemainingSeconds: remainingCountdownSeconds,
      elapsedSeconds,
      plan,
      seriesState:
        plan.mode === "series"
          ? {
              currentSeriesIndex: currentState.seriesIndex,
              phaseKind: currentState.seriesPhaseKind,
              restElapsedSeconds: seriesRestElapsedSeconds,
            }
          : null,
      sessionElapsedSeconds,
      status: currentState.status,
    });
  }, [
    currentState.seriesIndex,
    currentState.seriesPhaseKind,
    seriesRestElapsedSeconds,
    currentState.status,
    elapsedSeconds,
    isRestoring,
    plan,
    remainingCountdownSeconds,
    sessionElapsedSeconds,
  ]);

  return {
    countdownRemainingSeconds: remainingCountdownSeconds,
    elapsedSeconds,
    isRestoring,
    sessionElapsedSeconds,
    snapshot,
    status: currentState.status,
    completeEffortPhase: () => {
      if (plan && !isRestoring) {
        dispatch({ nowMs: Date.now(), plan, type: "completeEffort" });
      }
    },
    finish: () => {
      if (plan && !isRestoring) {
        dispatch({ nowMs: Date.now(), plan, type: "finish" });
      }
    },
    reset: () => {
      if (!isRestoring) {
        dispatch({ planKey, type: "reset" });
      }
    },
    toggle: () => {
      if (plan && !isRestoring) {
        dispatch({ nowMs: Date.now(), plan, type: "toggle" });
      }
    },
  };
}
