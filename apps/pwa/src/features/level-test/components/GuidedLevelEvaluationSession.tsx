import { useEffect, useMemo, useState } from "react";
import { View } from "react-native";

import {
  acreaEntryTestExercises,
  acreaEntryWarmupItems,
  acreaPillarLabels,
  type ACREAEntryTestExercise,
} from "@features/programming";
import {
  buildSessionTimerPlan,
  clearSessionTimerState,
  GuidedExerciseStep,
  SessionTimerPanel,
  useSessionTimerController,
  type GuidedExerciseStepData,
  type SessionTimerPlan,
} from "@features/workouts";
import { ActionButton, BodyText, Card, CardHeader } from "@shared/ui";

import {
  completeLevelEvaluationSession,
  levelEvaluationStepCount,
  prescriptionForPhase,
  recordLevelEvaluationResult,
  updateLevelEvaluationSessionStep,
  type LevelEvaluationPhase,
  type PersistedLevelEvaluationSession,
} from "../services/levelTestRepository";
import {
  evaluationStepAllowsEarlyFinish,
  evaluationStepUsesTimer,
} from "../domain/levelTestProtocol";
import {
  clearLevelEvaluationFeedbackDraft,
  defaultDraft,
  readLevelEvaluationFeedbackDraft,
  writeLevelEvaluationFeedbackDraft,
  type LevelEvaluationFeedbackDraft,
} from "../services/levelEvaluationResume";
import { LevelEvaluationFeedbackPanel } from "./LevelEvaluationFeedbackPanel";

type EvaluationStep =
  | { kind: "warmup" }
  | { exercise: ACREAEntryTestExercise; kind: "exercise" }
  | { kind: "recovery"; nextExercise: ACREAEntryTestExercise }
  | { kind: "cooldown" };

