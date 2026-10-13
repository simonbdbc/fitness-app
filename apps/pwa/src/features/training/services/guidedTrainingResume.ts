import AsyncStorage from "@react-native-async-storage/async-storage";

import { reportTechnicalDegradationOnce } from "@shared/observability/technicalDiagnostics";
import {
  enqueueAsyncStorageOperation,
  waitForAsyncStorageOperation,
} from "@shared/persistence";

const guidedTrainingStoragePrefix = "acrea-fitness-public-demo.guided-training.v1";

export type GuidedTrainingResumeState = {
  planKey: string;
  sessionIndex: number;
  trainingCode: string;
  updatedAt: string;
  version: 1;
};

export async function readGuidedTrainingResume(
  profileId: string,
  planKey: string,
) {
  const key = storageKey(profileId);
  try {
    await waitForAsyncStorageOperation(key);
    const rawValue = await AsyncStorage.getItem(key);
    if (!rawValue) return null;
    const state = JSON.parse(rawValue) as Partial<GuidedTrainingResumeState>;
    if (
      state.version !== 1 ||
      state.planKey !== planKey ||
      typeof state.trainingCode !== "string" ||
      !Number.isInteger(state.sessionIndex) ||
      Number(state.sessionIndex) < 0
    ) {
      await clearGuidedTrainingResume(profileId);
      return null;
    }
    return state as GuidedTrainingResumeState;
  } catch (error) {
    reportTechnicalDegradationOnce("guided-training-resume-read", error, {
      profileId,
    });
    await clearGuidedTrainingResume(profileId);
    return null;
  }
}

export function writeGuidedTrainingResume(
  profileId: string,
  state: Omit<GuidedTrainingResumeState, "updatedAt" | "version">,
) {
  const key = storageKey(profileId);
  return enqueueAsyncStorageOperation(
    key,
    () =>
      AsyncStorage.setItem(
        key,
        JSON.stringify({
          ...state,
          updatedAt: new Date().toISOString(),
          version: 1,
        } satisfies GuidedTrainingResumeState),
      ),
    "guided-training-resume-write",
    { profileId },
  );
}

export function clearGuidedTrainingResume(profileId: string) {
  const key = storageKey(profileId);
  return enqueueAsyncStorageOperation(
    key,
    () => AsyncStorage.removeItem(key),
    "guided-training-resume-clear",
    { profileId },
  );
}

function storageKey(profileId: string) {
  return `${guidedTrainingStoragePrefix}:${encodeURIComponent(profileId)}`;
}
