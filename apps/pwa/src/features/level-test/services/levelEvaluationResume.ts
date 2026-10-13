import AsyncStorage from "@react-native-async-storage/async-storage";

import { reportTechnicalDegradationOnce } from "@shared/observability/technicalDiagnostics";
import {
  enqueueAsyncStorageOperation,
  waitForAsyncStorageOperation,
} from "@shared/persistence";

export type LevelEvaluationFeedbackDraft = {
  appreciationRating: number | null;
  maximumRepetitions: string;
  technicalValid: boolean | null;
};

const storagePrefix = "acrea-fitness-public-demo.level-evaluation-feedback.v2";

export async function readLevelEvaluationFeedbackDraft(key: string) {
  const persistedKey = storageKey(key);
  try {
    await waitForAsyncStorageOperation(persistedKey);
    const rawValue = await AsyncStorage.getItem(persistedKey);
    if (!rawValue) return defaultDraft();
    const parsed = JSON.parse(rawValue) as Partial<LevelEvaluationFeedbackDraft>;
    return {
      appreciationRating:
        Number.isInteger(parsed.appreciationRating) &&
        Number(parsed.appreciationRating) >= 1 &&
        Number(parsed.appreciationRating) <= 5
          ? Number(parsed.appreciationRating)
          : null,
      maximumRepetitions:
        typeof parsed.maximumRepetitions === "string" &&
        /^\d+$/.test(parsed.maximumRepetitions)
          ? parsed.maximumRepetitions
          : "",
      technicalValid:
        typeof parsed.technicalValid === "boolean"
          ? parsed.technicalValid
          : null,
    };
  } catch (error) {
    reportTechnicalDegradationOnce("level-evaluation-feedback-read", error, {
      key,
    });
    await clearLevelEvaluationFeedbackDraft(key);
    return defaultDraft();
  }
}

export async function writeLevelEvaluationFeedbackDraft(
  key: string,
  draft: LevelEvaluationFeedbackDraft,
) {
  const persistedKey = storageKey(key);
  await enqueueAsyncStorageOperation(
    persistedKey,
    () => AsyncStorage.setItem(persistedKey, JSON.stringify(draft)),
    "level-evaluation-feedback-write",
    { key },
  );
}

export async function clearLevelEvaluationFeedbackDraft(key: string) {
  const persistedKey = storageKey(key);
  await enqueueAsyncStorageOperation(
    persistedKey,
    () => AsyncStorage.removeItem(persistedKey),
    "level-evaluation-feedback-clear",
    { key },
  );
}

export function defaultDraft(): LevelEvaluationFeedbackDraft {
  return {
    appreciationRating: null,
    maximumRepetitions: "",
    technicalValid: null,
  };
}

function storageKey(key: string) {
  return `${storagePrefix}:${encodeURIComponent(key)}`;
}
