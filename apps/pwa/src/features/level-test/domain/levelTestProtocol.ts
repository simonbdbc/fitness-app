export type ProtocolStage = 1 | 2 | 3;
export type EvaluationPhase = 1 | 2 | 3;
export type EvaluationPrescription = {
  repetitions: number | null;
  restSeconds: number;
  series: number;
};

export type EvaluationFeedback = {
  appreciationRating: number | null;
  maximumRepetitions?: number;
  technicalValid: boolean | null;
};

export type ProtocolStageResult = {
  exerciseCode: string;
  stage: ProtocolStage;
  technicalValid: boolean;
  maximumRepetitions: number | null;
};

export function hasSuccessfulProtocolStage(
  results: ProtocolStageResult[],
  exerciseCode: string,
  stage: ProtocolStage,
) {
  return results.some(
    (result) =>
      result.exerciseCode === exerciseCode &&
      result.stage === stage &&
      result.technicalValid,
  );
}

export function nextRequiredProtocolStage(
  exerciseCodes: string[],
  results: ProtocolStageResult[],
): { exerciseCode: string; stage: ProtocolStage } | null {
  for (const exerciseCode of exerciseCodes) {
    for (const stage of [1, 2, 3] as const) {
      if (!hasSuccessfulProtocolStage(results, exerciseCode, stage)) {
        return { exerciseCode, stage };
      }
    }
  }
  return null;
}

export function levelForStrictMaximum(
  exerciseCode: ACREAEntryTestExerciseCode,
  value: number,
) {
  if (!Number.isInteger(value) || value < 0) {
    throw new Error("Le maximum strict doit être un entier positif ou nul.");
  }
  const exercise = requireEvaluationExercise(exerciseCode);
  if (value < exercise.levelThresholds.level2Minimum) return 1;
  if (value < exercise.levelThresholds.level3Minimum) return 2;
  return 3;
}

export function pillarLevelFromStrictMaximums(
  values: { exerciseCode: ACREAEntryTestExerciseCode; value: number }[],
) {
  if (values.length !== 2) {
    throw new Error("Deux exercices sont requis pour calculer le niveau d'un pilier.");
  }
  return Math.min(
    ...values.map(({ exerciseCode, value }) =>
      levelForStrictMaximum(exerciseCode, value),
    ),
  );
}

export function nextRequiredEvaluationPhase(
  sessions: { phase: EvaluationPhase; status: "in_progress" | "passed" | "failed" }[],
) {
  return (
    ([1, 2, 3] as const).find(
      (phase) =>
        !sessions.some(
          (session) => session.phase === phase && session.status === "passed",
        ),
    ) ?? null
  );
}

export function isEvaluationSessionPassed(
  expectedExerciseCodes: string[],
  results: { exerciseCode: string; technicalValid: boolean }[],
) {
  const uniqueExpected = new Set(expectedExerciseCodes);
  if (
    uniqueExpected.size !== expectedExerciseCodes.length ||
    results.length !== uniqueExpected.size
  ) {
    return false;
  }
  return expectedExerciseCodes.every((exerciseCode) =>
    results.some(
      (result) =>
        result.exerciseCode === exerciseCode && result.technicalValid,
    ),
  );
}

export function prescriptionForEvaluationPhase(
  phase: EvaluationPhase,
  exerciseCode: ACREAEntryTestExerciseCode,
): EvaluationPrescription {
  if (phase === 3) {
    return { repetitions: null, restSeconds: 30, series: 1 };
  }
  const prescription = requireEvaluationExercise(exerciseCode)
    .phasePrescriptions[phase];
  return { ...prescription, restSeconds: 90 };
}

export function exerciseSlugForEvaluation(
  exerciseCode: ACREAEntryTestExerciseCode,
) {
  return requireEvaluationExercise(exerciseCode).exerciseSlug;
}

function requireEvaluationExercise(exerciseCode: ACREAEntryTestExerciseCode) {
  const exercise = acreaEntryTestExercises.find(
    (candidate) => candidate.code === exerciseCode,
  );
  if (!exercise) {
    throw new Error(`Exercice d’évaluation inconnu : ${exerciseCode}.`);
  }
  return exercise;
}

export function buildEvaluationStepKinds(exerciseCount: number) {
  if (!Number.isInteger(exerciseCount) || exerciseCount <= 0) {
    throw new Error("Au moins un exercice est requis pour l’évaluation.");
  }
  const steps: ("warmup" | "exercise" | "recovery" | "cooldown")[] = [
    "warmup",
  ];
  for (let index = 0; index < exerciseCount; index += 1) {
    steps.push("exercise");
    if (index < exerciseCount - 1) steps.push("recovery");
  }
  steps.push("cooldown");
  return steps;
}

export function evaluationStepUsesTimer(
  kind: "warmup" | "exercise" | "recovery" | "cooldown",
) {
  return kind !== "recovery";
}

export function evaluationStepAllowsEarlyFinish(
  kind: "warmup" | "exercise" | "recovery" | "cooldown",
) {
  return kind === "warmup" || kind === "cooldown";
}

export function assertValidEvaluationFeedback(
  phase: EvaluationPhase,
  feedback: EvaluationFeedback,
) {
  if (typeof feedback.technicalValid !== "boolean") {
    throw new Error("La validation technique est obligatoire.");
  }
  if (
    !Number.isInteger(feedback.appreciationRating) ||
    Number(feedback.appreciationRating) < 1 ||
    Number(feedback.appreciationRating) > 5
  ) {
    throw new Error("L’appréciation de 1 à 5 est obligatoire.");
  }
  if (
    phase === 3 &&
    (!Number.isInteger(feedback.maximumRepetitions) ||
      Number(feedback.maximumRepetitions) < 0)
  ) {
    throw new Error("Le maximum strict doit être renseigné.");
  }
  if (phase < 3 && feedback.maximumRepetitions !== undefined) {
    throw new Error("Le maximum strict concerne uniquement la séance 3.");
  }
}
import {
  acreaEntryTestExercises,
  type ACREAEntryTestExerciseCode,
} from "../../programming/data/acreaEntryLevelTest";
