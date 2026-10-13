export const mainExerciseRecoverySeconds = 90;

export function trainingSessionAllowsEarlyFinish(
  phase: "warmup" | "main" | "cooldown",
) {
  return phase !== "main";
}

export function canAdvanceAfterMainExercise({
  feedbackSaved,
  recoveryComplete,
}: {
  feedbackSaved: boolean;
  recoveryComplete: boolean;
}) {
  return feedbackSaved && recoveryComplete;
}
