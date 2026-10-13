import type { LocalDatabase } from "@shared/db/database";

import { exerciseLibraryReleaseCode } from "../data/exerciseLibrarySeed";

export type CatalogEvaluationProtocolVersion = 3 | 4;

export async function resolveCatalogEvaluationProtocolVersionWithDatabase(
  db: LocalDatabase,
  expectedEvaluationExerciseCount: number,
): Promise<CatalogEvaluationProtocolVersion> {
  const release = await db.getFirstAsync<{ id: number }>(
    `SELECT id
     FROM catalog_releases
     WHERE code = ? AND status = 'active'
     LIMIT 1`,
    [exerciseLibraryReleaseCode],
  );
  if (!release) return 3;

  const mappings = await db.getFirstAsync<{ count: number }>(
    `SELECT COUNT(DISTINCT mapping.evaluation_exercise_code) AS count
     FROM acrea_level_evaluation_exercise_mappings mapping
      JOIN catalog_exercises exercise
       ON exercise.code = mapping.exercise_slug
     WHERE mapping.protocol_version = 4
       AND mapping.validated_at IS NOT NULL
       AND exercise.release_id = ?
       AND exercise.is_active = 1
       AND exercise.review_status = 'valide'
       AND exercise.translation_status = 'validated'`,
    [release.id],
  );

  return Number(mappings?.count ?? 0) === expectedEvaluationExerciseCount
    ? 4
    : 3;
}
