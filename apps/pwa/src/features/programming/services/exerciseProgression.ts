import type {
  ACREALevel,
  ACREAPillar,
  ACREAPrescriptionKind,
  ACREASessionPrescription,
} from "../data/acreaSeed";

export type ProgressionDirection = "easier" | "same" | "harder";

export function initialExercisePrescription(
  kind: ACREAPrescriptionKind,
  pillar: ACREAPillar,
  level: ACREALevel,
): ACREASessionPrescription {
  if (kind === "fixed") return fixedPrescription(300);
  if (kind === "intervals") return intervalLadder(pillar, level)[0];
  return repetitionLadder(level)[0];
}

export function adaptExercisePrescription(
  current: ACREASessionPrescription,
  direction: ProgressionDirection,
  pillar: ACREAPillar,
  level: ACREALevel,
) {
  if (!current.adaptable || direction === "same") return current;
  const ladder = current.kind === "repetitions"
    ? repetitionLadder(level)
    : current.kind === "intervals"
      ? intervalLadder(pillar, level)
      : [current];
  return moveOnLadder(current, ladder, direction === "harder" ? 1 : -1);
}

export function safeProgressionDirection({
  completed,
  painLevel,
  progressionPreference,
  qualityRating,
}: {
  completed: boolean;
  painLevel: "none" | "mild" | "pain";
  progressionPreference: ProgressionDirection;
  qualityRating: number | null;
}): ProgressionDirection {
  if (!completed || painLevel !== "none" || (qualityRating !== null && qualityRating <= 2)) return "easier";
  return progressionPreference;
}

export function prescriptionAtMaximum(
  value: ACREASessionPrescription,
  pillar: ACREAPillar,
  level: ACREALevel,
) {
  if (value.kind === "fixed") return true;
  const ladder = value.kind === "repetitions"
    ? repetitionLadder(level)
    : intervalLadder(pillar, level);
  return samePrescription(value, ladder[ladder.length - 1]);
}

function repetitionLadder(level: ACREALevel) {
  const values: ACREASessionPrescription[] = [];
  const [seriesMin, seriesMax, repetitionsMin, repetitionsMax] =
    level <= 5 ? [2, 8, 4, 8] : [6, 12, 8, 12];
  for (let series = seriesMin; series <= seriesMax; series += 1) {
    for (let repetitions = repetitionsMin; repetitions <= repetitionsMax; repetitions += 1) {
      values.push(repetitionPrescription(series, repetitions));
    }
  }
  return values;
}

function intervalLadder(pillar: ACREAPillar, level: ACREALevel) {
  const highTier = level >= 6;
  const config = pillar === "cardio"
    ? highTier
      ? { seriesMin: 4, seriesMax: 8, effortMin: 20, effortMax: 60, effortStep: 10, rests: [60, 50, 40, 30, 20] }
      : { seriesMin: 2, seriesMax: 5, effortMin: 30, effortMax: 60, effortStep: 10, rests: [60, 50, 40, 30] }
    : highTier
      ? { seriesMin: 1, seriesMax: 8, effortMin: 30, effortMax: 300, effortStep: 30, rests: [60, 30] }
      : { seriesMin: 1, seriesMax: 4, effortMin: 30, effortMax: 180, effortStep: 30, rests: [60, 30] };
  const values: ACREASessionPrescription[] = [];
  for (let series = config.seriesMin; series <= config.seriesMax; series += 1) {
    for (let effort = config.effortMin; effort <= config.effortMax; effort += config.effortStep) {
      values.push(intervalPrescription(series, effort, config.rests[0]));
    }
    for (const rest of config.rests.slice(1)) {
      values.push(intervalPrescription(series, config.effortMax, rest));
    }
  }
  return values;
}

function moveOnLadder(
  current: ACREASessionPrescription,
  ladder: ACREASessionPrescription[],
  delta: number,
) {
  const found = ladder.findIndex((candidate) => samePrescription(current, candidate));
  const index = found >= 0 ? found : 0;
  return ladder[Math.max(0, Math.min(ladder.length - 1, index + delta))];
}

function samePrescription(left: ACREASessionPrescription, right: ACREASessionPrescription) {
  return left.kind === right.kind && left.series === right.series &&
    left.repetitions === right.repetitions && left.effortSeconds === right.effortSeconds &&
    left.restSeconds === right.restSeconds;
}

function repetitionPrescription(series: number, repetitions: number): ACREASessionPrescription {
  return {
    kind: "repetitions",
    series,
    repetitions,
    effortSeconds: null,
    restSeconds: 30,
    estimatedDurationSeconds: series * repetitions * 4 + Math.max(0, series - 1) * 30,
    adaptable: true,
  };
}

function intervalPrescription(series: number, effortSeconds: number, restSeconds: number): ACREASessionPrescription {
  return {
    kind: "intervals",
    series,
    repetitions: null,
    effortSeconds,
    restSeconds,
    estimatedDurationSeconds: series * effortSeconds + Math.max(0, series - 1) * restSeconds,
    adaptable: true,
  };
}

function fixedPrescription(duration: number): ACREASessionPrescription {
  return {
    kind: "fixed",
    series: 1,
    repetitions: null,
    effortSeconds: duration,
    restSeconds: 0,
    estimatedDurationSeconds: duration,
    adaptable: false,
  };
}
