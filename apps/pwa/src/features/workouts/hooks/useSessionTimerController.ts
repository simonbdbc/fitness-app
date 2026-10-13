import { useEffect, useRef, useState } from "react";

import { useScreenWakeLock } from "./useScreenWakeLock";
import { useSessionTimer } from "./useSessionTimer";
import { useWorkoutAudioCuesPreference } from "./useWorkoutAudioCuesPreference";
import { useWorkoutTimerAudioCues } from "./useWorkoutTimerAudioCues";
import { playWorkoutCueAudioAndWait } from "../services/workoutCueAudio";
import { workoutIntroCue } from "../services/workoutTimerCue";
import type {
  SessionTimerPlan,
  SessionTimerSnapshot,
} from "../services/sessionTimer";

export function useSessionTimerController(
  plan: SessionTimerPlan | null,
  persistenceKey?: string | null,
) {
  const timer = useSessionTimer(plan, persistenceKey);
  const { mode: audioCueMode } = useWorkoutAudioCuesPreference();
  const [isPreparing, setIsPreparing] = useState(false);
  const voiceLaunchTokenRef = useRef(0);
  const shouldKeepScreenAwake =
    isPreparing ||
    timer.status === "countdown" ||
    timer.status === "running";

  useScreenWakeLock(shouldKeepScreenAwake);

  useWorkoutTimerAudioCues({
    mode: audioCueMode,
    planId: plan?.id ?? null,
    snapshot: timer.snapshot,
  });

  useEffect(
    () => () => {
      voiceLaunchTokenRef.current += 1;
    },
    [],
  );

  useEffect(() => {
    voiceLaunchTokenRef.current += 1;
    setIsPreparing(false);
  }, [plan?.id, plan?.workoutPhase]);

  const cancelPendingVoiceLaunch = () => {
    voiceLaunchTokenRef.current += 1;
    setIsPreparing(false);
  };

  const toggle = () => {
    if (
      audioCueMode !== "voice" ||
      !shouldWaitForVoiceExerciseIntro(timer.snapshot)
    ) {
      timer.toggle();
      return;
    }

    if (isPreparing) {
      return;
    }

    const launchToken = voiceLaunchTokenRef.current + 1;
    voiceLaunchTokenRef.current = launchToken;
    setIsPreparing(true);

    const introCue = workoutIntroCue(plan?.workoutPhase ?? "main");

    void playWorkoutCueAudioAndWait(introCue, "voice").then(() => {
      if (voiceLaunchTokenRef.current !== launchToken) {
        return;
      }

      setIsPreparing(false);
      timer.toggle();
    });
  };

  return {
    ...timer,
    isPreparing,
    finish: () => {
      cancelPendingVoiceLaunch();
      timer.finish();
    },
    reset: () => {
      cancelPendingVoiceLaunch();
      timer.reset();
    },
    toggle,
  };
}

function shouldWaitForVoiceExerciseIntro(
  snapshot: SessionTimerSnapshot | null,
) {
  return (
    snapshot?.status === "idle" &&
    snapshot.elapsedSeconds === 0 &&
    snapshot.phase?.kind === "effort" &&
    (!snapshot.series || snapshot.series.currentSeriesNumber === 1)
  );
}
