export type SessionTimerPlanMode = "series" | "intervals";
export type SessionTimerWorkoutPhase = "warmup" | "main" | "cooldown";
export type SessionTimerPhaseKind = "effort" | "repos";
export type SessionTimerEventKind =
  | "preparation"
  | "decompte"
  | "effort"
  | "repos"
  | "fin";
export type SessionTimerPlaybackStatus =
  | "idle"
  | "countdown"
  | "running"
  | "paused"
  | "completed";
export type SessionTimerPhase = {
  id: string;
  kind: SessionTimerPhaseKind;
  index: number;
  label: string;
  durationSeconds: number;
  startsAtSeconds: number;
  endsAtSeconds: number;
  isManual: boolean;
  seriesIndex: number | null;
};

export type SessionTimerSeriesPlan = {
  totalSeries: number;
  targetRepetitions: number | null;
  restSeconds: number;
};

export type SessionTimerPlan = {
  id: string;
  label: string;
  mode: SessionTimerPlanMode;
  source: "catalog" | "text";
  totalSeconds: number;
  workoutPhase: SessionTimerWorkoutPhase;
  phases: SessionTimerPhase[];
  series: SessionTimerSeriesPlan | null;
};

export type SessionTimerSeriesState = {
  currentSeriesIndex: number;
  phaseKind: SessionTimerPhaseKind;
  restElapsedSeconds: number;
};

export type SessionTimerSeriesSnapshot = {
  currentSeriesNumber: number;
  totalSeries: number;
  targetRepetitions: number | null;
  restSeconds: number;
};

export type SessionTimerSnapshot = {
  status: SessionTimerPlaybackStatus;
  mode: SessionTimerPlanMode;
  elapsedSeconds: number;
  sessionElapsedSeconds: number;
  totalSeconds: number;
  totalRemainingSeconds: number;
  phase: SessionTimerPhase | null;
  phaseIndex: number;
  phaseElapsedSeconds: number;
  phaseRemainingSeconds: number;
  completedPhaseCount: number;
  countdownRemainingSeconds: number | null;
  eventKind: SessionTimerEventKind;
  globalProgressPercent: number;
  phaseProgressPercent: number;
  isComplete: boolean;
  isManualPhase: boolean;
  series: SessionTimerSeriesSnapshot | null;
  totalSeries: number | null;
};

type TimerFormatBase = {
  code: string;
  label: string;
  seriesCount: number;
  restSeconds: number;
};

export type TimerRepetitionsFormatInput = TimerFormatBase & {
  formatType: "repetitions";
  repetitions: number | null;
};

export type TimerIntervalsFormatInput = TimerFormatBase & {
  formatType: "intervalles";
  intervalSeconds: number;
};

export type TimerFormatInput =
  | TimerRepetitionsFormatInput
  | TimerIntervalsFormatInput;
