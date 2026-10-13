import {
  adaptFutureExercisePrescriptions,
  excludeExerciseForProfile,
  replaceExcludedExerciseOccurrences,
  type ACREALevel,
  type ACREAPillar,
  type ACREASessionPhase,
  type ACREASessionPrescription,
} from "@features/programming";
import { withDatabase } from "@shared/db";
import * as Crypto from "expo-crypto";

import type {
  CandidateRecentStats,
  RecentWeeklyProgramStats,
  SessionPainLevel,
  SessionProgressionPreference,
  TrainingHistoryPort,
  WeeklyProgramHistory,
} from "../contracts/trainingHistory";

type RecentFeedbackRow = {
  session_template_id: number | null;
  exercise_id: number | null;
  format_id: number | null;
  status: "completed" | "stopped";
  effort_rating: number | null;
  quality_rating: number | null;
  pain_level: SessionPainLevel;
  progression_preference: SessionProgressionPreference;
};

export type SaveTrainingSessionFeedbackInput = {
  profileCode: string;
  trainingCode: string;
  seanceCode: string;
  seanceIndex: number;
  seanceTitle: string;
  sessionCode: string;
  sessionIndex: number;
  exerciseName: string;
  sessionTemplateId: number;
  exerciseId: number;
  exerciseCode: string;
  formatId: number;
  formatCode: string | null;
  formatLabel: string;
  level: ACREALevel;
  pillar: string;
  sessionPhase: ACREASessionPhase;
  prescription: ACREASessionPrescription;
  timerPlanCode: string | null;
  totalSeconds: number;
  completedSeconds: number;
  phaseCount: number;
  status: "completed" | "stopped";
  effortRating: number;
  qualityRating: number;
  appreciationRating: number | null;
  painLevel: SessionPainLevel;
  progressionPreference: SessionProgressionPreference;
};

export async function saveTrainingSessionFeedback(
  input: SaveTrainingSessionFeedbackInput,
) {
  const performedAt = new Date().toISOString();

  if (input.sessionPhase === "main" && (input.appreciationRating === null || input.appreciationRating < 1 || input.appreciationRating > 5)) {
    throw new Error("L'appréciation de 1 à 5 est obligatoire pour un exercice principal.");
  }

  const link = await withDatabase((db) =>
    db.getFirstAsync<{
        program_id: number;
        training_id: number;
        session_id: number;
      }>(
        `SELECT p.id AS program_id, t.id AS training_id, x.id AS session_id
       FROM programs p
       JOIN trainings t ON t.program_id = p.id
       JOIN seances s ON s.training_id = t.id
       JOIN sessions x ON x.seance_id = s.id
       WHERE p.profile_id = ? AND t.code = ? AND s.code = ? AND x.code = ?
       ORDER BY p.iso_week_year DESC, p.iso_week_number DESC, p.id DESC
       LIMIT 1`,
        [
          input.profileCode,
          input.trainingCode,
          input.seanceCode,
          input.sessionCode,
        ],
      ),
  );
  if (!link) throw new Error("Session persistée introuvable pour le feedback.");

  await withDatabase((db) =>
    db.withTransactionAsync(async () => {
      await db.runAsync(
        `
      INSERT INTO session_feedback (
        execution_id,
        profile_id,
        program_id,
        training_id,
        session_id,
        session_template_id,
        exercise_id,
        exercise_code,
        format_id,
        training_code,
        seance_code,
        seance_index,
        seance_title,
        session_code,
        session_index,
        exercise_name,
        format_code,
        format_label,
        level,
        pillar,
        performed_at,
        timer_plan_code,
        total_seconds,
        completed_seconds,
        phase_count,
        status,
        effort_rating,
        quality_rating,
        appreciation_rating,
        session_phase,
        executed_prescription_json,
        pain_level,
        progression_decision,
        progression_preference,
        notes
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `,
        [
          Crypto.randomUUID(),
          input.profileCode,
          link.program_id,
          link.training_id,
          link.session_id,
          input.sessionTemplateId,
          input.exerciseId,
          input.exerciseCode,
          input.formatId,
          input.trainingCode,
          input.seanceCode,
          input.seanceIndex,
          input.seanceTitle,
          input.sessionCode,
          input.sessionIndex,
          input.exerciseName,
          input.formatCode,
          input.formatLabel,
          input.level,
          input.pillar,
          performedAt,
          input.timerPlanCode,
          input.totalSeconds,
          input.completedSeconds,
          input.phaseCount,
          input.status,
          input.effortRating,
          input.qualityRating,
          input.appreciationRating,
          input.sessionPhase,
          JSON.stringify(input.prescription),
          input.painLevel,
          legacyProgressionDecisionFromPreference(input.progressionPreference),
          input.progressionPreference,
          "",
        ],
      );
    }),
  );

  if (input.sessionPhase === "main") {
    if (!isMainPillar(input.pillar)) {
      throw new Error("Pilier principal invalide pour la progression.");
    }
    await adaptFutureExercisePrescriptions({
      completed: input.status === "completed",
      currentPrescription: input.prescription,
      exerciseId: input.exerciseId,
      level: input.level,
      painLevel: input.painLevel,
      pillar: input.pillar,
      profileId: input.profileCode,
      progressionPreference: input.progressionPreference,
      qualityRating: input.qualityRating,
      trainingId: link.training_id,
    });
    if (input.appreciationRating === 1) {
      await excludeExerciseForProfile(input.profileCode, input.exerciseId);
      await replaceExcludedExerciseOccurrences({
        excludedExerciseId: input.exerciseId,
        profileId: input.profileCode,
        trainingId: link.training_id,
      });
    }
  }

  return { performedAt };
}