export function GuidedLevelEvaluationSession({
  attemptId,
  onComplete,
  onExit,
  profileId,
  session,
}: {
  attemptId: number;
  onComplete: (passed: boolean) => void;
  onExit: () => void;
  profileId: string;
  session: PersistedLevelEvaluationSession;
}) {
  const steps = useMemo(createEvaluationSteps, []);
  const [activeStepIndex, setActiveStepIndex] = useState(
    session.activeStepIndex,
  );
  const [draft, setDraft] = useState<LevelEvaluationFeedbackDraft>(
    defaultDraft,
  );
  const [restoredDraftKey, setRestoredDraftKey] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState("");
  const activeStep = steps[activeStepIndex] ?? steps[0];
  const feedbackKey =
    activeStep.kind === "exercise"
      ? `${profileId}:${attemptId}:${session.id}:${activeStep.exercise.code}`
      : `${profileId}:${attemptId}:${session.id}:step-${activeStepIndex}`;
  const isRestoringDraft =
    activeStep.kind === "exercise" && restoredDraftKey !== feedbackKey;
  const timerPlan = useMemo(
    () => buildEvaluationTimerPlan(activeStep, session.phase),
    [activeStep, session.phase],
  );
  const timerPersistenceKey = `evaluation:${profileId}:${attemptId}:${session.id}:${activeStepIndex}`;
  const timer = useSessionTimerController(timerPlan, timerPersistenceKey);

  useEffect(() => {
    setActiveStepIndex(session.activeStepIndex);
  }, [session.activeStepIndex]);

  useEffect(() => {
    let active = true;
    setError("");
    if (activeStep.kind !== "exercise") {
      setDraft(defaultDraft());
      setRestoredDraftKey(null);
      return () => {
        active = false;
      };
    }

    void readLevelEvaluationFeedbackDraft(feedbackKey)
      .then((restored) => {
        if (active) setDraft(restored);
      })
      .finally(() => {
        if (active) setRestoredDraftKey(feedbackKey);
      });

    return () => {
      active = false;
    };
  }, [activeStep.kind, feedbackKey]);

  useEffect(() => {
    if (activeStep.kind === "exercise" && !isRestoringDraft) {
      void writeLevelEvaluationFeedbackDraft(feedbackKey, draft);
    }
  }, [activeStep.kind, draft, feedbackKey, isRestoringDraft]);

  const advance = async () => {
    const nextStepIndex = activeStepIndex + 1;
    if (nextStepIndex >= steps.length) return;
    setIsSaving(true);
    setError("");
    try {
      await updateLevelEvaluationSessionStep(session.id, nextStepIndex);
      await clearSessionTimerState(timerPersistenceKey);
      setActiveStepIndex(nextStepIndex);
    } catch (unknownError) {
      setError(errorText(unknownError));
    } finally {
      setIsSaving(false);
    }
  };

  const saveExercise = async () => {
    if (activeStep.kind !== "exercise" || !timer.snapshot?.isComplete) return;
    if (draft.appreciationRating === null) {
      setError("Choisis une appréciation de 1 à 5 avant de continuer.");
      return;
    }
    if (draft.technicalValid === null) {
      setError("Indique si la technique est validée avant de continuer.");
      return;
    }
    const nextStepIndex = activeStepIndex + 1;
    setIsSaving(true);
    setError("");
    try {
      await recordLevelEvaluationResult({
        appreciationRating: draft.appreciationRating,
        completedSeconds: timer.snapshot.sessionElapsedSeconds,
        evaluationSessionId: session.id,
        exerciseCode: activeStep.exercise.code,
        maximumRepetitions:
          session.phase === 3
            ? Number.parseInt(draft.maximumRepetitions, 10)
            : undefined,
        nextStepIndex,
        technicalValid: draft.technicalValid,
        timerPlanCode: requireTimerPlan(timerPlan).id,
        totalSeconds: timer.snapshot.totalSeconds,
      });
      await clearLevelEvaluationFeedbackDraft(feedbackKey);
      await clearSessionTimerState(timerPersistenceKey);
      setActiveStepIndex(nextStepIndex);
    } catch (unknownError) {
      setError(errorText(unknownError));
    } finally {
      setIsSaving(false);
    }
  };

  const completeSession = async () => {
    if (!timer.snapshot?.isComplete) return;
    setIsSaving(true);
    setError("");
    try {
      const result = await completeLevelEvaluationSession(session.id);
      await clearSessionTimerState(timerPersistenceKey);
      onComplete(result.passed);
    } catch (unknownError) {
      setError(errorText(unknownError));
    } finally {
      setIsSaving(false);
    }
  };

  const isTimerComplete =
    activeStep.kind === "recovery" || Boolean(timer.snapshot?.isComplete);
  const guidedStep = buildGuidedStep(activeStep, session.phase);

  return (
    <GuidedExerciseStep
      currentIndex={activeStepIndex + 1}
      footer={
        <View className="gap-2">
          {error ? <BodyText>{error}</BodyText> : null}
          <View className="flex-row flex-wrap gap-2">
            <ActionButton
              className="min-w-[132px] flex-1"
              disabled={isSaving}
              onPress={onExit}
              variant="secondary"
            >
              Quitter la séance
            </ActionButton>
            {isTimerComplete && activeStep.kind === "exercise" ? (
              <ActionButton
                className="min-w-[132px] flex-1"
                disabled={isSaving || isRestoringDraft}
                onPress={() => void saveExercise()}
                variant="primary"
              >
                {isSaving ? "Enregistrement..." : "Enregistrer et continuer"}
              </ActionButton>
            ) : isTimerComplete && activeStep.kind === "cooldown" ? (
              <ActionButton
                className="min-w-[132px] flex-1"
                disabled={isSaving || isRestoringDraft}
                onPress={() => void completeSession()}
                variant="primary"
              >
                {isSaving ? "Validation..." : "Terminer la séance"}
              </ActionButton>
            ) : isTimerComplete ? (
              <ActionButton
                className="min-w-[132px] flex-1"
                disabled={isSaving || isRestoringDraft}
                onPress={() => void advance()}
                variant="primary"
              >
                Continuer
              </ActionButton>
            ) : null}
          </View>
        </View>
      }
      step={guidedStep}
      totalCount={levelEvaluationStepCount}
    >
      {activeStep.kind === "recovery" ? (
        <Card variant="info">
          <CardHeader
            description={`Prochain exercice : ${activeStep.nextExercise.name}`}
            title="Récupération libre 2 à 3 min"
          />
          <BodyText>
            Respire calmement, laisse le rythme cardiaque redescendre et
            continue lorsque tu te sens prêt.
          </BodyText>
        </Card>
      ) : timerPlan && timer.isRestoring ? (
        <Card variant="muted">
          <CardHeader
            description="Récupération de la progression enregistrée sur cet appareil."
            title="Restauration du minuteur"
          />
        </Card>
      ) : timerPlan && timer.snapshot ? (
        <SessionTimerPanel
          allowEarlyFinish={evaluationStepAllowsEarlyFinish(activeStep.kind)}
          isPreparing={timer.isPreparing}
          onCompleteEffortPhase={timer.completeEffortPhase}
          onFinish={timer.finish}
          onReset={timer.reset}
          onToggle={timer.toggle}
          plan={timerPlan}
          snapshot={timer.snapshot}
        />
      ) : null}

      {isRestoringDraft && activeStep.kind === "exercise" ? (
        <Card variant="muted">
          <CardHeader
            description="Récupération de la saisie enregistrée sur cet appareil."
            title="Restauration du feedback"
          />
        </Card>
      ) : isTimerComplete && activeStep.kind === "exercise" ? (
        <LevelEvaluationFeedbackPanel
          draft={draft}
          isMaximumPhase={session.phase === 3}
          onChange={(updates) =>
            setDraft((current) => ({ ...current, ...updates }))
          }
        />
      ) : null}
    </GuidedExerciseStep>
  );
}

function createEvaluationSteps(): EvaluationStep[] {
  const steps: EvaluationStep[] = [{ kind: "warmup" }];
  acreaEntryTestExercises.forEach((exercise, index) => {
    steps.push({ exercise, kind: "exercise" });
    const nextExercise = acreaEntryTestExercises[index + 1];
    if (nextExercise) steps.push({ kind: "recovery", nextExercise });
  });
  steps.push({ kind: "cooldown" });
  return steps;
}

