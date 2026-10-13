export type TrainingExerciseHistoryRow = {
  appreciation_average: number | null;
  exercise_id: number;
  last_performed_at: string | null;
  reached_maximum: number | null;
};

export type EvaluationExerciseHistoryRow = {
  appreciation_average: number;
  evaluated_at: string;
  exercise_id: number;
};

export function mergeEvaluationAndTrainingHistories(
  trainingHistories: TrainingExerciseHistoryRow[],
  evaluationHistories: EvaluationExerciseHistoryRow[],
): TrainingExerciseHistoryRow[] {
  const trainedExerciseIds = new Set(
    trainingHistories.map(({ exercise_id }) => exercise_id),
  );
  return [
    ...trainingHistories,
    ...evaluationHistories
      .filter(({ exercise_id }) => !trainedExerciseIds.has(exercise_id))
      .map((row) => ({
        appreciation_average: row.appreciation_average,
        exercise_id: row.exercise_id,
        last_performed_at: row.evaluated_at,
        reached_maximum: 0,
      })),
  ];
}
