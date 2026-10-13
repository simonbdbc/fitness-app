import { withDatabase, type LocalDatabase } from "@shared/db";
import { isSupabaseConfigured } from "@shared/config/clientConfig";
import { getSupabaseClient } from "@shared/config/supabaseClient";

import type {
  ACREAEquipmentMode,
  ACREALevel,
  ACREAPillar,
  ACREASessionPrescription,
  ACREAStructuredRestriction,
} from "../data/acreaSeed";
import {
  loadCanonicalExcludedExercises,
  loadCanonicalExerciseProgressions,
  loadCanonicalTrainingExerciseHistories,
} from "./catalogExerciseCanonicalizationRepository";
import { getWeeklyProgramCandidateSnapshot } from "./catalogProgrammingCandidates";
import {
  adaptExercisePrescription,
  initialExercisePrescription,
  prescriptionAtMaximum,
  safeProgressionDirection,
  type ProgressionDirection,
} from "./exerciseProgression";
import { mergeEvaluationAndTrainingHistories } from "./exerciseHistoryMerge";
import type {
  WeeklyProgramExerciseHistory,
  WeeklyProgramExerciseProgression,
} from "./weeklyProgramContract";

export async function loadWeeklyProgramExerciseState(profileId: string) {
  await hydrateRemoteEvaluationPreferences(profileId).catch(() => undefined);
  return withDatabase(async (db) => {
    const profile = await db.getFirstAsync<{
      level_test_version: number;
      renforcement_level: ACREALevel;
      cardio_level: ACREALevel;
      proprioception_level: ACREALevel;
    }>(
      `SELECT level_test_version, renforcement_level, cardio_level, proprioception_level
       FROM acrea_profiles WHERE profile_id = ?`,
      [profileId],
    );
    if (!profile) throw new Error("Profil ACREA introuvable pour les progressions.");
    const progressions = await loadCanonicalExerciseProgressions(
      db,
      profileId,
      profile.level_test_version,
    );
    const histories = await loadCanonicalTrainingExerciseHistories(
      db,
      profileId,
    );
    const evaluationHistories = await db.getAllAsync<{
      exercise_id: number;
      appreciation_average: number;
      evaluated_at: string;
    }>(
      `SELECT exercise.id AS exercise_id, preference.appreciation_average,
              preference.evaluated_at
         FROM acrea_level_evaluation_preferences preference
         JOIN catalog_exercises exercise
           ON exercise.code = preference.exercise_slug
         JOIN catalog_releases release ON release.id = exercise.release_id
         WHERE preference.profile_id = ?
           AND preference.protocol_version = ?
           AND exercise.is_active = 1
           AND release.status = 'active'`,
      [profileId, profile.level_test_version],
    );
    const mergedHistories = mergeEvaluationAndTrainingHistories(
      histories,
      evaluationHistories,
    );
    return {
      exerciseProgressions: progressions.map(
        ({ exercise_id, pending_direction, pillar, prescription_json }) => {
          const prescription = parsePrescription(prescription_json);
          return {
            exerciseId: exercise_id,
            prescription: pending_direction
              ? adaptExercisePrescription(
                  prescription,
                  pending_direction,
                  pillar,
                  levelForPillar(profile, pillar),
                )
              : prescription,
          };
        },
      ) satisfies WeeklyProgramExerciseProgression[],
      exerciseHistories: mergedHistories.map((row) => {
        const week = row.last_performed_at ? isoWeek(new Date(row.last_performed_at)) : null;
        return {
          exerciseId: row.exercise_id,
          appreciationAverage: row.appreciation_average,
          lastIsoWeekYear: week?.year ?? null,
          lastIsoWeekNumber: week?.number ?? null,
          reachedMaximum: row.reached_maximum === 1,
        };
      }) satisfies WeeklyProgramExerciseHistory[],
    };
  });
}

