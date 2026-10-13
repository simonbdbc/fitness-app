import type {
  SessionTimerEventKind,
  SessionTimerPhaseKind,
  SessionTimerPhase,
  SessionTimerPlan,
  SessionTimerPlanMode,
  SessionTimerPlaybackStatus,
  SessionTimerSeriesPlan,
  SessionTimerSeriesSnapshot,
  SessionTimerSeriesState,
  SessionTimerSnapshot,
  SessionTimerWorkoutPhase,
  TimerFormatInput,
  TimerIntervalsFormatInput,
  TimerRepetitionsFormatInput,
} from "./sessionTimerTypes";

export function buildSessionTimerPlan({
  format,
  label,
  workoutPhase = "main",
}: {
  format?: TimerFormatInput | null;
  label: string;
  workoutPhase?: SessionTimerWorkoutPhase;
}): SessionTimerPlan | null {
  if (format?.formatType === "repetitions") {
    return buildSeriesTimerPlan(format, workoutPhase);
  }

  if (format?.formatType === "intervalles") {
    return buildIntervalTimerPlan(format, workoutPhase);
  }

  return buildTextTimerPlan(label, workoutPhase);
}


export function formatTimerDuration(totalSeconds: number) {
  const normalizedTotalSeconds = Math.max(0, Math.floor(totalSeconds));
  const minutes = Math.floor(normalizedTotalSeconds / 60);
  const seconds = normalizedTotalSeconds % 60;

  return `${minutes}:${String(seconds).padStart(2, "0")}`;
}

function buildSeriesTimerPlan(
  format: TimerRepetitionsFormatInput,
  workoutPhase: SessionTimerWorkoutPhase,
): SessionTimerPlan | null {
  if (
    typeof format.seriesCount !== "number" ||
    typeof format.restSeconds !== "number"
  ) {
    return null;
  }

  if (
    format.seriesCount <= 0 ||
    (format.repetitions !== null && format.repetitions <= 0) ||
    format.restSeconds < 0
  ) {
    return null;
  }

  const phases = buildSeriesPhases({
    label: format.label,
    restSeconds: format.restSeconds,
    totalSeries: format.seriesCount,
  });

  return {
    id: format.code,
    label: format.label,
    mode: "series",
    source: "catalog",
    totalSeconds: format.restSeconds * Math.max(0, format.seriesCount - 1),
    workoutPhase,
    phases,
    series: {
      totalSeries: format.seriesCount,
      targetRepetitions: format.repetitions,
      restSeconds: format.restSeconds,
    },
  };
}

function buildIntervalTimerPlan(
  format: TimerIntervalsFormatInput,
  workoutPhase: SessionTimerWorkoutPhase,
): SessionTimerPlan | null {
  if (
    typeof format.seriesCount !== "number" ||
    typeof format.restSeconds !== "number" ||
    format.seriesCount <= 0 ||
    format.intervalSeconds <= 0 ||
    format.restSeconds < 0
  ) {
    return null;
  }

  const phases = buildIntervalPhases({
    effortSeconds: format.intervalSeconds,
    label: format.label,
    restSeconds: format.restSeconds,
    totalSeries: format.seriesCount,
  });

  if (phases.length === 0) {
    return null;
  }

  return {
    id: format.code,
    label: format.label,
    mode: "intervals",
    source: "catalog",
    totalSeconds: phases[phases.length - 1].endsAtSeconds,
    workoutPhase,
    phases,
    series: null,
  };
}

function buildTextTimerPlan(
  label: string,
  workoutPhase: SessionTimerWorkoutPhase,
): SessionTimerPlan | null {
  const minuteMatch = label.match(/(\d+)(?:[.:](\d{2}))?\s*min/i);

  if (minuteMatch) {
    const totalSeconds =
      Number.parseInt(minuteMatch[1], 10) * 60 +
      Number.parseInt(minuteMatch[2] ?? "0", 10);

    return onePhasePlan({
      id: `text-${slugify(label)}`,
      kind: "effort",
      label,
      source: "text",
      totalSeconds,
      workoutPhase,
    });
  }

  const secondMatches = Array.from(label.matchAll(/(\d+)\s*s/gi));
  const lastSecondMatch = secondMatches[secondMatches.length - 1];

  if (!lastSecondMatch) {
    return null;
  }

  const totalSeconds = Number.parseInt(lastSecondMatch[1], 10);
  const kind = /\brepos\b/i.test(label) ? "repos" : "effort";

  return onePhasePlan({
    id: `text-${slugify(label)}`,
    kind,
    label,
    source: "text",
    totalSeconds,
    workoutPhase,
  });
}

