import {
  acreaEntryTestExercises,
  type ACREAEntryTestExerciseCode,
  acreaLevelEvaluationProtocolVersion,
  type ACREAPillar,
  type ACREAPillarLevels,
  exerciseSlugForACREALevelEvaluationProtocol,
  type ACREALevelEvaluationProtocolVersion,
} from "@features/programming";
import { isSupabaseConfigured } from "@shared/config/clientConfig";
import { getSupabaseClient } from "@shared/config/supabaseClient";
import { withDatabase, type LocalDatabase } from "@shared/db";

import {
  assertValidEvaluationFeedback,
  levelForStrictMaximum,
  prescriptionForEvaluationPhase,
  type EvaluationPrescription,
} from "../domain/levelTestProtocol";
import { resolveLevelTestProtocolVersionWithDatabase } from "./levelTestProtocolSelector";

export { resolveLevelTestProtocolVersionWithDatabase } from "./levelTestProtocolSelector";

export const levelTestProtocolVersion = acreaLevelEvaluationProtocolVersion;
export const levelEvaluationStepCount = 13;
const supportedLevelTestProtocolVersions = [3, 4] as const;

export type LevelEvaluationPhase = 1 | 2 | 3;
export type LevelEvaluationSessionStatus = "in_progress" | "passed" | "failed";

export type PersistedLevelEvaluationResult = {
  appreciationRating: number;
  attemptedAt: string;
  completedSeconds: number;
  exerciseCode: ACREAEntryTestExerciseCode;
  maximumRepetitions: number | null;
  prescription: EvaluationPrescription;
  technicalValid: boolean;
  timerPlanCode: string;
  totalSeconds: number;
};

export type PersistedLevelEvaluationSession = {
  activeStepIndex: number;
  completedAt: string | null;
  id: number;
  phase: LevelEvaluationPhase;
  results: PersistedLevelEvaluationResult[];
  runNumber: number;
  startedAt: string;
  status: LevelEvaluationSessionStatus;
};

export type PersistedLevelTestState = {
  attemptId: number;
  attemptKind: "initial" | "retest";
  protocolVersion: ACREALevelEvaluationProtocolVersion;
  sessions: PersistedLevelEvaluationSession[];
  startedAt: string;
};

type EvaluationAttemptRow = {
  attempt_kind: "initial" | "retest";
  id: number;
  protocol_version: ACREALevelEvaluationProtocolVersion;
  started_at: string;
};

type EvaluationSessionRow = {
  active_step_index: number;
  completed_at: string | null;
  id: number;
  phase: LevelEvaluationPhase;
  run_number: number;
  started_at: string;
  status: LevelEvaluationSessionStatus;
};

type EvaluationResultRow = {
  appreciation_rating: number;
  attempted_at: string;
  completed_seconds: number;
  evaluation_session_id: number;
  exercise_code: ACREAEntryTestExerciseCode;
  maximum_repetitions: number | null;
  prescription_json: string;
  technical_valid: number;
  timer_plan_code: string;
  total_seconds: number;
};