async function hydrateRemoteEvaluationPreferences(profileId: string) {
  if (!isSupabaseConfigured) return;
  const { data, error } = await getSupabaseClient()
    .from("acrea_level_evaluation_preferences")
    .select("protocol_version,evaluation_exercise_code,exercise_slug,appreciation_average,sample_count,evaluated_at")
    .eq("user_id", profileId);
  if (error) throw error;
  if (!data?.length) return;
  await withDatabase((db) =>
    db.withTransactionAsync(async () => {
      for (const row of data) {
        const exists = await db.getFirstAsync<{ code: string }>(
          "SELECT code FROM catalog_exercises WHERE code = ? LIMIT 1",
          [row.exercise_slug],
        );
        if (!exists) continue;
        await db.runAsync(
          `INSERT INTO acrea_level_evaluation_preferences (
             profile_id, protocol_version, evaluation_exercise_code, exercise_slug,
             appreciation_average, sample_count, evaluated_at, sync_status
           ) VALUES (?, ?, ?, ?, ?, ?, ?, 'synced')
           ON CONFLICT(profile_id, protocol_version, exercise_slug) DO UPDATE SET
             evaluation_exercise_code = excluded.evaluation_exercise_code,
             appreciation_average = excluded.appreciation_average,
             sample_count = excluded.sample_count,
             evaluated_at = excluded.evaluated_at,
             sync_status = 'synced'`,
          [
            profileId, row.protocol_version, row.evaluation_exercise_code,
            row.exercise_slug, row.appreciation_average, row.sample_count,
            row.evaluated_at,
          ],
        );
      }
    }),
  );
}

export async function adaptFutureExercisePrescriptions({
  completed,
  currentPrescription,
  exerciseId,
  painLevel,
  pillar,
  profileId,
  progressionPreference,
  qualityRating,
  level,
  trainingId,
}: {
  completed: boolean;
  currentPrescription: ACREASessionPrescription;
  exerciseId: number;
  painLevel: "none" | "mild" | "pain";
  pillar: ACREAPillar;
  profileId: string;
  progressionPreference: ProgressionDirection;
  qualityRating: number | null;
  level: ACREALevel;
  trainingId: number | null;
}) {
  if (!currentPrescription.adaptable) return { deferred: false, prescription: currentPrescription };
  const direction = safeProgressionDirection({ completed, painLevel, progressionPreference, qualityRating });
  const next = adaptExercisePrescription(currentPrescription, direction, pillar, level);
  if (next === currentPrescription || JSON.stringify(next) === JSON.stringify(currentPrescription)) {
    return { deferred: false, prescription: currentPrescription };
  }
  let outcome = { deferred: false, prescription: next };
  await withDatabase((db) =>
    db.withTransactionAsync(async () => {
      const profile = await db.getFirstAsync<{
        level_test_version: number;
        session_minutes_max: number;
      }>(
        `SELECT level_test_version, session_minutes_max
         FROM acrea_profiles WHERE profile_id = ?`,
        [profileId],
      );
      if (!profile) throw new Error("Profil ACREA introuvable pour la progression.");
      const futureSessions = await db.getAllAsync<{
        id: number;
        training_id: number;
        exercise_id: number;
        prescription_json: string;
      }>(
        `SELECT session.id, training.id AS training_id, session.exercise_id,
                session.prescription_json
         FROM sessions session
         JOIN seances seance ON seance.id = session.seance_id
         JOIN trainings training ON training.id = seance.training_id
         JOIN programs program ON program.id = training.program_id
         WHERE program.profile_id = ?
           AND training.status = 'a faire'
           AND session.phase = 'main'
           AND NOT EXISTS (
             SELECT 1 FROM session_feedback feedback
             WHERE feedback.session_id = session.id
           )
           AND (? IS NULL OR training.id <> ?)`,
        [profileId, trainingId, trainingId],
      );
      const totals = new Map<number, number>();
      for (const session of futureSessions) {
        const prescription = session.exercise_id === exerciseId ? next : parsePrescription(session.prescription_json);
        totals.set(session.training_id, (totals.get(session.training_id) ?? 600) + prescription.estimatedDurationSeconds + 90);
      }
      const exceedsMaximum = [...totals.values()].some((seconds) => seconds > profile.session_minutes_max * 60);
      const now = new Date().toISOString();
      await db.runAsync(
        `INSERT INTO acrea_exercise_progressions (
           profile_id, exercise_id, prescription_json, reached_maximum,
           pending_direction, last_progression_at, level_evaluation_version, updated_at
         ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT(profile_id, exercise_id) DO UPDATE SET
           prescription_json = excluded.prescription_json,
           reached_maximum = excluded.reached_maximum,
           pending_direction = excluded.pending_direction,
           last_progression_at = excluded.last_progression_at,
           level_evaluation_version = excluded.level_evaluation_version,
           updated_at = excluded.updated_at`,
        [
          profileId,
          exerciseId,
          JSON.stringify(exceedsMaximum ? currentPrescription : next),
          prescriptionAtMaximum(exceedsMaximum ? currentPrescription : next, pillar, level) ? 1 : 0,
          exceedsMaximum ? direction : null,
          exceedsMaximum ? null : now,
          profile.level_test_version,
          now,
        ],
      );
      if (!exceedsMaximum) {
        const format = await resolvePersistedFormat(db, next);
        await db.runAsync(
          `UPDATE sessions SET prescription_json = ?, format_id = ?,
             format_code = ?, format_label = ?, updated_at = ?
           WHERE exercise_id = ? AND phase = 'main' AND seance_id IN (
             SELECT seance.id FROM seances seance
             JOIN trainings training ON training.id = seance.training_id
             JOIN programs program ON program.id = training.program_id
             WHERE program.profile_id = ? AND training.status = 'a faire'
               AND NOT EXISTS (
                 SELECT 1 FROM session_feedback feedback
                 WHERE feedback.session_id = sessions.id
               )
               AND (? IS NULL OR training.id <> ?)
           )`,
          [
            JSON.stringify(next),
            format.id,
            format.code,
            format.label,
            now,
            exerciseId,
            profileId,
            trainingId,
            trainingId,
          ],
        );
      }
      outcome = { deferred: exceedsMaximum, prescription: exceedsMaximum ? currentPrescription : next };
    }),
  );
  return outcome;
}

