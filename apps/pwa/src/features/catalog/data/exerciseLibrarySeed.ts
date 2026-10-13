import type { CatalogSeed } from "../types";
import {
  exerciseLibraryCoreExerciseSeeds,
  exerciseLibraryCoreReleaseSeeds,
  exerciseLibraryExerciseCount,
  exerciseLibraryReleaseCode,
  exerciseLibraryRevision,
  exerciseLibrarySourceKey,
} from "./exerciseLibraryCore";

export {
  exerciseLibraryExerciseCount,
  exerciseLibraryReleaseCode,
  exerciseLibraryRevision,
  exerciseLibrarySourceKey,
};

/**
 * Compatibility exports for administration and release validation. These
 * contain only the offline evaluation core in the application runtime; the
 * generated evaluation-only artifact remains a build/seed input and is never bundled.
 */
export const exerciseLibraryExerciseSeeds = exerciseLibraryCoreExerciseSeeds;
export const exerciseLibraryReleaseSeeds = exerciseLibraryCoreReleaseSeeds;
export const exerciseLibrarySessionTemplateSeeds = [] as const;
export const exerciseLibrarySessionTemplateLevelSeeds = [] as const;

export function mergeExerciseLibraryIntoCatalogSeed(seed: CatalogSeed): CatalogSeed {
  const exerciseCodes = new Set(seed.exercises.map((exercise) => exercise.code));
  const releaseCodes = new Set((seed.releases ?? []).map((release) => release.code));

  return {
    ...seed,
    releases: [
      ...(seed.releases ?? []),
      ...exerciseLibraryCoreReleaseSeeds.filter((release) => !releaseCodes.has(release.code)),
    ],
    exercises: [
      ...seed.exercises,
      ...exerciseLibraryCoreExerciseSeeds.filter((exercise) => !exerciseCodes.has(exercise.code)),
    ],
  };
}
