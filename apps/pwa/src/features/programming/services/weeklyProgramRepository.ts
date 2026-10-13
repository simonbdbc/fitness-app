import { withDatabase } from "@shared/db";
import { reportTechnicalDegradationOnce } from "@shared/observability/technicalDiagnostics";

import type {
  ACREALevel,
  ACREAPillar,
  ACREASessionAlternative,
  ACREASessionPhase,
  ACREASessionPrescription,
  ACREATraining,
  ACREAWeekPlan,
} from "../data/acreaSeed";

type ProgramRow = {
  id: number;
  schema_version: number;
  iso_week_year: number;
  iso_week_number: number;
  catalog_version: string;
  role: string;
  generated_by: string;
  validation_focus: string;
  profile_fingerprint: string | null;
  profile_effective_from: string | null;
  level_evaluation_version: number;
};

type TrainingRow = {
  id: number;
  code: string;
  day_label: string;
  title: string;
  dominant_pillar: string;
  duration_minutes: number;
  status: string;
  sort_order: number;
  scheduled_date: string | null;
  generation_profile_fingerprint: string | null;
};

export type WeeklyProgramTrainingState = {
  id: number;
  code: ACREATraining["code"];
  scheduledDate: string;
  status: ACREATraining["status"];
  hasFeedback: boolean;
};

export type WeeklyProgramStoredState = {
  programId: number;
  profileFingerprint: string | null;
  profileEffectiveFrom: string | null;
  levelEvaluationVersion: number;
  trainings: WeeklyProgramTrainingState[];
};

type SeanceRow = {
  id: number;
  training_id: number;
  code: string;
  phase: string;
  pillar: string | null;
  title: string;
  sort_order: number;
};

type SessionRow = {
  seance_id: number;
  code: string;
  session_template_id: number | null;
  exercise_id: number | null;
  exercise_code: string | null;
  exercise_name: string;
  format_id: number | null;
  format_code: string | null;
  format_label: string;
  phase: string;
  prescription_json: string;
  level: number;
  easier_json: string;
  harder_json: string;
  safety_rule: string;
  sort_order: number;
};

