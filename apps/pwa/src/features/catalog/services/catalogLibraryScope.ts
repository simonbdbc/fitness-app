import type { LocalDatabase } from "@shared/db";

import { exerciseLibraryReleaseCode } from "../data/exerciseLibrarySeed";

export type CatalogLibraryScope = {
  exerciseCount: number;
  kind: "active";
  releaseCode: typeof exerciseLibraryReleaseCode;
  releaseStatus: "active";
  translationsNeedReview: boolean;
};

/** The bundled French exercise library is the sole catalog authority. */
export async function resolveCatalogLibraryScopeWithDatabase(
  db: LocalDatabase,
): Promise<CatalogLibraryScope> {
  const release = await db.getFirstAsync<{ expected_exercise_count: number }>(
    `SELECT expected_exercise_count
     FROM catalog_releases
     WHERE code = ? AND status = 'active'
     LIMIT 1`,
    [exerciseLibraryReleaseCode],
  );
  if (!release) {
    throw new Error("La bibliothèque française active est introuvable.");
  }
  return {
    exerciseCount: release.expected_exercise_count,
    kind: "active",
    releaseCode: exerciseLibraryReleaseCode,
    releaseStatus: "active",
    translationsNeedReview: true,
  };
}
