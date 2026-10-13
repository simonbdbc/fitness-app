import AsyncStorage from "@react-native-async-storage/async-storage";

import {
  enqueueAsyncStorageOperation,
  waitForAsyncStorageOperation,
} from "@shared/persistence";

import type { WorkoutAudioMode } from "./workoutCueAudio";

const workoutAudioCuesModeStorageKey = "acrea-fitness.audio-cues.mode";
const legacyWorkoutAudioCuesEnabledStorageKey =
  "acrea-fitness.audio-cues.enabled";
const disabledStorageValue = "false";
const defaultWorkoutAudioMode: WorkoutAudioMode = "sound";
const validWorkoutAudioModes = new Set<WorkoutAudioMode>([
  "sound",
  "voice",
  "silent",
]);

let cachedAudioCueMode: WorkoutAudioMode | null = null;
let loadingPreferencePromise: Promise<WorkoutAudioMode> | null = null;
const listeners = new Set<(mode: WorkoutAudioMode) => void>();

export function getCachedWorkoutAudioCueMode() {
  return cachedAudioCueMode ?? defaultWorkoutAudioMode;
}

export async function getWorkoutAudioCueMode() {
  if (cachedAudioCueMode !== null) {
    return cachedAudioCueMode;
  }

  if (!loadingPreferencePromise) {
    loadingPreferencePromise = loadWorkoutAudioCueMode()
      .then((mode) => {
        cachedAudioCueMode = mode;
        notifyWorkoutAudioCuesListeners(mode);

        return mode;
      })
      .finally(() => {
        loadingPreferencePromise = null;
      });
  }

  return loadingPreferencePromise;
}

export async function setWorkoutAudioCueMode(mode: WorkoutAudioMode) {
  cachedAudioCueMode = mode;
  notifyWorkoutAudioCuesListeners(mode);
  await enqueueAsyncStorageOperation(
    workoutAudioCuesModeStorageKey,
    () => AsyncStorage.setItem(workoutAudioCuesModeStorageKey, mode),
    "workout-audio-preferences-write",
  );
}

export function subscribeWorkoutAudioCuesPreference(
  listener: (mode: WorkoutAudioMode) => void,
) {
  listeners.add(listener);

  return () => {
    listeners.delete(listener);
  };
}

async function loadWorkoutAudioCueMode(): Promise<WorkoutAudioMode> {
  await waitForAsyncStorageOperation(workoutAudioCuesModeStorageKey);
  const storedMode = await AsyncStorage.getItem(workoutAudioCuesModeStorageKey);

  if (isWorkoutAudioMode(storedMode)) {
    return storedMode;
  }

  const legacyEnabled = await AsyncStorage.getItem(
    legacyWorkoutAudioCuesEnabledStorageKey,
  );

  return legacyEnabled === disabledStorageValue
    ? "silent"
    : defaultWorkoutAudioMode;
}

function isWorkoutAudioMode(value: string | null): value is WorkoutAudioMode {
  return Boolean(value && validWorkoutAudioModes.has(value as WorkoutAudioMode));
}

function notifyWorkoutAudioCuesListeners(mode: WorkoutAudioMode) {
  for (const listener of listeners) {
    listener(mode);
  }
}