export async function loadWeeklyProgramSnapshot(
  profileId: string,
  isoWeekYear: number,
  isoWeekNumber: number,
): Promise<ACREAWeekPlan | null> {
  return withDatabase(async (db) => {
    const program = await db.getFirstAsync<ProgramRow>(
      `
            SELECT id, schema_version, iso_week_year, iso_week_number,
                   catalog_version, role, generated_by, validation_focus,
                   profile_fingerprint, profile_effective_from,
                   level_evaluation_version
            FROM programs
            WHERE profile_id = ? AND iso_week_year = ? AND iso_week_number = ?
            ORDER BY updated_at DESC, id DESC
            LIMIT 1
            `,
      [profileId, isoWeekYear, isoWeekNumber],
    );
    if (!program) {
      return null;
    }

    const trainings = await db.getAllAsync<TrainingRow>(
      `
            SELECT id, code, day_label, title, dominant_pillar,
                   duration_minutes, status, sort_order, scheduled_date,
                   generation_profile_fingerprint
            FROM trainings
            WHERE program_id = ?
            ORDER BY sort_order, id
            `,
      [program.id],
    );
    const seances = await db.getAllAsync<SeanceRow>(
      `
            SELECT s.id, s.training_id, s.code, s.phase, s.pillar, s.title, s.sort_order
            FROM seances s
            JOIN trainings t ON t.id = s.training_id
            WHERE t.program_id = ?
            ORDER BY t.sort_order, s.sort_order, s.id
            `,
      [program.id],
    );
    const sessions = await db.getAllAsync<SessionRow>(
      `
            SELECT x.seance_id, x.code, x.session_template_id,
                   x.exercise_id, x.exercise_code, x.exercise_name,
                   x.format_id, x.format_code, x.format_label,
                   x.phase, x.prescription_json, x.level, x.easier_json, x.harder_json,
                   x.safety_rule, x.sort_order
            FROM sessions x
            JOIN seances s ON s.id = x.seance_id
            JOIN trainings t ON t.id = s.training_id
            WHERE t.program_id = ?
            ORDER BY t.sort_order, s.sort_order, x.sort_order, x.id
            `,
      [program.id],
    );

    return {
      schemaVersion: parseSchemaVersion(program.schema_version),
      isoWeekYear: program.iso_week_year,
      isoWeekNumber: program.iso_week_number,
      catalogVersion: program.catalog_version,
      role: program.role,
      generatedBy: program.generated_by,
      validationFocus: program.validation_focus,
      trainings: trainings.map((training) => ({
        code: parseTrainingCode(training.code),
        day: training.day_label,
        scheduledDate: requireScheduledDate(training.scheduled_date),
        title: training.title,
        dominantPillar: parsePillar(training.dominant_pillar),
        durationMinutes: training.duration_minutes,
        status: parseTrainingStatus(training.status),
        seances: seances
          .filter((seance) => seance.training_id === training.id)
          .map((seance) => ({
            code: seance.code,
            phase: parsePhase(seance.phase),
            pillar: seance.pillar === null ? null : parsePillar(seance.pillar),
            title: seance.title,
            sessions: sessions
              .filter((session) => session.seance_id === seance.id)
              .map((session) => ({
                code: session.code,
                sessionTemplateId: requireCatalogId(
                  session.session_template_id,
                  "template de session",
                ),
                exerciseId: requireCatalogId(session.exercise_id, "exercice"),
                exerciseCode: session.exercise_code ?? session.code,
                exerciseName: session.exercise_name,
                formatId: requireCatalogId(session.format_id, "format"),
                formatLabel: session.format_label,
                formatCode: session.format_code ?? undefined,
                phase: parsePhase(session.phase),
                prescription: parsePrescription(session.prescription_json),
                level: parseLevel(session.level),
                easier: parseAlternative(
                  session.easier_json,
                  session.exercise_name,
                  session.level,
                ),
                harder: parseAlternative(
                  session.harder_json,
                  session.exercise_name,
                  session.level,
                ),
                safetyRule: session.safety_rule,
              })),
          })),
      })),
    };
  });
}

export async function replaceWeeklyProgramSnapshot(
  profileId: string,
  plan: ACREAWeekPlan,
  profileFingerprint: string,
  levelEvaluationVersion: number,
): Promise<void> {
  const now = new Date().toISOString();

  try {
    await withDatabase((db) =>
      db.withTransactionAsync(async () => {
        await db.runAsync(
          "DELETE FROM programs WHERE profile_id = ? AND iso_week_year = ? AND iso_week_number = ?",
          [profileId, plan.isoWeekYear, plan.isoWeekNumber],
        );

        const programResult = await db.runAsync(
          `
                INSERT INTO programs (
                    profile_id, iso_week_year, iso_week_number, schema_version,
                    catalog_version, role, generated_by, validation_focus,
                    profile_fingerprint, profile_effective_from,
                    level_evaluation_version, created_at, updated_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                `,
          [
            profileId,
            plan.isoWeekYear,
            plan.isoWeekNumber,
            plan.schemaVersion,
            plan.catalogVersion,
            plan.role,
            plan.generatedBy,
            plan.validationFocus,
            profileFingerprint,
            plan.trainings[0]?.scheduledDate ?? null,
            levelEvaluationVersion,
            now,
            now,
          ],
        );

        for (const [trainingIndex, training] of plan.trainings.entries()) {
          const trainingResult = await db.runAsync(
            `
                    INSERT INTO trainings (
                        program_id, code, day_label, title, dominant_pillar,
                        duration_minutes, status, sort_order, created_at, updated_at
                        , scheduled_date, generation_profile_fingerprint
                    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                    `,
            [
              programResult.lastInsertRowId,
              training.code,
              training.day,
              training.title,
              training.dominantPillar,
              training.durationMinutes,
              training.status,
              trainingIndex,
              now,
              now,
              training.scheduledDate,
              profileFingerprint,
            ],
          );

          for (const [seanceIndex, seance] of training.seances.entries()) {
            const seanceResult = await db.runAsync(
              `
                        INSERT INTO seances (
                            training_id, code, phase, pillar, title, sort_order,
                            created_at, updated_at
                        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                        `,
              [
                trainingResult.lastInsertRowId,
                seance.code,
                seance.phase,
                seance.pillar,
                seance.title,
                seanceIndex,
                now,
                now,
              ],
            );

            for (const [sessionIndex, session] of seance.sessions.entries()) {
              await db.runAsync(
                `
                            INSERT INTO sessions (
                                seance_id, code, session_template_id,
                                exercise_id, exercise_code, exercise_name,
                                format_id, format_code, format_label, phase,
                                prescription_json, level,
                                easier_json, harder_json, safety_rule, sort_order,
                                created_at, updated_at
                            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                            `,
                [
                  seanceResult.lastInsertRowId,
                  session.code,
                  session.sessionTemplateId,
                  session.exerciseId,
                  session.exerciseCode,
                  session.exerciseName,
                  session.formatId,
                  session.formatCode ?? null,
                  session.formatLabel,
                  session.phase,
                  JSON.stringify(session.prescription),
                  session.level,
                  JSON.stringify(session.easier),
                  JSON.stringify(session.harder),
                  session.safetyRule,
                  sessionIndex,
                  now,
                  now,
                ],
              );
            }
          }
        }
      }),
    );
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    throw new Error(
      `Persistance du programme impossible (snapshot v3): ${detail}`,
    );
  }
}

