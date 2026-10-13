import type { CatalogExercise } from "../types";

export function resolveSelectedCatalogExercise(
  exercises: readonly CatalogExercise[],
  selectedExerciseId: number | null,
) {
  if (selectedExerciseId === null) return null;
  return (
    exercises.find((exercise) => exercise.id === selectedExerciseId) ?? null
  );
}