export async function loadLevelTestState(
  profileId: string,
): Promise<PersistedLevelTestState | null> {
  return withDatabase(async (db) => {
    const attempts = await db.getAllAsync<EvaluationAttemptRow>(
      `SELECT id, protocol_version, attempt_kind, started_at
       FROM acrea_level_evaluation_attempts
       WHERE profile_id = ?
         AND protocol_version IN (3, 4)
         AND status = 'in_progress'
       ORDER BY started_at DESC, id DESC
       LIMIT 2`,
      [profileId],
    );
    if (attempts.length > 1) {
      throw new Error(
        "Plusieurs évaluations ACREA actives existent pour ce profil.",
      );
    }
    const attempt = attempts[0];
    if (!attempt) return null;

    const sessions = await db.getAllAsync<EvaluationSessionRow>(
      `SELECT id, phase, run_number, status, active_step_index,
              started_at, completed_at
       FROM acrea_level_evaluation_sessions
       WHERE attempt_id = ?
       ORDER BY phase, run_number, id`,
      [attempt.id],
    );
    const results = await db.getAllAsync<EvaluationResultRow>(
      `SELECT result.evaluation_session_id, result.exercise_code,
              result.maximum_repetitions, result.technical_valid,
              result.appreciation_rating, result.prescription_json,
              result.timer_plan_code, result.total_seconds,
              result.completed_seconds, result.attempted_at
       FROM acrea_level_evaluation_results result
       JOIN acrea_level_evaluation_sessions session
         ON session.id = result.evaluation_session_id
       WHERE session.attempt_id = ?
       ORDER BY session.phase, session.run_number, result.exercise_order`,
      [attempt.id],
    );

    return {
      attemptId: attempt.id,
      attemptKind: attempt.attempt_kind,
      protocolVersion: attempt.protocol_version,
      sessions: sessions.map((session) => ({
        activeStepIndex: session.active_step_index,
        completedAt: session.completed_at,
        id: session.id,
        phase: session.phase,
        results: results
          .filter((result) => result.evaluation_session_id === session.id)
          .map(mapEvaluationResult),
        runNumber: session.run_number,
        startedAt: session.started_at,
        status: session.status,
      })),
      startedAt: attempt.started_at,
    };
  });
}

export async function startLevelTest(
  profileId: string,
  attemptKind: "initial" | "retest",
): Promise<PersistedLevelTestState> {
  const existing = await loadLevelTestState(profileId);
  if (existing) return existing;

  const startedAt = new Date().toISOString();
  const started = await withDatabase(async (db) => {
    const result: {
      attemptId: number;
      protocolVersion: ACREALevelEvaluationProtocolVersion;
    } = {
      attemptId: 0,
      protocolVersion: 3,
    };
    await db.withTransactionAsync(async () => {
      const activeAttempts = await db.getAllAsync<{ id: number }>(
        `SELECT id
         FROM acrea_level_evaluation_attempts
         WHERE profile_id = ?
           AND protocol_version IN (3, 4)
           AND status = 'in_progress'
         LIMIT 2`,
        [profileId],
      );
      if (activeAttempts.length > 0) {
        throw new Error(
          "Une évaluation ACREA est déjà active pour ce profil.",
        );
      }
      const protocolVersion =
        await resolveLevelTestProtocolVersionWithDatabase(db);
      const insertion = await db.runAsync(
        `INSERT INTO acrea_level_evaluation_attempts
           (profile_id, protocol_version, attempt_kind, status, started_at)
         VALUES (?, ?, ?, 'in_progress', ?)`,
        [profileId, protocolVersion, attemptKind, startedAt],
      );
      result.attemptId = insertion.lastInsertRowId;
      result.protocolVersion = protocolVersion;
    });
    if (result.attemptId <= 0) {
      throw new Error("Création de l’évaluation interrompue.");
    }
    return result;
  });
  return {
    attemptId: started.attemptId,
    attemptKind,
    protocolVersion: started.protocolVersion,
    sessions: [],
    startedAt,
  };
}

export async function resolveLevelTestProtocolVersion() {
  return withDatabase(resolveLevelTestProtocolVersionWithDatabase);
}

