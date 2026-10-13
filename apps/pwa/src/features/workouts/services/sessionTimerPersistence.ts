import AsyncStorage from "@react-native-async-storage/async-storage";

import { reportTechnicalDegradationOnce } from "@shared/observability/technicalDiagnostics";
import {
  createInitialSessionTimerState,
  createSessionTimerPlanKey,
  type SessionTimerMachineState,
} from "../domain/sessionTimerMachine";
import type { SessionTimerPlan } from "../domain/sessionTimerTypes";

const timerStoragePrefix = "acrea-fitness.session-timer.v2";
const pendingStorageOperations = new Map<string, Promise<void>>();

type PersistedTimerState = {
  elapsedMs: number;
  plan: SessionTimerPlan;
  planKey: string;
  seriesIndex: number;
  seriesPhaseKind: "effort" | "repos";
  seriesRestElapsedMs: number;
  sessionElapsedMs: number;
  status: SessionTimerMachineState["status"];
  updatedAt: string;
  version: 2;
};

export async function restoreSessionTimerState(
  persistenceKey: string | null | undefined,
  plan: SessionTimerPlan | null,
) {
  const planKey = createSessionTimerPlanKey(plan);
  const fallback = createInitialSessionTimerState(planKey);
  if (!persistenceKey || !plan) return fallback;

  const key = storageKey(persistenceKey);

  try {
    await waitForPendingStorageOperation(key);
    const rawValue = await AsyncStorage.getItem(key);
    if (!rawValue) return fallback;
    const saved = JSON.parse(rawValue) as Partial<PersistedTimerState>;
    if (
      saved.version !== 2 ||
      saved.planKey !== planKey ||
      !saved.plan ||
      createSessionTimerPlanKey(saved.plan) !== planKey
    ) {
      await clearSessionTimerState(persistenceKey);
      return fallback;
    }

    const totalMs = Math.max(0, plan.totalSeconds * 1_000);
    const elapsedMs = clampNumber(saved.elapsedMs, 0, totalMs);
    const sessionElapsedMs = Math.max(
      elapsedMs,
      clampNumber(saved.sessionElapsedMs, 0, Number.MAX_SAFE_INTEGER),
    );
    const maxSeriesIndex = Math.max(0, (plan.series?.totalSeries ?? 1) - 1);
    const seriesIndex = clampNumber(saved.seriesIndex, 0, maxSeriesIndex);
    const maxRestMs = Math.max(0, (plan.series?.restSeconds ?? 0) * 1_000);
    const seriesRestElapsedMs = clampNumber(
      saved.seriesRestElapsedMs,
      0,
      maxRestMs,
    );
    const isComplete = saved.status === "completed";
    const hasStarted =
      saved.status !== "idle" ||
      elapsedMs > 0 ||
      sessionElapsedMs > 0 ||
      seriesIndex > 0 ||
      seriesRestElapsedMs > 0;

    return {
      ...fallback,
      elapsedMs: isComplete ? totalMs : elapsedMs,
      observedAtMs: Date.now(),
      seriesIndex,
      seriesPhaseKind:
        saved.seriesPhaseKind === "repos" ? "repos" : "effort",
      seriesRestElapsedMs,
      sessionElapsedMs,
      status: isComplete ? "completed" : hasStarted ? "paused" : "idle",
    } satisfies SessionTimerMachineState;
  } catch (error) {
    reportTechnicalDegradationOnce("session-timer-restore", error, {
      persistenceKey,
    });
    await clearSessionTimerState(persistenceKey);
    return fallback;
  }
}

export async function persistSessionTimerState(
  persistenceKey: string | null | undefined,
  state: SessionTimerMachineState,
  plan: SessionTimerPlan | null,
) {
  if (!persistenceKey || !plan) return;
  const saved: PersistedTimerState = {
    elapsedMs: state.elapsedMs,
    plan,
    planKey: state.planKey,
    seriesIndex: state.seriesIndex,
    seriesPhaseKind: state.seriesPhaseKind,
    seriesRestElapsedMs: state.seriesRestElapsedMs,
    sessionElapsedMs: state.sessionElapsedMs,
    status: state.status,
    updatedAt: new Date().toISOString(),
    version: 2,
  };

  await enqueueStorageOperation(
    storageKey(persistenceKey),
    () =>
      AsyncStorage.setItem(
        storageKey(persistenceKey),
        JSON.stringify(saved),
      ),
    "session-timer-persist",
    persistenceKey,
  );
}

export async function clearSessionTimerState(
  persistenceKey: string | null | undefined,
) {
  if (!persistenceKey) return;

  await enqueueStorageOperation(
    storageKey(persistenceKey),
    () => AsyncStorage.removeItem(storageKey(persistenceKey)),
    "session-timer-clear",
    persistenceKey,
  );
}

function storageKey(persistenceKey: string) {
  return `${timerStoragePrefix}:${encodeURIComponent(persistenceKey)}`;
}

function clampNumber(value: unknown, minimum: number, maximum: number) {
  if (typeof value !== "number" || !Number.isFinite(value)) return minimum;
  return Math.min(maximum, Math.max(minimum, Math.floor(value)));
}

function waitForPendingStorageOperation(key: string) {
  return pendingStorageOperations.get(key) ?? Promise.resolve();
}

function enqueueStorageOperation(
  key: string,
  operation: () => Promise<void>,
  diagnosticScope: string,
  persistenceKey: string,
) {
  const previousOperation = waitForPendingStorageOperation(key);
  const currentOperation = previousOperation
    .then(operation)
    .catch((error: unknown) => {
      reportTechnicalDegradationOnce(diagnosticScope, error, {
        persistenceKey,
      });
    })
    .finally(() => {
      if (pendingStorageOperations.get(key) === currentOperation) {
        pendingStorageOperations.delete(key);
      }
    });

  pendingStorageOperations.set(key, currentOperation);
  return currentOperation;
}