export async function excludeExerciseForProfile(
  profileId: string,
  exerciseId: number,
) {
  const now = new Date().toISOString();
  await withDatabase((db) =>
    db.runAsync(
      `INSERT INTO acrea_profile_excluded_exercises
         (profile_id, exercise_id, reason, excluded_at)
       VALUES (?, ?, 'appreciation', ?)
       ON CONFLICT(profile_id, exercise_id) DO UPDATE SET
         reason = 'appreciation', excluded_at = excluded.excluded_at`,
      [profileId, exerciseId, now],
    ),
  );
}

export async function replaceExcludedExerciseOccurrences({
  excludedExerciseId,
  profileId,
  trainingId,
}: {
  excludedExerciseId: number;
  profileId: string;
  trainingId: number | null;
}) {
  const catalog = await getWeeklyProgramCandidateSnapshot();
  await withDatabase((db) =>
    db.withTransactionAsync(async () => {
      const context = await db.getFirstAsync<{
        pillar: "strength" | "cardio" | "proprioception";
        level: number;
        prescription_json: string;
      }>(
        `SELECT seance.pillar, session.level, session.prescription_json
         FROM sessions session
         JOIN seances seance ON seance.id = session.seance_id
         JOIN trainings training ON training.id = seance.training_id
         JOIN programs program ON program.id = training.program_id
         WHERE program.profile_id = ? AND session.exercise_id = ?
           AND session.phase = 'main'
         ORDER BY training.scheduled_date DESC, session.id DESC LIMIT 1`,
        [profileId, excludedExerciseId],
      );
      if (!context?.pillar) return;
      // Expo SQLite Web finalizes shorthand queries on a shared worker. Keep
      // the reads ordered while replacing a programme exercise.
      const equipmentRows = await db.getAllAsync<{ code: string }>(
        `SELECT equipment.code FROM acrea_profile_equipment inventory
         JOIN catalog_equipment equipment ON equipment.id = inventory.equipment_id
         WHERE inventory.profile_id = ?`,
        [profileId],
      );
      const excludedRows = await loadCanonicalExcludedExercises(db, profileId);
      const restrictionRows = await db.getAllAsync<{ payload_json: string }>(
        "SELECT payload_json FROM acrea_profile_restrictions WHERE profile_id = ? ORDER BY id",
        [profileId],
      );
      const profile = await db.getFirstAsync<{
        equipment_mode: ACREAEquipmentMode;
        renforcement_level: number;
        cardio_level: number;
        proprioception_level: number;
      }>(
        `SELECT equipment_mode, renforcement_level, cardio_level,
                proprioception_level
         FROM acrea_profiles WHERE profile_id = ?`,
        [profileId],
      );
      if (!profile) throw new Error("Profil ACREA introuvable pour le remplacement.");
      const equipment = new Set(equipmentRows.map(({ code }) => code));
      const excluded = new Set(excludedRows.map(({ exercise_id }) => exercise_id));
      const restrictions = restrictionRows.map(({ payload_json }) =>
        JSON.parse(payload_json) as ACREAStructuredRestriction,
      );
      const profileLevel =
        context.pillar === "strength"
          ? profile.renforcement_level
          : context.pillar === "cardio"
            ? profile.cardio_level
            : profile.proprioception_level;
      const currentDuration = parsePrescription(context.prescription_json).estimatedDurationSeconds;
      const replacement = catalog.candidates
        .filter((candidate) =>
          candidate.phase === "main" &&
          candidate.pillar === context.pillar &&
          !excluded.has(candidate.exerciseId) &&
          Math.abs(candidate.level - profileLevel) <= 1 &&
          candidate.equipmentOptions.some((option) =>
            option.kind === "bodyweight" ||
            (profile.equipment_mode === "mixte" &&
              option.equipmentCodes.every((code) => equipment.has(code))),
          ) &&
          restrictions.every((restriction) => candidateMeetsRestriction(candidate, restriction, equipment)),
        )
        .map((candidate) => ({
          candidate,
          prescription: initialExercisePrescription(
            candidate.prescriptionKind,
            context.pillar,
            Math.max(1, Math.min(10, context.level)) as ACREALevel,
          ),
        }))
        .filter(({ prescription }) => prescription.estimatedDurationSeconds <= currentDuration)
        .sort((left, right) =>
          Number(right.candidate.completeExerciseSheet) -
            Number(left.candidate.completeExerciseSheet) ||
          Math.abs(left.candidate.level - context.level) - Math.abs(right.candidate.level - context.level) ||
          left.candidate.sessionTemplateId - right.candidate.sessionTemplateId ||
          left.candidate.exerciseId - right.candidate.exerciseId ||
          left.candidate.formatId - right.candidate.formatId,
        )[0];
      if (!replacement) throw new Error(`Aucun remplacement sûr disponible pour le pilier ${context.pillar}.`);
      const replacementFormat = await resolvePersistedFormat(
        db,
        replacement.prescription,
      );
      const now = new Date().toISOString();
      await db.runAsync(
        `UPDATE sessions SET
           session_template_id = ?, exercise_id = ?, exercise_code = ?,
           exercise_name = ?, format_id = ?, format_code = ?, format_label = ?,
           level = ?, prescription_json = ?, updated_at = ?
         WHERE exercise_id = ? AND phase = 'main' AND seance_id IN (
           SELECT seance.id FROM seances seance
           JOIN trainings training ON training.id = seance.training_id
           JOIN programs program ON program.id = training.program_id
           WHERE program.profile_id = ? AND training.status = 'a faire'
             AND NOT EXISTS (
               SELECT 1 FROM session_feedback feedback
               WHERE feedback.session_id = sessions.id
             )
             AND (? IS NULL OR training.id <> ?)
         )`,
        [
          replacement.candidate.sessionTemplateId,
          replacement.candidate.exerciseId,
          replacement.candidate.exerciseCode,
          replacement.candidate.exerciseName,
          replacementFormat.id,
          replacementFormat.code,
          replacementFormat.label,
          replacement.candidate.level,
          JSON.stringify(replacement.prescription),
          now,
          excludedExerciseId,
          profileId,
          trainingId,
          trainingId,
        ],
      );
    }),
  );
}

