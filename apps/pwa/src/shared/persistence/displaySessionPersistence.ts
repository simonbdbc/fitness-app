import AsyncStorage from "@react-native-async-storage/async-storage";

import { reportTechnicalDegradationOnce } from "@shared/observability/technicalDiagnostics";
import {
  clearAsyncStorageKeys,
  enqueueAsyncStorageOperation,
  waitForAsyncStorageOperation,
  waitForAsyncStorageOperations,
} from "./asyncStorageQueue";

const displaySessionPrefix = "acrea-fitness.display-session.v1";
const legacyScreenStatePrefix = "acrea-fitness.screen-state.v1";
const legacyInstalledRoutePrefix = "acrea-fitness.installed-route-resume.v2";
const legacyCatalogFilterPrefix = "catalog-library-filter-preferences:v1";
const runtimeId = createRuntimeId();

type PersistedDisplaySessionState<TValue> = {
  value: TValue;
  version: 1;
};

const cachedValues = new Map<string, unknown>();
const clearedUserIds = new Set<string>();
let initializationPromise: Promise<void> | null = null;

export function displaySessionStorageKey(userId: string, scope: string) {
  clearedUserIds.delete(userId);
  return `${displaySessionPrefix}:${runtimeId}:${encodeURIComponent(userId)}:${scope}`;
}

export function getDisplaySessionRuntimeId() {
  return runtimeId;
}

/**
 * Starts a new display lifetime. Functional persistence (timers, preferences,
 * guided sessions) is deliberately left untouched.
 */
export function initializeDisplaySessionPersistence() {
  if (initializationPromise) return initializationPromise;

  initializationPromise = (async () => {
    try {
      await waitForAsyncStorageOperations();
      const keys = await AsyncStorage.getAllKeys();
      const obsoleteKeys = keys.filter(
        (key) =>
          key.startsWith(`${displaySessionPrefix}:`) ||
          key.startsWith(`${legacyScreenStatePrefix}:`) ||
          key.startsWith(`${legacyInstalledRoutePrefix}:`) ||
          key.startsWith(`${legacyCatalogFilterPrefix}:`),
      );
      await clearAsyncStorageKeys(obsoleteKeys);
      cachedValues.clear();
    } catch (error) {
      reportTechnicalDegradationOnce("display-session-initialize", error);
    }
  })();

  return initializationPromise;
}

export function readCachedDisplaySessionState<TValue>(
  key: string | null,
  parse: (value: unknown) => TValue | null,
) {
  if (!key || !cachedValues.has(key)) return null;
  return parse(cachedValues.get(key));
}

export async function readDisplaySessionState<TValue>(
  key: string | null,
  parse: (value: unknown) => TValue | null,
) {
  if (!key) return null;

  await initializeDisplaySessionPersistence();
  const cached = readCachedDisplaySessionState(key, parse);
  if (cached !== null) return cached;

  try {
    await waitForAsyncStorageOperation(key);
    const raw = await AsyncStorage.getItem(key);
    if (!raw) return null;
    const persisted = JSON.parse(
      raw,
    ) as Partial<PersistedDisplaySessionState<unknown>>;
    const value = persisted.version === 1 ? parse(persisted.value) : null;
    if (value !== null) {
      cachedValues.set(key, value);
      return value;
    }
    await removeDisplaySessionState(key);
  } catch (error) {
    reportTechnicalDegradationOnce("display-session-read", error, { key });
  }

  return null;
}

export async function writeDisplaySessionState<TValue>(
  key: string | null,
  value: TValue,
) {
  if (!key) return;
  const userId = displaySessionUserIdFromKey(key);
  if (userId && clearedUserIds.has(userId)) {
    cachedValues.delete(key);
    return;
  }
  cachedValues.set(key, value);
  await initializeDisplaySessionPersistence();
  const persisted: PersistedDisplaySessionState<TValue> = {
    value,
    version: 1,
  };
  await enqueueAsyncStorageOperation(
    key,
    () => AsyncStorage.setItem(key, JSON.stringify(persisted)),
    "display-session-write",
    { key },
  );
}

export async function removeDisplaySessionState(key: string | null) {
  if (!key) return;
  cachedValues.delete(key);
  await initializeDisplaySessionPersistence();
  await enqueueAsyncStorageOperation(
    key,
    () => AsyncStorage.removeItem(key),
    "display-session-remove",
    { key },
  );
}

export async function clearDisplaySessionForUser(
  userId: string | null | undefined,
) {
  if (!userId) return;
  clearedUserIds.add(userId);
  await initializeDisplaySessionPersistence();
  try {
    await waitForAsyncStorageOperations();
    const userPrefix = `${displaySessionPrefix}:${runtimeId}:${encodeURIComponent(userId)}:`;
    const keys = await AsyncStorage.getAllKeys();
    const keysToRemove = keys.filter((key) => key.startsWith(userPrefix));
    for (const key of keysToRemove) cachedValues.delete(key);
    await clearAsyncStorageKeys(keysToRemove);
  } catch (error) {
    reportTechnicalDegradationOnce("display-session-clear-user", error, {
      userId,
    });
  }
}

export async function clearCurrentDisplaySession() {
  await initializeDisplaySessionPersistence();
  try {
    await waitForAsyncStorageOperations();
    const currentPrefix = `${displaySessionPrefix}:${runtimeId}:`;
    const keys = await AsyncStorage.getAllKeys();
    const keysToRemove = keys.filter((key) => key.startsWith(currentPrefix));
    cachedValues.clear();
    await clearAsyncStorageKeys(keysToRemove);
  } catch (error) {
    reportTechnicalDegradationOnce("display-session-clear", error);
  }
}

function createRuntimeId() {
  const randomPart = Math.random().toString(36).slice(2);
  return `${Date.now().toString(36)}-${randomPart}`;
}

function displaySessionUserIdFromKey(key: string) {
  const currentPrefix = `${displaySessionPrefix}:${runtimeId}:`;
  if (!key.startsWith(currentPrefix)) return null;
  const encodedUserId = key.slice(currentPrefix.length).split(":", 1)[0];
  if (!encodedUserId) return null;
  try {
    return decodeURIComponent(encodedUserId);
  } catch {
    return null;
  }
}

export function shouldOpenHomeForNewDisplayRuntime({
  navigationType,
  pathname,
}: {
  navigationType: string | null;
  pathname: string;
}) {
  return (
    navigationType === "reload" && pathname !== "/" && pathname !== "/home"
  );
}

export function getWebNavigationType() {
  if (typeof performance === "undefined") return null;
  const [navigationEntry] = performance.getEntriesByType("navigation");
  return navigationEntry && "type" in navigationEntry
    ? String(navigationEntry.type)
    : null;
}