export async function startLevelEvaluationSession(
  attemptId: number,
  phase: LevelEvaluationPhase,
) {
  let sessionId: number | null = null;
  await withDatabase((db) =>
    db.withTransactionAsync(async () => {
      const attempt = await db.getFirstAsync<{ id: number }>(
        `SELECT id FROM acrea_level_evaluation_attempts
         WHERE id = ?
           AND protocol_version IN (3, 4)
           AND status = 'in_progress'`,
        [attemptId],
      );
      if (!attempt) throw new Error("Évaluation inactive.");

      const active = await db.getFirstAsync<{ id: number }>(
        `SELECT id FROM acrea_level_evaluation_sessions
         WHERE attempt_id = ? AND status = 'in_progress' LIMIT 1`,
        [attemptId],
      );
      if (active) throw new Error("Une séance d’évaluation est déjà en cours.");

      const requiredPhase = await nextRequiredPhaseInDatabase(db, attemptId);
      if (requiredPhase !== phase) {
        throw new Error(`La séance ${requiredPhase} doit être validée en premier.`);
      }
      const lastRun = await db.getFirstAsync<{ value: number }>(
        `SELECT COALESCE(MAX(run_number), 0) AS value
         FROM acrea_level_evaluation_sessions
         WHERE attempt_id = ? AND phase = ?`,
        [attemptId, phase],
      );
      const startedAt = new Date().toISOString();
      const result = await db.runAsync(
        `INSERT INTO acrea_level_evaluation_sessions (
           attempt_id, phase, run_number, status, active_step_index, started_at
         ) VALUES (?, ?, ?, 'in_progress', 0, ?)`,
        [attemptId, phase, (lastRun?.value ?? 0) + 1, startedAt],
      );
      sessionId = result.lastInsertRowId;
      await db.runAsync(
        `UPDATE acrea_level_evaluation_attempts
         SET sync_status = 'pending' WHERE id = ?`,
        [attemptId],
      );
    }),
  );
  if (sessionId === null) throw new Error("Création de la séance interrompue.");
  return sessionId;
}

export async function updateLevelEvaluationSessionStep(
  evaluationSessionId: number,
  activeStepIndex: number,
) {
  if (
    !Number.isInteger(activeStepIndex) ||
    activeStepIndex < 0 ||
    activeStepIndex >= levelEvaluationStepCount
  ) {
    throw new Error("Étape d’évaluation invalide.");
  }
  let changes = 0;
  await withDatabase((db) =>
    db.withTransactionAsync(async () => {
      const result = await db.runAsync(
        `UPDATE acrea_level_evaluation_sessions
         SET active_step_index = ?
         WHERE id = ? AND status = 'in_progress'`,
        [activeStepIndex, evaluationSessionId],
      );
      changes = result.changes;
      if (changes === 1) {
        await markEvaluationAttemptPendingForSession(db, evaluationSessionId);
      }
    }),
  );
  if (changes !== 1) throw new Error("Séance d’évaluation inactive.");
}

export async function recordLevelEvaluationResult({
  appreciationRating,
  completedSeconds,
  evaluationSessionId,
  exerciseCode,
  maximumRepetitions,
  nextStepIndex,
  technicalValid,
  timerPlanCode,
  totalSeconds,
}: {
  appreciationRating: number;
  completedSeconds: number;
  evaluationSessionId: number;
  exerciseCode: ACREAEntryTestExerciseCode;
  maximumRepetitions?: number;
  nextStepIndex: number;
  technicalValid: boolean;
  timerPlanCode: string;
  totalSeconds: number;
}) {
  const exerciseOrder = acreaEntryTestExercises.findIndex(
    (exercise) => exercise.code === exerciseCode,
  );
  const exercise = acreaEntryTestExercises[exerciseOrder];
  if (!exercise) throw new Error("Exercice d’évaluation inconnu.");
  if (!timerPlanCode.trim()) throw new Error("Plan de minuteur manquant.");
  if (!Number.isInteger(nextStepIndex) || nextStepIndex < 0 || nextStepIndex >= levelEvaluationStepCount) {
    throw new Error("Étape suivante invalide.");
  }
  if (!Number.isInteger(totalSeconds) || totalSeconds < 0 || !Number.isInteger(completedSeconds) || completedSeconds < 0) {
    throw new Error("Durée d’évaluation invalide.");
  }

  const attemptedAt = new Date().toISOString();
  await withDatabase((db) =>
    db.withTransactionAsync(async () => {
      const session = await db.getFirstAsync<{ phase: LevelEvaluationPhase }>(
        `SELECT phase FROM acrea_level_evaluation_sessions
         WHERE id = ? AND status = 'in_progress'`,
        [evaluationSessionId],
      );
      if (!session) throw new Error("Séance d’évaluation inactive.");
      const prescription = prescriptionForPhase(session.phase, exerciseCode);
      assertValidEvaluationFeedback(session.phase, {
        appreciationRating,
        maximumRepetitions,
        technicalValid,
      });

      await db.runAsync(
        `INSERT INTO acrea_level_evaluation_results (
           evaluation_session_id, exercise_code, pillar, exercise_order,
           target_series, target_repetitions, maximum_repetitions,
           technical_valid, appreciation_rating, prescription_json,
           timer_plan_code, total_seconds, completed_seconds, attempted_at
         ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT(evaluation_session_id, exercise_code) DO UPDATE SET
           maximum_repetitions = excluded.maximum_repetitions,
           technical_valid = excluded.technical_valid,
           appreciation_rating = excluded.appreciation_rating,
           prescription_json = excluded.prescription_json,
           timer_plan_code = excluded.timer_plan_code,
           total_seconds = excluded.total_seconds,
           completed_seconds = excluded.completed_seconds,
           attempted_at = excluded.attempted_at`,
        [
          evaluationSessionId,
          exerciseCode,
          exercise.pillar,
          exerciseOrder + 1,
          prescription.series,
          prescription.repetitions,
          session.phase === 3 ? (maximumRepetitions ?? null) : null,
          technicalValid ? 1 : 0,
          appreciationRating,
          JSON.stringify(prescription),
          timerPlanCode,
          totalSeconds,
          completedSeconds,
          attemptedAt,
        ],
      );
      await db.runAsync(
        `UPDATE acrea_level_evaluation_sessions
         SET active_step_index = ?
         WHERE id = ? AND status = 'in_progress'`,
        [nextStepIndex, evaluationSessionId],
      );
      await markEvaluationAttemptPendingForSession(db, evaluationSessionId);
    }),
  );
}