export async function loadWeeklyProgramStoredState(
  profileId: string,
  isoWeekYear: number,
  isoWeekNumber: number,
): Promise<WeeklyProgramStoredState | null> {
  return withDatabase(async (db) => {
    const program = await db.getFirstAsync<{
      id: number;
      profile_fingerprint: string | null;
      profile_effective_from: string | null;
      level_evaluation_version: number;
    }>(
      `SELECT id, profile_fingerprint, profile_effective_from,
              level_evaluation_version
       FROM programs
       WHERE profile_id = ? AND iso_week_year = ? AND iso_week_number = ?
       LIMIT 1`,
      [profileId, isoWeekYear, isoWeekNumber],
    );
    if (!program) return null;
    const trainings = await db.getAllAsync<{
      id: number;
      code: string;
      scheduled_date: string | null;
      status: string;
      feedback_count: number;
    }>(
      `SELECT trainings.id, trainings.code, trainings.scheduled_date,
              trainings.status, COUNT(session_feedback.id) AS feedback_count
       FROM trainings
       LEFT JOIN session_feedback ON session_feedback.training_id = trainings.id
       WHERE trainings.program_id = ?
       GROUP BY trainings.id
       ORDER BY trainings.sort_order, trainings.id`,
      [program.id],
    );
    return {
      programId: program.id,
      profileFingerprint: program.profile_fingerprint,
      profileEffectiveFrom: program.profile_effective_from,
      levelEvaluationVersion: program.level_evaluation_version,
      trainings: trainings.map((training) => ({
        id: training.id,
        code: parseTrainingCode(training.code),
        scheduledDate: requireScheduledDate(training.scheduled_date),
        status: parseTrainingStatus(training.status),
        hasFeedback: training.feedback_count > 0,
      })),
    };
  });
}

