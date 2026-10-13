import AsyncStorage from "@react-native-async-storage/async-storage";
import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  createInitialSessionTimerState,
  createSessionTimerPlanKey,
} from "../domain/sessionTimerMachine";
import { buildSessionTimerPlan, type SessionTimerPlan } from "../services/sessionTimer";
import { useSessionTimer } from "./useSessionTimer";

const repetitionPlan = requirePlan({
  code: "persistent-repetitions",
  formatType: "repetitions",
  label: "2 x 8",
  repetitions: 8,
  restSeconds: 90,
  seriesCount: 2,
});

const intervalPlan = requirePlan({
  code: "persistent-intervals",
  formatType: "intervalles",
  intervalSeconds: 30,
  label: "2 x 30 secondes",
  restSeconds: 15,
  seriesCount: 2,
});

describe("useSessionTimer persistence", () => {
  beforeEach(() => {
    vi.mocked(AsyncStorage.getItem).mockResolvedValue(null);
    vi.mocked(AsyncStorage.setItem).mockResolvedValue(undefined);
    vi.mocked(AsyncStorage.removeItem).mockResolvedValue(undefined);
  });

  it("does not overwrite storage before restoring an active rest as paused", async () => {
    const restoration = deferred<string | null>();
    vi.mocked(AsyncStorage.getItem).mockReturnValueOnce(restoration.promise);
    const savedState = {
      ...createInitialSessionTimerState(
        createSessionTimerPlanKey(repetitionPlan),
      ),
      elapsedMs: 20_000,
      seriesPhaseKind: "repos" as const,
      seriesRestElapsedMs: 20_000,
      sessionElapsedMs: 42_000,
      status: "running" as const,
    };
    const { result } = renderHook(() =>
      useSessionTimer(repetitionPlan, "timer:user-a:standalone"),
    );

    expect(result.current.isRestoring).toBe(true);
    expect(result.current.snapshot).toBeNull();
    expect(AsyncStorage.setItem).not.toHaveBeenCalled();

    act(() => result.current.toggle());
    expect(result.current.status).toBe("idle");

    restoration.resolve(persistedValue(repetitionPlan, savedState));

    await waitFor(() => expect(result.current.isRestoring).toBe(false));
    expect(result.current.status).toBe("paused");
    expect(result.current.snapshot?.phase?.kind).toBe("repos");
    expect(result.current.snapshot?.phaseRemainingSeconds).toBe(70);
    expect(result.current.sessionElapsedSeconds).toBe(42);
  });

  it("ignores a late restoration after the timer plan changes", async () => {
    const firstRestoration = deferred<string | null>();
    const intervalState = {
      ...createInitialSessionTimerState(createSessionTimerPlanKey(intervalPlan)),
      elapsedMs: 10_000,
      sessionElapsedMs: 10_000,
      status: "paused" as const,
    };
    vi.mocked(AsyncStorage.getItem)
      .mockReturnValueOnce(firstRestoration.promise)
      .mockResolvedValueOnce(persistedValue(intervalPlan, intervalState));
    const { rerender, result } = renderHook(
      ({ plan }: { plan: SessionTimerPlan }) =>
        useSessionTimer(plan, "timer:user-a:standalone"),
      { initialProps: { plan: repetitionPlan } },
    );

    rerender({ plan: intervalPlan });

    await waitFor(() => expect(result.current.isRestoring).toBe(false));
    expect(result.current.snapshot?.mode).toBe("intervals");
    expect(result.current.elapsedSeconds).toBe(10);

    firstRestoration.resolve(
      persistedValue(repetitionPlan, {
        ...createInitialSessionTimerState(
          createSessionTimerPlanKey(repetitionPlan),
        ),
        sessionElapsedMs: 55_000,
        status: "paused",
      }),
    );

    await act(async () => Promise.resolve());
    expect(result.current.snapshot?.mode).toBe("intervals");
    expect(result.current.elapsedSeconds).toBe(10);
  });

  it("persists reset as the new idle state", async () => {
    const { result } = renderHook(() =>
      useSessionTimer(intervalPlan, "timer:user-a:standalone"),
    );

    await waitFor(() => expect(result.current.isRestoring).toBe(false));
    act(() => result.current.toggle());
    await waitFor(() =>
      expect(lastPersistedStatus()).toBe("countdown"),
    );

    act(() => result.current.reset());

    await waitFor(() => expect(lastPersistedStatus()).toBe("idle"));
    const lastSavedValue = vi.mocked(AsyncStorage.setItem).mock.calls.at(-1)?.[1];
    expect(JSON.parse(lastSavedValue ?? "{}").elapsedMs).toBe(0);
  });

  it("persists the latest state when the timer unmounts", async () => {
    const { result, unmount } = renderHook(() =>
      useSessionTimer(repetitionPlan, "timer:user-a:standalone"),
    );

    await waitFor(() => expect(result.current.isRestoring).toBe(false));
    act(() => result.current.toggle());
    await waitFor(() => expect(lastPersistedStatus()).toBe("countdown"));
    vi.mocked(AsyncStorage.setItem).mockClear();

    unmount();

    await waitFor(() => expect(AsyncStorage.setItem).toHaveBeenCalledTimes(1));
    expect(lastPersistedStatus()).toBe("countdown");
  });

  it("persists directly when the PWA becomes hidden", async () => {
    const visibility = vi
      .spyOn(document, "visibilityState", "get")
      .mockReturnValue("visible");
    const { result } = renderHook(() =>
      useSessionTimer(repetitionPlan, "timer:user-a:standalone"),
    );

    await waitFor(() => expect(result.current.isRestoring).toBe(false));
    act(() => result.current.toggle());
    await waitFor(() => expect(lastPersistedStatus()).toBe("countdown"));
    vi.mocked(AsyncStorage.setItem).mockClear();

    visibility.mockReturnValue("hidden");
    act(() => document.dispatchEvent(new Event("visibilitychange")));

    await waitFor(() => expect(AsyncStorage.setItem).toHaveBeenCalledTimes(1));
    expect(lastPersistedStatus()).toBe("countdown");
    visibility.mockRestore();
  });
});

function requirePlan(
  format:
    | {
        code: string;
        formatType: "repetitions";
        label: string;
        repetitions: number;
        restSeconds: number;
        seriesCount: number;
      }
    | {
        code: string;
        formatType: "intervalles";
        intervalSeconds: number;
        label: string;
        restSeconds: number;
        seriesCount: number;
      },
) {
  const plan = buildSessionTimerPlan({ format, label: format.label });
  if (!plan) throw new Error("Le plan du test doit être valide.");
  return plan;
}

function persistedValue(
  plan: SessionTimerPlan,
  state: ReturnType<typeof createInitialSessionTimerState>,
) {
  return JSON.stringify({
    elapsedMs: state.elapsedMs,
    plan,
    planKey: createSessionTimerPlanKey(plan),
    seriesIndex: state.seriesIndex,
    seriesPhaseKind: state.seriesPhaseKind,
    seriesRestElapsedMs: state.seriesRestElapsedMs,
    sessionElapsedMs: state.sessionElapsedMs,
    status: state.status,
    updatedAt: "2026-07-22T00:00:00.000Z",
    version: 2,
  });
}

function deferred<T>() {
  let resolvePromise!: (value: T) => void;
  const promise = new Promise<T>((resolve) => {
    resolvePromise = resolve;
  });
  return { promise, resolve: resolvePromise };
}

function lastPersistedStatus() {
  const lastSavedValue = vi.mocked(AsyncStorage.setItem).mock.calls.at(-1)?.[1];
  return JSON.parse(lastSavedValue ?? "{}").status;
}