export async function completeLevelEvaluationSession(
  evaluationSessionId: number,
) {
  let passed = false;
  await withDatabase((db) =>
    db.withTransactionAsync(async () => {
      const session = await db.getFirstAsync<{ id: number }>(
        `SELECT id FROM acrea_level_evaluation_sessions
         WHERE id = ? AND status = 'in_progress'`,
        [evaluationSessionId],
      );
      if (!session) throw new Error("Séance d’évaluation inactive.");
      const summary = await db.getFirstAsync<{
        count: number;
        valid_count: number;
      }>(
        `SELECT COUNT(*) AS count,
                SUM(CASE WHEN technical_valid = 1 THEN 1 ELSE 0 END) AS valid_count
         FROM acrea_level_evaluation_results
         WHERE evaluation_session_id = ?`,
        [evaluationSessionId],
      );
      if (summary?.count !== acreaEntryTestExercises.length) {
        throw new Error("Les six exercices doivent être enregistrés.");
      }
      passed = summary.valid_count === acreaEntryTestExercises.length;
      await db.runAsync(
        `UPDATE acrea_level_evaluation_sessions
         SET status = ?, active_step_index = 12, completed_at = ?
         WHERE id = ?`,
        [passed ? "passed" : "failed", new Date().toISOString(), evaluationSessionId],
      );
      await markEvaluationAttemptPendingForSession(db, evaluationSessionId);
    }),
  );
  return { passed };
}

