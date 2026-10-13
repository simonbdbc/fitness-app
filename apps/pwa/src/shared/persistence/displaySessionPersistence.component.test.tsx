import AsyncStorage from "@react-native-async-storage/async-storage";
import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  clearDisplaySessionForUser,
  displaySessionStorageKey,
  initializeDisplaySessionPersistence,
  readDisplaySessionState,
  shouldOpenHomeForNewDisplayRuntime,
  writeDisplaySessionState,
} from "./displaySessionPersistence";
import { usePersistentScreenState } from "./usePersistentScreenState";

describe("display session persistence", () => {
  const storedValues = new Map<string, string>();

  beforeEach(() => {
    storedValues.clear();
    vi.mocked(AsyncStorage.getAllKeys).mockImplementation(async () => [
      ...storedValues.keys(),
    ]);
    vi.mocked(AsyncStorage.getItem).mockImplementation(async (key) =>
      storedValues.get(key) ?? null,
    );
    vi.mocked(AsyncStorage.setItem).mockImplementation(async (key, value) => {
      storedValues.set(key, value);
    });
    vi.mocked(AsyncStorage.removeItem).mockImplementation(async (key) => {
      storedValues.delete(key);
    });
    vi.mocked(AsyncStorage.multiRemove).mockImplementation(async (keys) => {
      for (const key of keys) storedValues.delete(key);
    });
  });

  it("clears obsolete display runtimes without touching functional state", async () => {
    storedValues.set("acrea-fitness.display-session.v1:old:user:route", "{}");
    storedValues.set("acrea-fitness.screen-state.v1:user:profile", "{}");
    storedValues.set("acrea-fitness.session-timer.v2:timer", "timer");

    await initializeDisplaySessionPersistence();

    expect(storedValues.has("acrea-fitness.display-session.v1:old:user:route"))
      .toBe(false);
    expect(storedValues.has("acrea-fitness.screen-state.v1:user:profile"))
      .toBe(false);
    expect(storedValues.get("acrea-fitness.session-timer.v2:timer")).toBe(
      "timer",
    );
  });

  it("serializes writes so the last display state wins", async () => {
    const key = displaySessionStorageKey("queue-user", "route:test");
    let releaseFirstWrite = () => {};
    const firstWriteGate = new Promise<void>((resolve) => {
      releaseFirstWrite = resolve;
    });
    vi.mocked(AsyncStorage.setItem)
      .mockImplementationOnce(async (storedKey, value) => {
        await firstWriteGate;
        storedValues.set(storedKey, value);
      })
      .mockImplementation(async (storedKey, value) => {
        storedValues.set(storedKey, value);
      });

    const first = writeDisplaySessionState(key, { page: 1 });
    const second = writeDisplaySessionState(key, { page: 2 });
    await vi.waitFor(() => expect(AsyncStorage.setItem).toHaveBeenCalledTimes(1));
    releaseFirstWrite();
    await Promise.all([first, second]);

    expect(
      await readDisplaySessionState(key, parsePageState),
    ).toEqual({ page: 2 });
  });

  it("hydrates a screen before persisting changes", async () => {
    const key = displaySessionStorageKey("hydrate-user", "route:profile");
    storedValues.set(key, JSON.stringify({ value: { page: 7 }, version: 1 }));
    vi.mocked(AsyncStorage.setItem).mockClear();

    const { result } = renderHook(() =>
      usePersistentScreenState({
        initialValue: { page: 0 },
        parse: parsePageState,
        storageKey: key,
      }),
    );

    await waitFor(() => expect(result.current.isRestoring).toBe(false));
    expect(result.current.value).toEqual({ page: 7 });
    expect(
      vi.mocked(AsyncStorage.setItem).mock.calls.some(([, value]) =>
        value.includes('"page":0'),
      ),
    ).toBe(false);

    act(() => result.current.setValue({ page: 8 }));
    await waitFor(() =>
      expect(storedValues.get(key)).toContain('"page":8'),
    );
  });

  it("clears only the selected user in the current runtime", async () => {
    const firstKey = displaySessionStorageKey("first-user", "route:home");
    const secondKey = displaySessionStorageKey("second-user", "route:home");
    await writeDisplaySessionState(firstKey, { page: 1 });
    await writeDisplaySessionState(secondKey, { page: 2 });

    await clearDisplaySessionForUser("first-user");

    expect(storedValues.has(firstKey)).toBe(false);
    expect(storedValues.has(secondKey)).toBe(true);
  });

  it("rejects a late write after logout and allows a later login", async () => {
    const staleKey = displaySessionStorageKey("late-user", "route:profile");
    await writeDisplaySessionState(staleKey, { page: 1 });
    await clearDisplaySessionForUser("late-user");

    await writeDisplaySessionState(staleKey, { page: 2 });
    expect(storedValues.has(staleKey)).toBe(false);

    const reactivatedKey = displaySessionStorageKey(
      "late-user",
      "route:profile",
    );
    await writeDisplaySessionState(reactivatedKey, { page: 3 });
    expect(storedValues.get(reactivatedKey)).toContain('"page":3');
  });

  it("opens home only after a genuine document reload", () => {
    expect(
      shouldOpenHomeForNewDisplayRuntime({
        navigationType: "reload",
        pathname: "/timer",
      }),
    ).toBe(true);
    expect(
      shouldOpenHomeForNewDisplayRuntime({
        navigationType: "navigate",
        pathname: "/timer",
      }),
    ).toBe(false);
    expect(
      shouldOpenHomeForNewDisplayRuntime({
        navigationType: "reload",
        pathname: "/home",
      }),
    ).toBe(false);
  });
});

function parsePageState(value: unknown) {
  if (!value || typeof value !== "object") return null;
  const page = (value as { page?: unknown }).page;
  return typeof page === "number" ? { page } : null;
}
