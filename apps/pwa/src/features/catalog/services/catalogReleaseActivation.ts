import { withDatabase, type LocalDatabase } from "@shared/db";

import {
  exerciseLibraryExerciseCount,
  exerciseLibraryReleaseCode,
} from "../data/exerciseLibrarySeed";
import type { CatalogRelease, CatalogReleaseStatus } from "../types";

export type CatalogReleaseActivationEvidence = {
  licenseId: string;
  backupReference: string;
  diffReference: string;
  activatedAt?: string;
};

export type CatalogReleaseActivationIssueCode =
  | "release_not_found"
  | "release_not_active"
  | "exercise_count"
  | "poster"
  | "animation";

export type CatalogReleaseActivationIssue = {
  code: CatalogReleaseActivationIssueCode;
  message: string;
  actual?: number;
  expected?: number;
};

export type CatalogReleaseActivationCheck = {
  activationId: number | null;
  releaseCode: string;
  releaseStatus: CatalogReleaseStatus | null;
  previewReady: boolean;
  ready: boolean;
  expectedExerciseCount: number;
  v1ExerciseCount: number;
  v2AdditionExerciseCount: number;
  activeExerciseCount: number;
  translatedExerciseCount: number;
  previewPosterReadyCount: number;
  previewAnimationReadyCount: number;
  posterReadyCount: number;
  animationReadyCount: number;
  programmingCoverageCount: number;
  evaluationMappingCount: number;
  resolvedSuccessorCount: number;
  issues: CatalogReleaseActivationIssue[];
};

export async function inspectCatalogReleaseActivation(
  releaseCode: string,
  _evidence?: Partial<CatalogReleaseActivationEvidence>,
) {
  return withDatabase((db) => validateCatalogReleaseActivationWithDatabase(db, releaseCode));
}

export async function activateCatalogRelease(
  releaseCode: string,
  _evidence: CatalogReleaseActivationEvidence,
) {
  return inspectCatalogReleaseActivation(releaseCode);
}

export async function activateCatalogReleaseWithDatabase(
  db: LocalDatabase,
  releaseCode: string,
  _evidence: CatalogReleaseActivationEvidence,
) {
  return validateCatalogReleaseActivationWithDatabase(db, releaseCode);
}

export type CatalogReleaseRollbackResult = { releaseCode: string; rolledBack: false };

export async function rollbackCatalogReleaseActivation(
  releaseCode: string,
): Promise<CatalogReleaseRollbackResult> {
  await inspectCatalogReleaseActivation(releaseCode);
  return { releaseCode, rolledBack: false };
}

export async function rollbackCatalogReleaseActivationWithDatabase(
  db: LocalDatabase,
  releaseCode: string,
): Promise<CatalogReleaseRollbackResult> {
  await validateCatalogReleaseActivationWithDatabase(db, releaseCode);
  return { releaseCode, rolledBack: false };
}

export async function listCatalogReleases(): Promise<CatalogRelease[]> {
  return withDatabase((db) =>
    db.getAllAsync<CatalogRelease>(
      `SELECT id, code, source, source_revision AS sourceRevision, locale,
              expected_exercise_count AS expectedExerciseCount, status,
              license_id AS licenseId, activation_backup_reference AS activationBackupReference,
              activation_diff_reference AS activationDiffReference, created_at AS createdAt,
              activated_at AS activatedAt, archived_at AS archivedAt, updated_at AS updatedAt
       FROM catalog_releases
       WHERE code = ?`,
      [exerciseLibraryReleaseCode],
    ),
  );
}

export async function validateCatalogReleaseActivationWithDatabase(
  db: LocalDatabase,
  releaseCode: string,
): Promise<CatalogReleaseActivationCheck> {
  const issues: CatalogReleaseActivationIssue[] = [];
  const release = await db.getFirstAsync<{
    id: number;
    status: CatalogReleaseStatus;
    expected_exercise_count: number;
  }>(
    `SELECT id, status, expected_exercise_count
     FROM catalog_releases
     WHERE code = ? LIMIT 1`,
    [releaseCode],
  );
  if (!release || releaseCode !== exerciseLibraryReleaseCode) {
    issues.push({ code: "release_not_found", message: "Bibliothèque française introuvable." });
  } else if (release.status !== "active") {
    issues.push({ code: "release_not_active", message: "La bibliothèque française doit être active." });
  }
  const count = await db.getFirstAsync<{ active: number; translated: number; posters: number; animations: number }>(
    `SELECT
       COUNT(DISTINCT exercise.id) AS active,
       COUNT(DISTINCT CASE WHEN translation_status IN ('translated', 'validated') THEN exercise.id END) AS translated,
       SUM(CASE WHEN media.kind = 'poster' AND media.status = 'ready' THEN 1 ELSE 0 END) AS posters,
       SUM(CASE WHEN media.kind = 'animation' AND media.status = 'ready' THEN 1 ELSE 0 END) AS animations
     FROM catalog_exercises exercise
     LEFT JOIN catalog_exercise_media media ON media.exercise_id = exercise.id
     WHERE exercise.release_id = ? AND exercise.is_active = 1`,
    [release?.id ?? -1],
  );
  const activeExerciseCount = Number(count?.active ?? 0);
  const posterReadyCount = Number(count?.posters ?? 0);
  const animationReadyCount = Number(count?.animations ?? 0);
  if (activeExerciseCount !== exerciseLibraryExerciseCount) {
    issues.push({ code: "exercise_count", message: "Nombre d’exercices incorrect.", actual: activeExerciseCount, expected: exerciseLibraryExerciseCount });
  }
  if (posterReadyCount !== exerciseLibraryExerciseCount) {
    issues.push({ code: "poster", message: "Tous les posters sont requis.", actual: posterReadyCount, expected: exerciseLibraryExerciseCount });
  }
  if (animationReadyCount !== exerciseLibraryExerciseCount) {
    issues.push({ code: "animation", message: "Toutes les animations sont requises.", actual: animationReadyCount, expected: exerciseLibraryExerciseCount });
  }
  const ready = issues.length === 0;
  return {
    activationId: null,
    releaseCode,
    releaseStatus: release?.status ?? null,
    previewReady: ready,
    ready,
    expectedExerciseCount: exerciseLibraryExerciseCount,
    v1ExerciseCount: exerciseLibraryExerciseCount,
    v2AdditionExerciseCount: 0,
    activeExerciseCount,
    translatedExerciseCount: Number(count?.translated ?? 0),
    previewPosterReadyCount: posterReadyCount,
    previewAnimationReadyCount: animationReadyCount,
    posterReadyCount,
    animationReadyCount,
    programmingCoverageCount: 0,
    evaluationMappingCount: 0,
    resolvedSuccessorCount: 0,
    issues,
  };
}

export class CatalogReleaseActivationError extends Error {
  constructor(readonly check: CatalogReleaseActivationCheck) {
    super(check.issues.map((issue) => issue.message).join(" ") || "Bibliothèque invalide.");
    this.name = "CatalogReleaseActivationError";
  }
}

export function isActivationReadyMedia(media: { kind: string; status: string }) {
  return (media.kind === "poster" || media.kind === "animation") && media.status === "ready";
}

export const isPreviewReadyMedia = isActivationReadyMedia;