export async function finalizeLevelTest(
  profileId: string,
  attemptId: number,
): Promise<{
  pillarLevels: ACREAPillarLevels;
  completedAt: string;
  profileUpdated: boolean;
  protocolVersion: ACREALevelEvaluationProtocolVersion;
}> {
  let finalized: {
    pillarLevels: ACREAPillarLevels;
    completedAt: string;
    profileUpdated: boolean;
    protocolVersion: ACREALevelEvaluationProtocolVersion;
  } | null = null;
  await withDatabase((db) =>
    db.withTransactionAsync(async () => {
      const attempt = await db.getFirstAsync<{
        id: number;
        protocol_version: ACREALevelEvaluationProtocolVersion;
      }>(
        `SELECT id, protocol_version
         FROM acrea_level_evaluation_attempts
         WHERE id = ? AND profile_id = ?
           AND protocol_version IN (3, 4)
           AND status = 'in_progress'`,
        [attemptId, profileId],
      );
      if (!attempt) throw new Error("Évaluation inactive.");
      const protocolVersion = requireSupportedProtocolVersion(
        attempt.protocol_version,
      );

      for (const phase of [1, 2, 3] as const) {
        const passed = await latestPassedSessionId(db, attemptId, phase);
        if (!passed) throw new Error(`La séance ${phase} doit être validée.`);
        const validResults = await db.getFirstAsync<{ count: number }>(
          `SELECT COUNT(*) AS count
           FROM acrea_level_evaluation_results
           WHERE evaluation_session_id = ? AND technical_valid = 1`,
          [passed],
        );
        if (validResults?.count !== acreaEntryTestExercises.length) {
          throw new Error(`La séance ${phase} ne contient pas six validations techniques.`);
        }
      }
      const phaseThreeSessionId = await latestPassedSessionId(db, attemptId, 3);
      if (!phaseThreeSessionId) throw new Error("La séance maximale est manquante.");
      const maxima = await db.getAllAsync<{
        exercise_code: ACREAEntryTestExerciseCode;
        maximum_repetitions: number | null;
      }>(
        `SELECT exercise_code, maximum_repetitions
         FROM acrea_level_evaluation_results
         WHERE evaluation_session_id = ? AND technical_valid = 1`,
        [phaseThreeSessionId],
      );
      if (maxima.length !== acreaEntryTestExercises.length) {
        throw new Error("Six maximums stricts sont requis.");
      }

      const levelsByPillar = new Map<ACREAPillar, number[]>();
      for (const exercise of acreaEntryTestExercises) {
        const maximum = maxima.find(
          (result) => result.exercise_code === exercise.code,
        )?.maximum_repetitions;
        if (maximum === null || maximum === undefined) {
          throw new Error(`${exercise.shortName}: maximum strict manquant.`);
        }
        const levels = levelsByPillar.get(exercise.pillar) ?? [];
        levels.push(levelForStrictMaximum(exercise.code, maximum));
        levelsByPillar.set(exercise.pillar, levels);
      }
      const pillarLevels: ACREAPillarLevels = {
        strength: Math.min(...requireTwoLevels(levelsByPillar, "strength")) as ACREAPillarLevels["strength"],
        cardio: Math.min(...requireTwoLevels(levelsByPillar, "cardio")) as ACREAPillarLevels["cardio"],
        proprioception: Math.min(...requireTwoLevels(levelsByPillar, "proprioception")) as ACREAPillarLevels["proprioception"],
      };
      const completedAt = new Date().toISOString();
      await db.runAsync(
        `UPDATE acrea_level_evaluation_attempts
         SET status = 'completed', completed_at = ?, sync_status = 'pending'
         WHERE id = ?`,
        [completedAt, attemptId],
      );
      const update = await db.runAsync(
        `UPDATE acrea_profiles
         SET renforcement_level = ?, cardio_level = ?, proprioception_level = ?,
             level_test_status = 'completed',
             level_test_version = ?,
             level_test_completed_at = ?, updated_at = ?
         WHERE profile_id = ?
           AND level_test_version <= ?`,
        [
          pillarLevels.strength,
          pillarLevels.cardio,
          pillarLevels.proprioception,
          protocolVersion,
          completedAt,
          completedAt,
          profileId,
          protocolVersion,
        ],
      );
      const profileExists = await db.getFirstAsync<{ exists_flag: number }>(
        "SELECT 1 AS exists_flag FROM acrea_profiles WHERE profile_id = ?",
        [profileId],
      );
      if (!profileExists) throw new Error("Profil ACREA introuvable.");
      const profileUpdated = update.changes === 1;
      const appreciationRows = await db.getAllAsync<{
        appreciation_average: number;
        exercise_code: ACREAEntryTestExerciseCode;
        sample_count: number;
      }>(
        `SELECT result.exercise_code,
                AVG(result.appreciation_rating) AS appreciation_average,
                COUNT(*) AS sample_count
         FROM acrea_level_evaluation_results result
         JOIN acrea_level_evaluation_sessions session
           ON session.id = result.evaluation_session_id
         WHERE session.attempt_id = ? AND session.status = 'passed'
         GROUP BY result.exercise_code`,
        [attemptId],
      );
      if (
        appreciationRows.length !== acreaEntryTestExercises.length ||
        appreciationRows.some(({ sample_count }) => sample_count !== 3)
      ) {
        throw new Error("Les appréciations des trois séances sont requises.");
      }
      for (const row of appreciationRows) {
        const exercise = acreaEntryTestExercises.find(({ code }) => code === row.exercise_code);
        if (!exercise) throw new Error(`Exercice d’évaluation inconnu: ${row.exercise_code}.`);
        await db.runAsync(
          `INSERT INTO acrea_level_evaluation_preferences (
             profile_id, protocol_version, evaluation_exercise_code,
             exercise_slug, appreciation_average, sample_count,
             evaluated_at, sync_status
           ) VALUES (?, ?, ?, ?, ?, ?, ?, 'pending')
           ON CONFLICT(profile_id, protocol_version, exercise_slug)
           DO UPDATE SET
             evaluation_exercise_code = excluded.evaluation_exercise_code,
             appreciation_average = excluded.appreciation_average,
             sample_count = excluded.sample_count,
             evaluated_at = excluded.evaluated_at,
             sync_status = 'pending'`,
          [
            profileId,
            protocolVersion,
            exercise.code,
            exerciseSlugForACREALevelEvaluationProtocol(
              protocolVersion,
              exercise.code,
            ),
            row.appreciation_average,
            row.sample_count,
            completedAt,
          ],
        );
      }
      finalized = {
        pillarLevels,
        completedAt,
        profileUpdated,
        protocolVersion,
      };
    }),
  );
  if (!finalized) throw new Error("Finalisation de l’évaluation interrompue.");
  return finalized;
}

