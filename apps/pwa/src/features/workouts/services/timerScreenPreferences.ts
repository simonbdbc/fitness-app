import AsyncStorage from "@react-native-async-storage/async-storage";

import { reportTechnicalDegradationOnce } from "@shared/observability/technicalDiagnostics";
import type { TimerFormatInput } from "../domain/sessionTimerTypes";

const timerScreenStoragePrefix = "acrea-fitness.timer-screen.v1";
const pendingWrites = new Map<string, Promise<void>>();

export type TimerScreenPreferences = {
  formatType: TimerFormatInput["formatType"];
  intervalCode: string | null;
  repetitionCode: string | null;
  restCode: string | null;
  seriesCode: string | null;
};

type PersistedTimerScreenPreferences = TimerScreenPreferences & {
  updatedAt: string;
  version: 1;
};

export async function readTimerScreenPreferences(
  userId: string | null | undefined,
): Promise<TimerScreenPreferences | null> {
  if (!userId) return null;

  const key = storageKey(userId);

  try {
    await (pendingWrites.get(key) ?? Promise.resolve());
    const rawValue = await AsyncStorage.getItem(key);
    if (!rawValue) return null;

    const saved = JSON.parse(
      rawValue,
    ) as Partial<PersistedTimerScreenPreferences>;
    if (
      saved.version !== 1 ||
      (saved.formatType !== "repetitions" &&
        saved.formatType !== "intervalles")
    ) {
      await AsyncStorage.removeItem(key);
      return null;
    }

    return {
      formatType: saved.formatType,
      intervalCode: optionalCode(saved.intervalCode),
      repetitionCode: optionalCode(saved.repetitionCode),
      restCode: optionalCode(saved.restCode),
      seriesCode: optionalCode(saved.seriesCode),
    };
  } catch (error) {
    reportTechnicalDegradationOnce("timer-screen-preferences-read", error, {
      userId,
    });
    return null;
  }
}

export async function writeTimerScreenPreferences(
  userId: string | null | undefined,
  preferences: TimerScreenPreferences,
) {
  if (!userId) return;

  const key = storageKey(userId);
  const saved: PersistedTimerScreenPreferences = {
    ...preferences,
    updatedAt: new Date().toISOString(),
    version: 1,
  };
  const previousWrite = pendingWrites.get(key) ?? Promise.resolve();
  const currentWrite = previousWrite
    .then(() => AsyncStorage.setItem(key, JSON.stringify(saved)))
    .catch((error: unknown) => {
      reportTechnicalDegradationOnce("timer-screen-preferences-write", error, {
        userId,
      });
    })
    .finally(() => {
      if (pendingWrites.get(key) === currentWrite) pendingWrites.delete(key);
    });

  pendingWrites.set(key, currentWrite);
  await currentWrite;
}

function storageKey(userId: string) {
  return `${timerScreenStoragePrefix}:${encodeURIComponent(userId)}`;
}

function optionalCode(value: unknown) {
  return typeof value === "string" && value.trim() ? value : null;
}