export async function replaceWeeklyProgramFuture({
  expectedReplaceableTrainingIds,
  plan,
  profileFingerprint,
  profileId,
  profileEffectiveFrom,
  levelEvaluationVersion,
}: {
  expectedReplaceableTrainingIds: number[];
  plan: ACREAWeekPlan;
  profileFingerprint: string;
  profileId: string;
  profileEffectiveFrom: string;
  levelEvaluationVersion: number;
}) {
  const now = new Date().toISOString();
  try {
    await withDatabase((db) =>
      db.withTransactionAsync(async () => {
        const program = await db.getFirstAsync<{ id: number }>(
          `SELECT id FROM programs
           WHERE profile_id = ? AND iso_week_year = ? AND iso_week_number = ?`,
          [profileId, plan.isoWeekYear, plan.isoWeekNumber],
        );
        if (!program) throw new Error("Snapshot hebdomadaire introuvable.");

        const replaceable = await db.getAllAsync<{ id: number }>(
          `SELECT trainings.id
           FROM trainings
           WHERE trainings.program_id = ?
             AND trainings.scheduled_date >= ?
             AND trainings.status <> 'terminee'
             AND NOT EXISTS (
               SELECT 1 FROM session_feedback
               WHERE session_feedback.training_id = trainings.id
             )
           ORDER BY trainings.id`,
          [program.id, profileEffectiveFrom],
        );
        const currentIds = replaceable.map(({ id }) => id);
        const expectedIds = [...expectedReplaceableTrainingIds].sort(
          (left, right) => left - right,
        );
        if (JSON.stringify(currentIds) !== JSON.stringify(expectedIds)) {
          throw new Error(
            "Le programme a évolué pendant la régénération. Réessaie avec son état actuel.",
          );
        }
        for (const id of currentIds) {
          await db.runAsync("DELETE FROM trainings WHERE id = ?", [id]);
        }

        await db.runAsync(
          `UPDATE programs SET catalog_version = ?, role = ?, generated_by = ?,
             validation_focus = ?, profile_fingerprint = ?,
             profile_effective_from = ?, level_evaluation_version = ?,
             updated_at = ?
           WHERE id = ?`,
          [
            plan.catalogVersion,
            plan.role,
            plan.generatedBy,
            plan.validationFocus,
            profileFingerprint,
            profileEffectiveFrom,
            levelEvaluationVersion,
            now,
            program.id,
          ],
        );

        for (const training of plan.trainings) {
          const trainingResult = await db.runAsync(
            `INSERT INTO trainings (
               program_id, code, day_label, title, dominant_pillar,
               duration_minutes, status, sort_order, created_at, updated_at,
               scheduled_date, generation_profile_fingerprint
             ) VALUES (?, ?, ?, ?, ?, ?, ?, 0, ?, ?, ?, ?)`,
            [
              program.id,
              training.code,
              training.day,
              training.title,
              training.dominantPillar,
              training.durationMinutes,
              training.status,
              now,
              now,
              training.scheduledDate,
              profileFingerprint,
            ],
          );
          for (const [seanceIndex, seance] of training.seances.entries()) {
            const seanceResult = await db.runAsync(
              `INSERT INTO seances (
                 training_id, code, phase, pillar, title, sort_order, created_at, updated_at
               ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
              [
                trainingResult.lastInsertRowId,
                seance.code,
                seance.phase,
                seance.pillar,
                seance.title,
                seanceIndex,
                now,
                now,
              ],
            );
            for (const [sessionIndex, session] of seance.sessions.entries()) {
              await db.runAsync(
                `INSERT INTO sessions (
                   seance_id, code, session_template_id, exercise_id,
                   exercise_code, exercise_name, format_id, format_code,
                   format_label, phase, prescription_json, level, easier_json, harder_json, safety_rule,
                   sort_order, created_at, updated_at
                 ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                [
                  seanceResult.lastInsertRowId,
                  session.code,
                  session.sessionTemplateId,
                  session.exerciseId,
                  session.exerciseCode,
                  session.exerciseName,
                  session.formatId,
                  session.formatCode ?? null,
                  session.formatLabel,
                  session.phase,
                  JSON.stringify(session.prescription),
                  session.level,
                  JSON.stringify(session.easier),
                  JSON.stringify(session.harder),
                  session.safetyRule,
                  sessionIndex,
                  now,
                  now,
                ],
              );
            }
          }
        }

        const ordered = await db.getAllAsync<{ id: number }>(
          `SELECT id FROM trainings WHERE program_id = ?
           ORDER BY scheduled_date, id`,
          [program.id],
        );
        for (const [sortOrder, training] of ordered.entries()) {
          await db.runAsync(
            "UPDATE trainings SET sort_order = ?, updated_at = ? WHERE id = ?",
            [sortOrder, now, training.id],
          );
        }
      }),
    );
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    throw new Error(`Régénération partielle impossible: ${detail}`);
  }
}