function onePhasePlan({
  id,
  kind,
  label,
  source,
  totalSeconds,
  workoutPhase,
}: {
  id: string;
  kind: SessionTimerPhaseKind;
  label: string;
  source: SessionTimerPlan["source"];
  totalSeconds: number;
  workoutPhase: SessionTimerWorkoutPhase;
}): SessionTimerPlan | null {
  if (totalSeconds <= 0) {
    return null;
  }

  return {
    id,
    label,
    mode: "intervals",
    source,
    totalSeconds,
    workoutPhase,
    phases: [
      {
        id: `${id}-phase-1`,
        kind,
        index: 0,
        label: kind === "repos" ? "Repos" : "Effort",
        durationSeconds: totalSeconds,
        startsAtSeconds: 0,
        endsAtSeconds: totalSeconds,
        isManual: false,
        seriesIndex: null,
      },
    ],
    series: null,
  };
}

function buildSeriesPhases({
  label,
  restSeconds,
  totalSeries,
}: {
  label: string;
  restSeconds: number;
  totalSeries: number;
}) {
  const phases: SessionTimerPhase[] = [];
  let cursorSeconds = 0;

  for (let seriesIndex = 0; seriesIndex < totalSeries; seriesIndex += 1) {
    phases.push({
      id: `${slugify(label)}-serie-${seriesIndex + 1}`,
      kind: "effort",
      index: phases.length,
      label: `Série ${seriesIndex + 1}`,
      durationSeconds: 0,
      startsAtSeconds: cursorSeconds,
      endsAtSeconds: cursorSeconds,
      isManual: true,
      seriesIndex,
    });

    if (seriesIndex < totalSeries - 1) {
      phases.push({
        id: `${slugify(label)}-repos-${seriesIndex + 1}`,
        kind: "repos",
        index: phases.length,
        label: `Repos ${seriesIndex + 1}`,
        durationSeconds: restSeconds,
        startsAtSeconds: cursorSeconds,
        endsAtSeconds: cursorSeconds + restSeconds,
        isManual: false,
        seriesIndex,
      });
      cursorSeconds += restSeconds;
    }
  }

  return phases;
}

function buildIntervalPhases({
  effortSeconds,
  label,
  restSeconds,
  totalSeries,
}: {
  effortSeconds: number;
  label: string;
  restSeconds: number;
  totalSeries: number;
}): SessionTimerPhase[] {
  if (totalSeries <= 0 || effortSeconds <= 0) {
    return [];
  }

  const phases: SessionTimerPhase[] = [];
  let cursorSeconds = 0;

  for (let seriesIndex = 0; seriesIndex < totalSeries; seriesIndex += 1) {
    cursorSeconds = pushIntervalPhase({
      cursorSeconds,
      durationSeconds: effortSeconds,
      kind: "effort",
      label: `Effort ${seriesIndex + 1}`,
      phases,
      seriesIndex,
    });

    if (seriesIndex < totalSeries - 1 && restSeconds > 0) {
      cursorSeconds = pushIntervalPhase({
        cursorSeconds,
        durationSeconds: restSeconds,
        kind: "repos",
        label: `Repos ${seriesIndex + 1}`,
        phases,
        seriesIndex,
      });
    }
  }

  return phases.map((phase) => ({
    ...phase,
    id: `${slugify(label)}-${phase.kind}-${phase.index + 1}`,
  }));
}

function pushIntervalPhase({
  cursorSeconds,
  durationSeconds,
  kind,
  label,
  phases,
  seriesIndex,
}: {
  cursorSeconds: number;
  durationSeconds: number;
  kind: SessionTimerPhaseKind;
  label: string;
  phases: SessionTimerPhase[];
  seriesIndex: number;
}) {
  const startsAtSeconds = cursorSeconds;
  const endsAtSeconds = cursorSeconds + durationSeconds;

  phases.push({
    id: `${kind}-${phases.length + 1}`,
    kind,
    index: phases.length,
    label,
    durationSeconds: endsAtSeconds - startsAtSeconds,
    startsAtSeconds,
    endsAtSeconds,
    isManual: false,
    seriesIndex,
  });

  return endsAtSeconds;
}

function slugify(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}