export async function syncLevelTestAttempt(profileId: string, attemptId: number) {
  try {
    await syncLevelTestAttemptRemote(profileId, attemptId);
    await updateLocalEvaluationSyncStatus(attemptId, "synced");
  } catch (error) {
    await updateLocalEvaluationSyncStatus(attemptId, "failed");
    throw error;
  }
}

export async function syncPendingLevelEvaluationAttempts(profileId: string) {
  if (!isSupabaseConfigured) return;
  const pendingAttempts = await withDatabase((db) =>
    db.getAllAsync<{ id: number }>(
      `SELECT id FROM acrea_level_evaluation_attempts
       WHERE profile_id = ? AND sync_status <> 'synced'
       ORDER BY started_at, id`,
      [profileId],
    ),
  );
  for (const attempt of pendingAttempts) {
    await syncLevelTestAttempt(profileId, attempt.id);
  }
}

async function syncLevelTestAttemptRemote(profileId: string, attemptId: number) {
  if (!isSupabaseConfigured) return;
  const snapshot = await loadEvaluationSyncSnapshot(profileId, attemptId);
  const client = getSupabaseClient();
  let remoteAttemptId = snapshot.attempt.remote_attempt_id;

  if (remoteAttemptId === null) {
    const { data, error } = await client
      .from("acrea_level_evaluation_attempts")
      .insert({
        user_id: profileId,
        protocol_version: snapshot.attempt.protocol_version,
        attempt_kind: snapshot.attempt.attempt_kind,
        status: "in_progress",
        ...(snapshot.attempt.protocol_version === 4
          ? {}
          : { started_at: snapshot.attempt.started_at }),
      })
      .select("id")
      .single<{ id: number }>();
    if (error) throw error;
    remoteAttemptId = Number(data.id);
    await withDatabase((db) =>
      db.runAsync(
        "UPDATE acrea_level_evaluation_attempts SET remote_attempt_id = ? WHERE id = ?",
        [remoteAttemptId, attemptId],
      ),
    );
  }

  for (const session of snapshot.sessions) {
    let remoteSessionId = session.remote_session_id;
    if (remoteSessionId === null) {
      const { data, error } = await client
        .from("acrea_level_evaluation_sessions")
        .upsert(
          {
            attempt_id: remoteAttemptId,
            phase: session.phase,
            run_number: session.run_number,
            status: session.status,
            active_step_index: session.active_step_index,
            started_at: session.started_at,
            completed_at: session.completed_at,
          },
          { onConflict: "attempt_id,phase,run_number" },
        )
        .select("id")
        .single<{ id: number }>();
      if (error) throw error;
      remoteSessionId = Number(data.id);
      await withDatabase((db) =>
        db.runAsync(
          "UPDATE acrea_level_evaluation_sessions SET remote_session_id = ? WHERE id = ?",
          [remoteSessionId, session.id],
        ),
      );
    } else {
      const { error } = await client
        .from("acrea_level_evaluation_sessions")
        .update({
          status: session.status,
          active_step_index: session.active_step_index,
          completed_at: session.completed_at,
        })
        .eq("id", remoteSessionId)
        .eq("attempt_id", remoteAttemptId);
      if (error) throw error;
    }

    const results = snapshot.results.filter(
      (result) => result.evaluation_session_id === session.id,
    );
    if (results.length > 0) {
      const { error } = await client
        .from("acrea_level_evaluation_results")
        .upsert(
          results.map((result) => ({
            evaluation_session_id: remoteSessionId,
            exercise_code: result.exercise_code,
            pillar: result.pillar,
            exercise_order: result.exercise_order,
            target_series: result.target_series,
            target_repetitions: result.target_repetitions,
            maximum_repetitions: result.maximum_repetitions,
            technical_valid: result.technical_valid === 1,
            appreciation_rating: result.appreciation_rating,
            prescription: JSON.parse(result.prescription_json),
            timer_plan_code: result.timer_plan_code,
            total_seconds: result.total_seconds,
            completed_seconds: result.completed_seconds,
            attempted_at: result.attempted_at,
          })),
          { onConflict: "evaluation_session_id,exercise_code" },
        );
      if (error) throw error;
    }
  }

  if (snapshot.attempt.status === "completed") {
    const rpcName =
      snapshot.attempt.protocol_version === 4
        ? "finalize_acrea_level_evaluation_v4"
        : "finalize_acrea_level_evaluation";
    const { error } = await client.rpc(rpcName, {
      p_attempt_id: remoteAttemptId,
    });
    if (error) throw error;
  }
}