function parsePrescription(value: string): ACREASessionPrescription {
  const parsed = JSON.parse(value) as ACREASessionPrescription;
  if (!parsed || !Number.isInteger(parsed.estimatedDurationSeconds) || typeof parsed.adaptable !== "boolean") {
    throw new Error("Prescription persistée invalide.");
  }
  return parsed;
}

async function resolvePersistedFormat(
  db: LocalDatabase,
  prescription: ACREASessionPrescription,
) {
  const expectedType = prescription.kind === "repetitions" ? "repetitions" : "intervalles";
  const expectedRest = prescription.kind === "fixed" ? 30 : prescription.restSeconds;
  const format = await db.getFirstAsync<{ id: number; code: string; label: string }>(
    `SELECT format.id, format.code, format.label
     FROM catalog_formats format
     JOIN catalog_series series_row ON series_row.id = format.series_id
     JOIN catalog_rests rest_row ON rest_row.id = format.rest_id
     LEFT JOIN catalog_repetitions repetitions ON repetitions.id = format.repetitions_id
     LEFT JOIN catalog_intervals interval_row ON interval_row.id = format.interval_id
     WHERE format.source_status = 'seed base formats metier'
       AND format.format_type = ? AND series_row.series = ?
       AND rest_row.rest_seconds = ?
       AND ((? = 'repetitions' AND repetitions.reps = ?)
         OR (? <> 'repetitions' AND interval_row.effort_seconds = ?))
     LIMIT 1`,
    [
      expectedType,
      prescription.series,
      expectedRest,
      prescription.kind,
      prescription.repetitions,
      prescription.kind,
      prescription.effortSeconds,
    ],
  );
  if (!format) {
    throw new Error("La prescription adaptée ne correspond à aucun format canonique.");
  }
  return format;
}

