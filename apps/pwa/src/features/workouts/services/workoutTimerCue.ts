import type {
  SessionTimerSnapshot,
  SessionTimerWorkoutPhase,
} from "./sessionTimer";
import type { WorkoutAudioCue, WorkoutAudioMode } from "./workoutCueAudio";

const seriesCues = [
  "series1",
  "series2",
  "series3",
  "series4",
  "series5",
  "series6",
  "series7",
  "series8",
  "series9",
  "series10",
  "series11",
  "series12",
] as const satisfies readonly WorkoutAudioCue[];

export function workoutIntroCue(
  workoutPhase: SessionTimerWorkoutPhase,
): WorkoutAudioCue {
  if (workoutPhase === "warmup") {
    return "warmUpStart";
  }

  if (workoutPhase === "cooldown") {
    return "coldDownStart";
  }

  return "exerciseStart";
}

export function workoutPhaseStartCue(
  mode: WorkoutAudioMode,
  snapshot: SessionTimerSnapshot,
): WorkoutAudioCue {
  if (snapshot.phase?.kind === "repos") {
    return "restStart";
  }

  if (mode !== "voice") {
    return "exerciseStart";
  }

  const seriesNumber =
    snapshot.mode === "series"
      ? snapshot.series?.currentSeriesNumber
      : phaseSeriesNumber(snapshot);

  if (seriesNumber === 1 && snapshot.totalSeries === 1) {
    return "letsGo";
  }

  return cueFromNumber(seriesCues, seriesNumber) ?? "exerciseStart";
}

function phaseSeriesNumber(snapshot: SessionTimerSnapshot) {
  const seriesIndex = snapshot.phase?.seriesIndex;

  return seriesIndex === null || seriesIndex === undefined
    ? undefined
    : seriesIndex + 1;
}

function cueFromNumber(
  cues: readonly WorkoutAudioCue[],
  number: number | undefined,
) {
  if (!Number.isInteger(number) || number === undefined || number < 1) {
    return null;
  }

  return cues[number - 1] ?? null;
}