async function updateLocalEvaluationSyncStatus(
  attemptId: number,
  syncStatus: "synced" | "failed",
) {
  await withDatabase((db) =>
    db.withTransactionAsync(async () => {
      await db.runAsync(
        "UPDATE acrea_level_evaluation_attempts SET sync_status = ? WHERE id = ?",
        [syncStatus, attemptId],
      );
      await db.runAsync(
        `UPDATE acrea_level_evaluation_preferences
         SET sync_status = ?
         WHERE (profile_id, protocol_version) = (
           SELECT profile_id, protocol_version
           FROM acrea_level_evaluation_attempts WHERE id = ?
         )`,
        [syncStatus, attemptId],
      );
    }),
  );
}

async function markEvaluationAttemptPendingForSession(
  db: LocalDatabase,
  evaluationSessionId: number,
) {
  await db.runAsync(
    `UPDATE acrea_level_evaluation_attempts
     SET sync_status = 'pending'
     WHERE id = (
       SELECT attempt_id FROM acrea_level_evaluation_sessions WHERE id = ?
     )`,
    [evaluationSessionId],
  );
}

export function nextRequiredEvaluationPhase(
  sessions: PersistedLevelEvaluationSession[],
): LevelEvaluationPhase | null {
  for (const phase of [1, 2, 3] as const) {
    if (!sessions.some((session) => session.phase === phase && session.status === "passed")) {
      return phase;
    }
  }
  return null;
}

export function prescriptionForPhase(
  phase: LevelEvaluationPhase,
  exerciseCode: ACREAEntryTestExerciseCode,
): EvaluationPrescription {
  return prescriptionForEvaluationPhase(phase, exerciseCode);
}

