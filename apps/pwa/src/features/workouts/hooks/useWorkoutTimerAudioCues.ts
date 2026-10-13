import { useEffect, useRef, type MutableRefObject } from "react";

import type { SessionTimerSnapshot } from "../services/sessionTimer";
import {
    playWorkoutCueAudio,
    preloadWorkoutCueAudio,
    type WorkoutAudioCue,
    type WorkoutAudioMode,
} from "../services/workoutCueAudio";
import { workoutPhaseStartCue } from "../services/workoutTimerCue";

type TimerCue = {
    cue: WorkoutAudioCue;
    key: string;
};

export function useWorkoutTimerAudioCues({
    mode,
    planId,
    snapshot,
}: {
    mode: WorkoutAudioMode;
    planId: string | null;
    snapshot: SessionTimerSnapshot | null;
}) {
    const lastCueKeyRef = useRef<string | null>(null);
    const previousModeRef = useRef<WorkoutAudioMode | null>(null);
    const previousPlanIdRef = useRef<string | null>(null);
    const previousStatusRef = useRef<SessionTimerSnapshot["status"] | null>(
        null,
    );

    useEffect(() => {
        if (mode === "silent") {
            return;
        }

        void preloadWorkoutCueAudio(mode);
    }, [mode]);

    useEffect(() => {
        let previousStatus = previousStatusRef.current;
        const scopeChanged =
            previousModeRef.current !== mode ||
            previousPlanIdRef.current !== planId;

        if (scopeChanged) {
            previousModeRef.current = mode;
            previousPlanIdRef.current = planId;
            previousStatus = null;
            previousStatusRef.current = null;
            lastCueKeyRef.current = null;
        }

        if (mode === "silent" || !planId || !snapshot) {
            previousStatusRef.current = snapshot?.status ?? null;
            return;
        }

        if (snapshot.status === "idle") {
            lastCueKeyRef.current = null;
            previousStatusRef.current = snapshot.status;
            return;
        }

        if (snapshot.status === "paused") {
            previousStatusRef.current = snapshot.status;
            return;
        }

        if (snapshot.status === "countdown") {
            handleCountdownCue({
                mode,
                planId,
                snapshot,
                lastCueKeyRef,
            });
            previousStatusRef.current = snapshot.status;
            return;
        }

        const cue = workoutCueFromSnapshot({
            mode,
            planId,
            previousStatus,
            snapshot,
        });

        if (cue) {
            playCueOnce({
                cue: cue.cue,
                key: `${mode}:${cue.key}`,
                mode,
                lastCueKeyRef,
            });
        }

        previousStatusRef.current = snapshot.status;
    }, [
        mode,
        planId,
        snapshot?.countdownRemainingSeconds,
        snapshot?.elapsedSeconds,
        snapshot?.eventKind,
        snapshot?.isComplete,
        snapshot?.mode,
        snapshot?.phaseElapsedSeconds,
        snapshot?.phaseIndex,
        snapshot?.phaseRemainingSeconds,
        snapshot?.phase?.kind,
        snapshot?.series?.currentSeriesNumber,
        snapshot?.status,
    ]);
}

function handleCountdownCue({
    lastCueKeyRef,
    mode,
    planId,
    snapshot,
}: {
    lastCueKeyRef: MutableRefObject<string | null>;
    mode: WorkoutAudioMode;
    planId: string;
    snapshot: SessionTimerSnapshot;
}) {
    const countdownCue = countdownCueFromRemaining(
        snapshot.countdownRemainingSeconds,
    );

    if (countdownCue) {
        playCueOnce({
            cue: countdownCue,
            key: `${mode}:${planId}:countdown:${snapshot.phaseIndex}:${snapshot.countdownRemainingSeconds}`,
            mode,
            lastCueKeyRef,
        });
    }
}

function playCueOnce({
    cue,
    key,
    lastCueKeyRef,
    mode,
}: {
    cue: WorkoutAudioCue;
    key: string;
    lastCueKeyRef: MutableRefObject<string | null>;
    mode: WorkoutAudioMode;
}) {
    if (key === lastCueKeyRef.current) {
        return;
    }

    lastCueKeyRef.current = key;
    playWorkoutCueAudio(cue, mode);
}

function workoutCueFromSnapshot({
    mode,
    planId,
    previousStatus,
    snapshot,
}: {
    mode: WorkoutAudioMode;
    planId: string;
    previousStatus: SessionTimerSnapshot["status"] | null;
    snapshot: SessionTimerSnapshot;
}): TimerCue | null {
    if (snapshot.isComplete) {
        return {
            cue: "sessionComplete",
            key: `${planId}:complete`,
        };
    }

    if (!snapshot.phase || snapshot.status !== "running") {
        return null;
    }

    if (previousStatus === "countdown") {
        return {
            cue: workoutPhaseStartCue(mode, snapshot),
            key: `${planId}:phase-start:${snapshot.phaseIndex}:${snapshot.phase.kind}`,
        };
    }

    if (snapshot.phaseElapsedSeconds === 0) {
        return {
            cue: workoutPhaseStartCue(mode, snapshot),
            key: `${planId}:phase:${snapshot.phaseIndex}:${snapshot.phase.kind}`,
        };
    }

    if (!snapshot.isManualPhase) {
        const countdownCue = countdownCueFromRemaining(
            snapshot.phaseRemainingSeconds,
        );

        if (countdownCue) {
            return {
                cue: countdownCue,
                key: `${planId}:phase:${snapshot.phaseIndex}:countdown:${snapshot.phaseRemainingSeconds}`,
            };
        }
    }

    return null;
}

function countdownCueFromRemaining(
    remainingSeconds: number | null,
): WorkoutAudioCue | null {
    if (remainingSeconds === 3) {
        return "countdown3";
    }

    if (remainingSeconds === 2) {
        return "countdown2";
    }

    if (remainingSeconds === 1) {
        return "countdown1";
    }

    return null;
}
