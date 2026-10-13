import AsyncStorage from "@react-native-async-storage/async-storage";

import { reportTechnicalDegradationOnce } from "@shared/observability/technicalDiagnostics";
import {
  enqueueAsyncStorageOperation,
  waitForAsyncStorageOperation,
} from "@shared/persistence";
import type { SessionFeedbackDraft } from "../domain/trainingPresentation";

const storagePrefix = "acrea-fitness.guided-training-feedback.v1";

export type GuidedTrainingFeedbackResumeState = {
  drafts: Record<string, SessionFeedbackDraft>;
  savedSessionIds: string[];
};

export async function readGuidedTrainingFeedbackResume(key: string) {
  const persistedKey = storageKey(key);
  try {
    await waitForAsyncStorageOperation(persistedKey);
    const rawValue = await AsyncStorage.getItem(persistedKey);
    if (!rawValue) return emptyState();
    const parsed = JSON.parse(
      rawValue,
    ) as Partial<GuidedTrainingFeedbackResumeState>;
    return {
      drafts:
        parsed.drafts && typeof parsed.drafts === "object" ? parsed.drafts : {},
      savedSessionIds: Array.isArray(parsed.savedSessionIds)
        ? parsed.savedSessionIds.filter(
            (value): value is string => typeof value === "string",
          )
        : [],
    };
  } catch (error) {
    reportTechnicalDegradationOnce("guided-training-feedback-read", error, {
      key,
    });
    await clearGuidedTrainingFeedbackResume(key);
    return emptyState();
  }
}

export function writeGuidedTrainingFeedbackResume(
  key: string,
  state: GuidedTrainingFeedbackResumeState,
) {
  const persistedKey = storageKey(key);
  return enqueueAsyncStorageOperation(
    persistedKey,
    () => AsyncStorage.setItem(persistedKey, JSON.stringify(state)),
    "guided-training-feedback-write",
    { key },
  );
}

export function clearGuidedTrainingFeedbackResume(key: string) {
  const persistedKey = storageKey(key);
  return enqueueAsyncStorageOperation(
    persistedKey,
    () => AsyncStorage.removeItem(persistedKey),
    "guided-training-feedback-clear",
    { key },
  );
}

function emptyState(): GuidedTrainingFeedbackResumeState {
  return { drafts: {}, savedSessionIds: [] };
}

function storageKey(key: string) {
  return `${storagePrefix}:${encodeURIComponent(key)}`;
}
