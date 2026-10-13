import type { LocalDatabase } from "@shared/db";

import type { ACREAPillar } from "../data/acreaSeed";
import type { TrainingExerciseHistoryRow } from "./exerciseHistoryMerge";

export type CanonicalExerciseProgressionRow = {
  exercise_id: number;
  pillar: ACREAPillar;
  prescription_json: string;
  pending_direction: "easier" | "harder" | null;
};

export type CanonicalExcludedExerciseRow = {
  exercise_id: number;
  code: string;
};

const canonicalExerciseMappingCte = `
  exercise_canonical AS (
    SELECT exercise.id AS original_exercise_id,
           COALESCE(
             (
               SELECT successor.id
               FROM catalog_exercise_successors mapping
               JOIN catalog_exercises successor
                 ON successor.id = mapping.successor_exercise_id
               JOIN catalog_releases successor_release
                 ON successor_release.id = successor.release_id
               WHERE mapping.legacy_exercise_id = exercise.id
                 AND mapping.resolution_status = 'resolved'
                 AND mapping.validated_at IS NOT NULL
                 AND successor.source_key = mapping.successor_source_key
                 AND successor.is_active = 1
                 AND successor_release.status = 'active'
               ORDER BY mapping.validated_at DESC, mapping.id DESC
               LIMIT 1
             ),
             (
               SELECT alias_target.id
               FROM acrea_level_evaluation_legacy_aliases alias
               JOIN catalog_exercises alias_target
                 ON alias_target.id = alias.successor_exercise_id
               JOIN catalog_releases alias_release
                 ON alias_release.id = alias_target.release_id
               WHERE alias.legacy_catalog_exercise_code = exercise.code
                 AND alias.validated_at IS NOT NULL
                 AND alias_target.source_key = alias.successor_source_key
                 AND alias_target.is_active = 1
                 AND alias_release.status = 'active'
               ORDER BY alias.validated_at DESC
               LIMIT 1
             ),
             exercise.id
           ) AS canonical_exercise_id
    FROM catalog_exercises exercise
  )`;

/** Resolve historical rows at read time while keeping stored audit data intact. */
export function loadCanonicalExerciseProgressions(
  db: LocalDatabase,
  profileId: string,
  levelEvaluationVersion: number,
) {
  return db.getAllAsync<CanonicalExerciseProgressionRow>(
    `WITH ${canonicalExerciseMappingCte},
     ranked_progressions AS (
       SELECT mapping.canonical_exercise_id AS exercise_id,
              pillar.code AS pillar,
              progression.prescription_json,
              progression.pending_direction,
              ROW_NUMBER() OVER (
                PARTITION BY mapping.canonical_exercise_id
                ORDER BY progression.updated_at DESC, progression.exercise_id DESC
              ) AS recency_rank
       FROM acrea_exercise_progressions progression
       JOIN exercise_canonical mapping
         ON mapping.original_exercise_id = progression.exercise_id
       JOIN catalog_exercises canonical_exercise
         ON canonical_exercise.id = mapping.canonical_exercise_id
       JOIN catalog_pillars pillar
         ON pillar.id = canonical_exercise.pillar_id
       WHERE progression.profile_id = ?
         AND progression.level_evaluation_version = ?
     )
     SELECT exercise_id, pillar, prescription_json, pending_direction
     FROM ranked_progressions
     WHERE recency_rank = 1
     ORDER BY exercise_id`,
    [profileId, levelEvaluationVersion],
  );
}

export function loadCanonicalTrainingExerciseHistories(
  db: LocalDatabase,
  profileId: string,
) {
  return db.getAllAsync<TrainingExerciseHistoryRow>(
    `WITH ${canonicalExerciseMappingCte},
     progression_maximum AS (
       SELECT progression.profile_id,
              mapping.canonical_exercise_id AS exercise_id,
              MAX(COALESCE(progression.reached_maximum, 0)) AS reached_maximum
       FROM acrea_exercise_progressions progression
       JOIN exercise_canonical mapping
         ON mapping.original_exercise_id = progression.exercise_id
       GROUP BY progression.profile_id, mapping.canonical_exercise_id
     )
     SELECT mapping.canonical_exercise_id AS exercise_id,
            AVG(feedback.appreciation_rating) AS appreciation_average,
            MAX(feedback.performed_at) AS last_performed_at,
            COALESCE(MAX(progression.reached_maximum), 0) AS reached_maximum
       FROM session_feedback feedback
       JOIN exercise_canonical mapping
         ON mapping.original_exercise_id = feedback.exercise_id
       LEFT JOIN progression_maximum progression
         ON progression.profile_id = feedback.profile_id
        AND progression.exercise_id = mapping.canonical_exercise_id
       WHERE feedback.profile_id = ? AND feedback.session_phase = 'main'
       GROUP BY mapping.canonical_exercise_id
       ORDER BY mapping.canonical_exercise_id`,
    [profileId],
  );
}

export function loadCanonicalExcludedExercises(
  db: LocalDatabase,
  profileId: string,
) {
  return db.getAllAsync<CanonicalExcludedExerciseRow>(
    `WITH ${canonicalExerciseMappingCte}
     SELECT DISTINCT canonical_exercise.id AS exercise_id,
            canonical_exercise.code
       FROM acrea_profile_excluded_exercises exclusion
       JOIN exercise_canonical mapping
         ON mapping.original_exercise_id = exclusion.exercise_id
       JOIN catalog_exercises canonical_exercise
         ON canonical_exercise.id = mapping.canonical_exercise_id
       WHERE exclusion.profile_id = ?
       ORDER BY canonical_exercise.code`,
    [profileId],
  );
}