function candidateMeetsRestriction(
  candidate: Awaited<ReturnType<typeof getWeeklyProgramCandidateSnapshot>>["candidates"][number],
  restriction: ACREAStructuredRestriction,
  equipment: Set<string>,
) {
  switch (restriction.type) {
    case "impactLimit":
      return impactRank(candidate.impactCode) <= impactRank(restriction.maximumImpact);
    case "exerciseExclusion":
      return candidate.exerciseCode !== restriction.exerciseCode;
    case "pillarLimit":
      return candidate.pillar !== restriction.pillar || candidate.level <= restriction.maximumLevel;
    case "equipmentExclusion":
      return candidate.equipmentOptions.some(
        (option) =>
          option.kind === "bodyweight" ||
          (!option.equipmentCodes.includes(restriction.equipmentCode) &&
            option.equipmentCodes.every((code) => equipment.has(code))),
      );
    case "temporaryPain":
      return !candidate.muscleGroupCodes.some((code) => restriction.muscleGroupCodes.includes(code));
  }
}

function impactRank(value: string) {
  if (value === "faible") return 0;
  if (value === "modere") return 1;
  if (value === "eleve") return 2;
  return Number.POSITIVE_INFINITY;
}

function levelForPillar(
  profile: {
    renforcement_level: ACREALevel;
    cardio_level: ACREALevel;
    proprioception_level: ACREALevel;
  },
  pillar: ACREAPillar,
) {
  return pillar === "strength"
    ? profile.renforcement_level
    : pillar === "cardio"
      ? profile.cardio_level
      : profile.proprioception_level;
}

function isoWeek(date: Date) {
  const utc = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const day = utc.getUTCDay() || 7;
  utc.setUTCDate(utc.getUTCDate() + 4 - day);
  const start = new Date(Date.UTC(utc.getUTCFullYear(), 0, 1));
  return {
    year: utc.getUTCFullYear(),
    number: Math.ceil(((utc.getTime() - start.getTime()) / 86_400_000 + 1) / 7),
  };
}