async function nextRequiredPhaseInDatabase(
  db: LocalDatabase,
  attemptId: number,
) {
  const rows = await db.getAllAsync<{ phase: LevelEvaluationPhase }>(
    `SELECT DISTINCT phase FROM acrea_level_evaluation_sessions
     WHERE attempt_id = ? AND status = 'passed'`,
    [attemptId],
  );
  const passed = new Set(rows.map(({ phase }) => phase));
  return ([1, 2, 3] as const).find((phase) => !passed.has(phase)) ?? null;
}

async function latestPassedSessionId(
  db: LocalDatabase,
  attemptId: number,
  phase: LevelEvaluationPhase,
) {
  const session = await db.getFirstAsync<{ id: number }>(
    `SELECT id FROM acrea_level_evaluation_sessions
     WHERE attempt_id = ? AND phase = ? AND status = 'passed'
     ORDER BY run_number DESC, id DESC LIMIT 1`,
    [attemptId, phase],
  );
  return session?.id ?? null;
}

async function loadEvaluationSyncSnapshot(profileId: string, attemptId: number) {
  return withDatabase(async (db) => {
    const attempt = await db.getFirstAsync<{
      attempt_kind: "initial" | "retest";
      completed_at: string | null;
      protocol_version: number;
      remote_attempt_id: number | null;
      started_at: string;
      status: "in_progress" | "completed";
    }>(
      `SELECT remote_attempt_id, protocol_version, attempt_kind, status,
              started_at, completed_at
       FROM acrea_level_evaluation_attempts
       WHERE id = ? AND profile_id = ?`,
      [attemptId, profileId],
    );
    if (!attempt) throw new Error("Évaluation locale introuvable.");
    const sessions = await db.getAllAsync<{
      active_step_index: number;
      completed_at: string | null;
      id: number;
      phase: number;
      remote_session_id: number | null;
      run_number: number;
      started_at: string;
      status: string;
    }>(
      `SELECT id, remote_session_id, phase, run_number, status,
              active_step_index, started_at, completed_at
       FROM acrea_level_evaluation_sessions WHERE attempt_id = ? ORDER BY id`,
      [attemptId],
    );
    const results = await db.getAllAsync<{
      appreciation_rating: number;
      attempted_at: string;
      completed_seconds: number;
      evaluation_session_id: number;
      exercise_code: string;
      exercise_order: number;
      maximum_repetitions: number | null;
      pillar: string;
      prescription_json: string;
      target_repetitions: number | null;
      target_series: number;
      technical_valid: number;
      timer_plan_code: string;
      total_seconds: number;
    }>(
      `SELECT result.* FROM acrea_level_evaluation_results result
       JOIN acrea_level_evaluation_sessions session
         ON session.id = result.evaluation_session_id
       WHERE session.attempt_id = ? ORDER BY result.id`,
      [attemptId],
    );
    return { attempt, results, sessions };
  });
}

function mapEvaluationResult(
  row: EvaluationResultRow,
): PersistedLevelEvaluationResult {
  return {
    appreciationRating: row.appreciation_rating,
    attemptedAt: row.attempted_at,
    completedSeconds: row.completed_seconds,
    exerciseCode: row.exercise_code,
    maximumRepetitions: row.maximum_repetitions,
    prescription: JSON.parse(row.prescription_json) as EvaluationPrescription,
    technicalValid: row.technical_valid === 1,
    timerPlanCode: row.timer_plan_code,
    totalSeconds: row.total_seconds,
  };
}

function requireTwoLevels(
  levelsByPillar: Map<ACREAPillar, number[]>,
  pillar: ACREAPillar,
) {
  const levels = levelsByPillar.get(pillar) ?? [];
  if (levels.length !== 2) throw new Error(`Deux exercices ${pillar} sont requis.`);
  return levels;
}

function requireSupportedProtocolVersion(
  value: number,
): ACREALevelEvaluationProtocolVersion {
  if (
    !supportedLevelTestProtocolVersions.includes(
      value as ACREALevelEvaluationProtocolVersion,
    )
  ) {
    throw new Error(`Version d’évaluation ACREA non supportée : ${value}.`);
  }
  return value as ACREALevelEvaluationProtocolVersion;
}