function buildEvaluationTimerPlan(
  step: EvaluationStep,
  phase: LevelEvaluationPhase,
): SessionTimerPlan | null {
  if (step.kind === "exercise") {
    const prescription = prescriptionForPhase(phase, step.exercise.code);
    return requireTimerPlan(
      buildSessionTimerPlan({
        format: {
          code: evaluationFormatCode(prescription),
          formatType: "repetitions",
          label: evaluationFormatLabel(phase, step.exercise),
          repetitions: prescription.repetitions,
          restSeconds: prescription.restSeconds,
          seriesCount: prescription.series,
        },
        label: evaluationFormatLabel(phase, step.exercise),
      }),
    );
  }
  if (!evaluationStepUsesTimer(step.kind)) return null;
  const seconds = 300;
  const label =
    step.kind === "warmup"
      ? "Proposition d’échauffement - 5 min"
      : "Proposition d’assouplissements - 5 min";
  return requireTimerPlan(
    buildSessionTimerPlan({
      format: {
        code: `evaluation-${phase}-${step.kind}`,
        formatType: "intervalles",
        intervalSeconds: seconds,
        label,
        restSeconds: 0,
        seriesCount: 1,
      },
      label,
      workoutPhase: step.kind,
    }),
  );
}

function buildGuidedStep(
  step: EvaluationStep,
  phase: LevelEvaluationPhase,
): GuidedExerciseStepData {
  const eyebrow = `Évaluation - séance ${phase}/3`;
  if (step.kind === "warmup") {
    return {
      badgeLabel: "Échauffement",
      eyebrow,
      id: `evaluation-${phase}-warmup`,
      sections: [{ items: acreaEntryWarmupItems, title: "Préparation" }],
      subtitle: "Proposition libre pour préparer le corps sans créer de fatigue.",
      timerLabel: "Jusqu’à 5 minutes",
      timerSeconds: 300,
      title: "Échauffement général",
    };
  }
  if (step.kind === "cooldown") {
    return {
      badgeLabel: "Retour au calme",
      eyebrow,
      id: `evaluation-${phase}-cooldown`,
      sections: [
        {
          items: [
            "Marche lente et respiration calme.",
            "Mobilité douce des poignets, épaules, hanches et jambes.",
            "Aucune position douloureuse ni étirement forcé.",
          ],
          title: "Consignes",
        },
      ],
      timerLabel: "Jusqu’à 5 minutes",
      timerSeconds: 300,
      title: "Assouplissements libres",
    };
  }
  if (step.kind === "recovery") {
    return {
      badgeLabel: "Récupération",
      eyebrow,
      id: `evaluation-${phase}-recovery-${step.nextExercise.code}`,
      sections: [
        {
          items: [
            "Respire calmement et laisse le rythme cardiaque redescendre.",
            `Prépare l’exercice suivant : ${step.nextExercise.name}.`,
          ],
          title: "Transition",
        },
      ],
      timerLabel: "Récupération libre 2 à 3 min",
      timerSeconds: undefined,
      title: "Récupération entre exercices",
    };
  }

  return {
    badgeLabel: acreaPillarLabels[step.exercise.pillar],
    eyebrow,
    id: `evaluation-${phase}-${step.exercise.code}`,
    sections: [
      { items: [step.exercise.objective], title: "Objectif", tone: "success" },
      { items: step.exercise.setup, title: "Mise en place" },
      { items: step.exercise.execution, title: "Exécution" },
      { items: [evaluationFormatLabel(phase, step.exercise)], title: "Format" },
      { items: [step.exercise.amplitudeRule], title: "Amplitude" },
      { items: [step.exercise.breathing], title: "Respiration" },
      { items: step.exercise.commonMistakes, title: "Erreurs à éviter", tone: "warning" },
    ],
    subtitle: step.exercise.protocolRole,
    timerLabel: evaluationFormatLabel(phase, step.exercise),
    timerSeconds:
      phase < 3
        ? prescriptionForPhase(phase, step.exercise.code).restSeconds
        : undefined,
    title: step.exercise.name,
    warning: step.exercise.stopRule,
  };
}

function evaluationFormatCode({
  repetitions,
  restSeconds,
  series,
}: {
  repetitions: number | null;
  restSeconds: number;
  series: number;
}) {
  const repetitionsPart = repetitions === null
    ? "maximum"
    : `r${String(repetitions).padStart(2, "0")}`;
  return `format-reps-s${String(series).padStart(2, "0")}-${repetitionsPart}-rest${restSeconds}s`;
}

function evaluationFormatLabel(
  phase: LevelEvaluationPhase,
  exercise: ACREAEntryTestExercise,
) {
  if (phase < 3) {
    const prescription = prescriptionForPhase(phase, exercise.code);
    return `${prescription.series} séries de ${prescription.repetitions} - repos 90 s`;
  }
  return "1 série maximale stricte";
}

function requireTimerPlan(plan: SessionTimerPlan | null): SessionTimerPlan {
  if (!plan) throw new Error("Format d’évaluation invalide.");
  return plan;
}

function errorText(error: unknown) {
  return error instanceof Error
    ? error.message
    : "Enregistrement de l’évaluation impossible.";
}
