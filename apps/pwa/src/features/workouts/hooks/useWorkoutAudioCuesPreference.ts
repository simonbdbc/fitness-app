import { useCallback, useEffect, useState } from "react";

import {
  getCachedWorkoutAudioCueMode,
  getWorkoutAudioCueMode,
  setWorkoutAudioCueMode,
  subscribeWorkoutAudioCuesPreference,
} from "../services/workoutAudioPreferences";
import type { WorkoutAudioMode } from "../services/workoutCueAudio";

export function useWorkoutAudioCuesPreference() {
  const [mode, setModeState] = useState(getCachedWorkoutAudioCueMode);

  useEffect(() => {
    let isMounted = true;
    const unsubscribe = subscribeWorkoutAudioCuesPreference(setModeState);

    void getWorkoutAudioCueMode().then((storedMode) => {
      if (isMounted) {
        setModeState(storedMode);
      }
    });

    return () => {
      isMounted = false;
      unsubscribe();
    };
  }, []);

  const setMode = useCallback((nextMode: WorkoutAudioMode) => {
    setModeState(nextMode);
    void setWorkoutAudioCueMode(nextMode);
  }, []);

  return { mode, setMode };
}
