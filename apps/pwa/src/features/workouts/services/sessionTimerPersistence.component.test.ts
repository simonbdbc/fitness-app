import AsyncStorage from "@react-native-async-storage/async-storage";
import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  createInitialSessionTimerState,
  createSessionTimerPlanKey,
} from "../domain/sessionTimerMachine";
import { buildSessionTimerPlan } from "./sessionTimer";
import {
  persistSessionTimerState,
  restoreSessionTimerState,
} from "./sessionTimerPersistence";

const plan = buildSessionTimerPlan({
  format: {
    code: "evaluation-2x8",
    formatType: "repetitions",
    label: "2 x 8",
    repetitions: 8,
    restSeconds: 90,
    seriesCount: 2,
  },
  label: "2 x 8",
})!;

describe("session timer persistence", () => {
  const storedValues = new Map<string, string>();

  beforeEach(() => {
    storedValues.clear();
    vi.mocked(AsyncStorage.getItem).mockImplementation(async (key) =>
      storedValues.get(key) ?? null,
    );
    vi.mocked(AsyncStorage.setItem).mockImplementation(async (key, value) => {
      storedValues.set(key, value);
    });
    vi.mocked(AsyncStorage.removeItem).mockImplementation(async (key) => {
      storedValues.delete(key);
    });
  });

  it("restores a running timer as paused without wall-clock catch-up", async () => {
    const state = {
      ...createInitialSessionTimerState(createSessionTimerPlanKey(plan)),
      elapsedMs: 20_000,
      lastTickAtMs: Date.now() - 60_000,
      observedAtMs: Date.now() - 60_000,
      seriesPhaseKind: "repos" as const,
      seriesRestElapsedMs: 20_000,
      sessionElapsedMs: 42_000,
      status: "running" as const,
    };
    await persistSessionTimerState("evaluation", state, plan);

    const restored = await restoreSessionTimerState("evaluation", plan);

    expect(restored.status).toBe("paused");
    expect(restored.elapsedMs).toBe(20_000);
    expect(restored.sessionElapsedMs).toBe(42_000);
    expect(restored.lastTickAtMs).toBeNull();
    expect(restored.countdownEndsAtMs).toBeNull();
  });

  it("discards a snapshot when the timer plan changed", async () => {
    await persistSessionTimerState(
      "evaluation",
      {
        ...createInitialSessionTimerState(createSessionTimerPlanKey(plan)),
        status: "paused",
      },
      plan,
    );
    const changedPlan = { ...plan, id: "evaluation-3x8" };

    expect(
      (await restoreSessionTimerState("evaluation", changedPlan)).status,
    ).toBe("idle");
    expect(AsyncStorage.removeItem).toHaveBeenCalledWith(
      "acrea-fitness.session-timer.v2:evaluation",
    );
  });

  it("keeps a completed interval timer completed", async () => {
    const intervalPlan = buildSessionTimerPlan({
      format: {
        code: "interval-2x30",
        formatType: "intervalles",
        intervalSeconds: 30,
        label: "2 x 30 secondes",
        restSeconds: 15,
        seriesCount: 2,
      },
      label: "2 x 30 secondes",
    })!;
    const state = {
      ...createInitialSessionTimerState(
        createSessionTimerPlanKey(intervalPlan),
      ),
      elapsedMs: intervalPlan.totalSeconds * 1_000,
      sessionElapsedMs: intervalPlan.totalSeconds * 1_000,
      status: "completed" as const,
    };

    await persistSessionTimerState("standalone", state, intervalPlan);
    const restored = await restoreSessionTimerState(
      "standalone",
      intervalPlan,
    );

    expect(restored.status).toBe("completed");
    expect(restored.elapsedMs).toBe(intervalPlan.totalSeconds * 1_000);
  });

  it("restores an interrupted countdown as paused", async () => {
    const state = {
      ...createInitialSessionTimerState(createSessionTimerPlanKey(plan)),
      countdownEndsAtMs: Date.now() + 2_000,
      status: "countdown" as const,
    };

    await persistSessionTimerState("countdown", state, plan);
    const restored = await restoreSessionTimerState("countdown", plan);

    expect(restored.status).toBe("paused");
    expect(restored.countdownEndsAtMs).toBeNull();
    expect(restored.lastTickAtMs).toBeNull();
  });

  it("serializes writes so the latest timer state wins", async () => {
    const firstWriteGate: { release: () => void } = { release: () => {} };
    const pendingFirstWrite = new Promise<void>((resolve) => {
      firstWriteGate.release = resolve;
    });
    vi.mocked(AsyncStorage.setItem)
      .mockImplementationOnce(() => pendingFirstWrite)
      .mockImplementation(async (key, value) => {
        storedValues.set(key, value);
      });
    const firstState = {
      ...createInitialSessionTimerState(createSessionTimerPlanKey(plan)),
      sessionElapsedMs: 1_000,
      status: "paused" as const,
    };
    const secondState = {
      ...firstState,
      sessionElapsedMs: 2_000,
    };

    const firstWrite = persistSessionTimerState("evaluation", firstState, plan);
    const secondWrite = persistSessionTimerState(
      "evaluation",
      secondState,
      plan,
    );

    await vi.waitFor(() => expect(AsyncStorage.setItem).toHaveBeenCalledTimes(1));
    firstWriteGate.release();
    await Promise.all([firstWrite, secondWrite]);

    const lastSavedValue = vi.mocked(AsyncStorage.setItem).mock.calls.at(-1)?.[1];
    expect(JSON.parse(lastSavedValue ?? "{}").sessionElapsedMs).toBe(2_000);
  });
});