export async function updateWeeklyTrainingStatus(
  profileId: string,
  isoWeekYear: number,
  isoWeekNumber: number,
  trainingCode: ACREATraining["code"],
  status: ACREATraining["status"],
): Promise<void> {
  const result = await withDatabase((db) =>
    db.runAsync(
      `
            UPDATE trainings
            SET status = ?, updated_at = ?
            WHERE code = ? AND program_id = (
                SELECT id FROM programs
                WHERE profile_id = ? AND iso_week_year = ? AND iso_week_number = ?
                ORDER BY updated_at DESC, id DESC
                LIMIT 1
            )
            `,
      [
        status,
        new Date().toISOString(),
        trainingCode,
        profileId,
        isoWeekYear,
        isoWeekNumber,
      ],
    ),
  );

  if (result.changes !== 1) {
    throw new Error("Programme hebdomadaire introuvable pour ce statut.");
  }
}

function parseSchemaVersion(value: number): 3 {
  if (value !== 3)
    throw new Error(`Version de snapshot non supportée: ${value}`);
  return 3;
}

function requireScheduledDate(value: string | null) {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    throw new Error("Date planifiée manquante dans le snapshot.");
  }
  return value;
}

function requireCatalogId(value: number | null, label: string) {
  if (value === null || !Number.isInteger(value) || value <= 0) {
    throw new Error(`Identifiant ${label} manquant dans le snapshot.`);
  }
  return value;
}

function parseAlternative(
  value: string,
  fallbackName: string,
  fallbackLevel: number,
): ACREASessionAlternative {
  try {
    const parsed = JSON.parse(value) as Partial<ACREASessionAlternative>;
    if (
      typeof parsed.name === "string" &&
      typeof parsed.level === "number" &&
      typeof parsed.note === "string"
    ) {
      return {
        name: parsed.name,
        level: parseLevel(parsed.level),
        note: parsed.note,
      };
    }
  } catch (error) {
    reportTechnicalDegradationOnce(
      "weekly-program-legacy-alternative",
      error,
    );
    // The fallback keeps an older or partially-written snapshot readable.
  }

  return {
    name: fallbackName,
    level: parseLevel(fallbackLevel),
    note: "Alternative conservée au niveau courant.",
  };
}

function parseTrainingCode(value: string): ACREATraining["code"] {
  if (/^T[1-7]$/.test(value)) {
    return value as ACREATraining["code"];
  }
  throw new Error(`Code entraînement invalide: ${value}`);
}

function parseTrainingStatus(value: string): ACREATraining["status"] {
  if (value === "a faire" || value === "terminee" || value === "reportee") {
    return value;
  }
  throw new Error(`Statut entraînement invalide: ${value}`);
}

function parsePillar(value: string): ACREAPillar {
  if (
    value === "strength" ||
    value === "cardio" ||
    value === "proprioception"
  ) {
    return value;
  }
  throw new Error(`Pilier ACREA invalide: ${value}`);
}

function parsePhase(value: string): ACREASessionPhase {
  if (value === "warmup" || value === "main" || value === "cooldown") return value;
  throw new Error(`Phase ACREA invalide: ${value}`);
}

function parsePrescription(value: string): ACREASessionPrescription {
  const parsed = JSON.parse(value) as Partial<ACREASessionPrescription>;
  if (
    (parsed.kind === "repetitions" || parsed.kind === "intervals" || parsed.kind === "fixed") &&
    Number.isInteger(parsed.series) &&
    Number.isInteger(parsed.restSeconds) &&
    Number.isInteger(parsed.estimatedDurationSeconds) &&
    typeof parsed.adaptable === "boolean"
  ) {
    return parsed as ACREASessionPrescription;
  }
  throw new Error("Prescription de session invalide dans le snapshot.");
}

function parseLevel(value: number): ACREALevel {
  return Math.max(1, Math.min(10, Math.round(value))) as ACREALevel;
}