function isMainPillar(value: string): value is ACREAPillar {
  return value === "strength" || value === "cardio" || value === "proprioception";
}

export async function getRecentWeeklyProgramStats(
  profileCode: string,
): Promise<RecentWeeklyProgramStats> {
  return (await getRecentWeeklyProgramHistory(profileCode)).recentStats;
}

export async function getRecentWeeklyProgramHistory(
  profileCode: string,
): Promise<WeeklyProgramHistory> {
  const { rows, deferredCount } = await withDatabase(async (db) => {
    // Expo SQLite Web finalizes every shorthand query in a worker.  Keeping
    // these reads sequential avoids overlapping statement finalization on the
    // same connection while a programme is being generated or regenerated.
    const feedbackRows = await db.getAllAsync<RecentFeedbackRow>(
      `
      SELECT session_template_id, exercise_id, format_id, status,
             effort_rating, quality_rating, pain_level, progression_preference
      FROM session_feedback
      WHERE profile_id = ?
      ORDER BY performed_at DESC, id DESC
      LIMIT 100
      `,
      [profileCode],
    );
    const deferred = await db.getFirstAsync<{ count: number }>(
      `SELECT COUNT(*) AS count
         FROM (
           SELECT t.status
           FROM trainings t
           JOIN programs p ON p.id = t.program_id
           WHERE p.profile_id = ?
           ORDER BY p.iso_week_year DESC, p.iso_week_number DESC, t.sort_order DESC
           LIMIT 20
         ) recent_trainings
         WHERE status = 'reportee'`,
      [profileCode],
    );
    return {
      rows: feedbackRows,
      deferredCount: deferred?.count ?? 0,
    };
  });

  const recentStats = calculateStats(rows.slice(0, 20));
  recentStats.skippedSessions = Math.min(
    255,
    recentStats.skippedSessions + deferredCount,
  );
  const grouped = new Map<string, RecentFeedbackRow[]>();
  for (const row of rows) {
    if (
      row.session_template_id === null ||
      row.exercise_id === null ||
      row.format_id === null
    )
      continue;
    const key = `${row.session_template_id}:${row.exercise_id}:${row.format_id}`;
    const group = grouped.get(key) ?? [];
    if (group.length < 20) group.push(row);
    grouped.set(key, group);
  }

  return {
    recentStats,
    candidateRecentStats: Array.from(grouped.values()).map((group) => ({
      sessionTemplateId: group[0].session_template_id as number,
      exerciseId: group[0].exercise_id as number,
      formatId: group[0].format_id as number,
      stats: calculateStats(group),
    })),
  };
}

export const localTrainingHistoryPort: TrainingHistoryPort = {
  loadRecentWeeklyProgramHistory: getRecentWeeklyProgramHistory,
};

function calculateStats(rows: RecentFeedbackRow[]): RecentWeeklyProgramStats {
  if (rows.length === 0) {
    return {
      successRate: 0.75,
      fatigue: 0.35,
      skippedSessions: 0,
      painRate: 0,
      progressionNeeded: false,
      regressionNeeded: false,
    };
  }

  const completedCount = rows.filter(
    (row) => row.status === "completed",
  ).length;
  const stoppedCount = rows.length - completedCount;
  const painCount = rows.filter((row) => row.pain_level !== "none").length;
  const effortValues = rows.flatMap((row) =>
    row.effort_rating === null ? [] : [row.effort_rating],
  );
  const averageEffort =
    effortValues.reduce((total, value) => total + value, 0) /
    Math.max(1, effortValues.length);
  const fatigue = clamp01(
    averageEffort / 5 +
      stoppedCount / rows.length / 3 +
      painCount / rows.length / 3,
  );
  const successRate = completedCount / rows.length;
  const harderCount = rows.filter(
    (row) => row.progression_preference === "harder",
  ).length;
  const easierCount = rows.filter(
    (row) => row.progression_preference === "easier",
  ).length;
  const lowQualityCount = rows.filter(
    (row) => (row.quality_rating ?? 5) <= 2,
  ).length;

  return {
    successRate,
    fatigue,
    skippedSessions: Math.min(255, stoppedCount),
    painRate: painCount / rows.length,
    progressionNeeded:
      painCount === 0 &&
      fatigue < 0.7 &&
      successRate >= 0.8 &&
      harderCount > rows.length / 2,
    regressionNeeded:
      painCount > 0 ||
      lowQualityCount > rows.length / 3 ||
      easierCount > rows.length / 2,
  };
}

function legacyProgressionDecisionFromPreference(
  preference: SessionProgressionPreference,
) {
  if (preference === "easier") {
    return "regress";
  }

  if (preference === "same") {
    return "maintain";
  }

  return "progress";
}

function clamp01(value: number) {
  return Math.max(0, Math.min(1, value));
}
