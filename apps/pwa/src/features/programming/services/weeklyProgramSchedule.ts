import * as Crypto from "expo-crypto";

import type {
  ACREAProfile,
  ACREAStructuredRestriction,
  ACREATraining,
  ACREAWeekPlan,
} from "../data/acreaSeed";
import { getIsoWeek } from "./weeklyProgramContract";

const weekdayLabels = [
  "Lundi",
  "Mardi",
  "Mercredi",
  "Jeudi",
  "Vendredi",
  "Samedi",
  "Dimanche",
] as const;

export async function computeWeeklyProgramProfileFingerprint(
  profile: ACREAProfile,
) {
  return Crypto.digestStringAsync(
    Crypto.CryptoDigestAlgorithm.SHA256,
    canonicalWeeklyProgramProfile(profile),
  );
}

export function canonicalWeeklyProgramProfile(profile: ACREAProfile) {
  return JSON.stringify({
    objectiveCode: profile.objectiveCode,
    equipmentMode: profile.equipmentMode,
    weeklyFrequency: profile.weeklyFrequency,
    sessionMinutesMin: profile.sessionMinutesMin,
    sessionMinutesMax: profile.sessionMinutesMax,
    weeklyNoveltyPercent: profile.weeklyNoveltyPercent,
    levelTestVersion: profile.levelTestVersion,
    pillarLevels: {
      strength: profile.pillarLevels.strength,
      cardio: profile.pillarLevels.cardio,
      proprioception: profile.pillarLevels.proprioception,
    },
    availableEquipment: [...new Set(profile.availableEquipment)].sort(),
    preferredWeekdays: [...new Set(profile.preferredWeekdays)].sort(
      (left, right) => left - right,
    ),
    restrictions: profile.restrictions
      .map(canonicalRestriction)
      .sort((left, right) =>
        JSON.stringify(left).localeCompare(JSON.stringify(right)),
      ),
    excludedExerciseCodes: [...new Set(profile.excludedExerciseCodes)].sort(),
  });
}

export function localIsoDate(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function nextPreferredDateAfter(date: Date, weekdays: number[]) {
  const allowed = new Set(weekdays);
  if (allowed.size === 0) return null;
  const cursor = new Date(
    date.getFullYear(),
    date.getMonth(),
    date.getDate(),
    12,
  );
  for (let offset = 1; offset <= 7; offset += 1) {
    cursor.setDate(cursor.getDate() + 1);
    const weekday = cursor.getDay() || 7;
    if (allowed.has(weekday)) return localIsoDate(cursor);
  }
  return null;
}

export function isoDateForWeekday(
  isoWeekYear: number,
  isoWeekNumber: number,
  weekday: number,
) {
  const januaryFourth = new Date(Date.UTC(isoWeekYear, 0, 4));
  const januaryFourthWeekday = januaryFourth.getUTCDay() || 7;
  januaryFourth.setUTCDate(
    januaryFourth.getUTCDate() -
      januaryFourthWeekday +
      1 +
      (isoWeekNumber - 1) * 7 +
      weekday -
      1,
  );
  return januaryFourth.toISOString().slice(0, 10);
}

export function weekdayForIsoDate(value: string) {
  const date = new Date(`${value}T12:00:00Z`);
  return date.getUTCDay() || 7;
}

export function weekdayLabel(weekday: number) {
  const label = weekdayLabels[weekday - 1];
  if (!label) throw new Error(`Jour ISO invalide: ${weekday}`);
  return label;
}

export function currentWeekDatesForWeekdays(date: Date, weekdays: number[]) {
  const week = getIsoWeek(date);
  return weekdays
    .map((weekday) => ({
      weekday,
      date: isoDateForWeekday(week.isoWeekYear, week.isoWeekNumber, weekday),
    }))
    .sort((left, right) => left.date.localeCompare(right.date));
}

export function sortTrainingsByScheduledDate(trainings: ACREATraining[]) {
  return [...trainings].sort((left, right) =>
    left.scheduledDate.localeCompare(right.scheduledDate),
  );
}

export function buildPartialRegenerationSchedule<
  T extends {
    id: number;
    scheduledDate: string;
    status: ACREATraining["status"];
    hasFeedback: boolean;
  },
>({
  effectiveDate,
  existingTrainings,
  preferredWeekdays,
  requestedAt,
  weeklyFrequency,
}: {
  effectiveDate: string;
  existingTrainings: T[];
  preferredWeekdays: number[];
  requestedAt: Date;
  weeklyFrequency: number;
}) {
  const replaceable = existingTrainings.filter(
    (training) =>
      training.scheduledDate >= effectiveDate &&
      training.status !== "terminee" &&
      !training.hasFeedback,
  );
  const replaceableIds = new Set(replaceable.map(({ id }) => id));
  const preserved = existingTrainings.filter(
    (training) => !replaceableIds.has(training.id),
  );
  const occupiedDates = new Set(
    preserved.map(({ scheduledDate }) => scheduledDate),
  );
  const remainingCount = Math.max(weeklyFrequency - preserved.length, 0);
  const slots = currentWeekDatesForWeekdays(requestedAt, preferredWeekdays)
    .filter(
      (slot) => slot.date >= effectiveDate && !occupiedDates.has(slot.date),
    )
    .slice(0, remainingCount);
  return { preserved, replaceable, slots };
}

export function assignScheduledDates(
  plan: ACREAWeekPlan,
  dates?: string[],
): ACREAWeekPlan {
  return {
    ...plan,
    trainings: plan.trainings.map((training, index) => ({
      ...training,
      scheduledDate:
        dates?.[index] ??
        isoDateForWeekday(
          plan.isoWeekYear,
          plan.isoWeekNumber,
          weekdayLabels.indexOf(
            training.day as (typeof weekdayLabels)[number],
          ) + 1,
        ),
    })),
  };
}

export function remapTrainingCodes(
  trainings: ACREATraining[],
  usedCodes: Set<string>,
) {
  const available = (
    ["T1", "T2", "T3", "T4", "T5", "T6", "T7"] as const
  ).filter((code) => !usedCodes.has(code));
  if (available.length < trainings.length) {
    throw new Error("Aucun code d'entraînement libre pour la régénération.");
  }
  return trainings.map((training, index) => ({
    ...training,
    code: available[index],
  }));
}

function canonicalRestriction(restriction: ACREAStructuredRestriction) {
  if (restriction.type === "temporaryPain") {
    return {
      ...restriction,
      muscleGroupCodes: [...new Set(restriction.muscleGroupCodes)].sort(),
    };
  }
  return restriction;
}
