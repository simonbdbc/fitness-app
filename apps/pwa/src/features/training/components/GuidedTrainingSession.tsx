import { useEffect, useMemo, useState } from "react";
import { View } from "react-native";
import {
  type ACREATraining,
} from "@features/programming";
import {
  buildSessionTimerPlan,
  GuidedExerciseStep,
  SessionTimerPanel,
  clearSessionTimerState,
  useSessionTimerController,
} from "@features/workouts";
import { ActionButton, Badge, Card, CardHeader } from "@shared/ui";

import {
  buildTrainingGuidedStep,
  createDefaultFeedbackDraft,
  errorMessageFromUnknown,
  formatProgressionContext,
  resolveTimerPlanError,
  sessionFeedbackKey,
  timerFormatFromPrescription,
  type SessionFeedbackDraft,
} from "../domain/trainingPresentation";
import {
  canAdvanceAfterMainExercise,
  mainExerciseRecoverySeconds,
  trainingSessionAllowsEarlyFinish,
} from "../domain/mainExerciseRecovery";
import type { ResolveTrainingCatalogFormat } from "../hooks/useTrainingCatalogFormats";
import { saveTrainingSessionFeedback } from "../services/blockPerformanceRepository";
import {
  clearGuidedTrainingFeedbackResume,
  readGuidedTrainingFeedbackResume,
  writeGuidedTrainingFeedbackResume,
} from "../services/guidedTrainingFeedbackResume";
import { SessionFeedbackPanel } from "./SessionFeedbackPanel";

export function GuidedTrainingSession({
  onBack,
  onFinish,
  onNext,
  profileCode,
  resumeKey,
  resolveFormat,
  sessionIndex,
  training,
}: {
  onBack: () => void;
  onFinish: () => void;
  onNext: () => void;
  profileCode: string;
  resumeKey: string;
  resolveFormat: ResolveTrainingCatalogFormat;
  sessionIndex: number;
  training: ACREATraining;
}) {
  const feedbackResumeKey = `${profileCode}:${resumeKey}:${training.code}`;
  const [feedbackDrafts, setFeedbackDrafts] = useState<
    Record<string, SessionFeedbackDraft>
  >({});
  const [savedSessionIds, setSavedSessionIds] = useState<string[]>([]);
  const [isRestoringFeedback, setIsRestoringFeedback] = useState(true);
  const [saveMessageBySessionId, setSaveMessageBySessionId] = useState<
    Record<string, string>
  >({});
  const [saveErrorBySessionId, setSaveErrorBySessionId] = useState<
    Record<string, string>
  >({});
  const [isSaving, setIsSaving] = useState(false);
  const guidedSessions = training.seances.flatMap((seance, seanceIndex) =>
    seance.sessions.map((session, seanceSessionIndex) => ({
      seance,
      seanceIndex,
      session,
      seanceSessionIndex,
    })),
  );
  const activeStep = guidedSessions[sessionIndex];
  if (!activeStep) {
    throw new Error("Le programme ne contient pas de session guidée valide.");
  }
  const {
    seance: activeSeance,
    seanceIndex: activeSeanceIndex,
    session: activeSession,
    seanceSessionIndex,
  } = activeStep;
  const activeSessionId = sessionFeedbackKey(
    training.code,
    activeSeance.code,
    activeSession.code,
  );
  const isLastSession = sessionIndex === guidedSessions.length - 1;
  resolveFormat(activeSession);
  const timerFormat = timerFormatFromPrescription(activeSession);
  const timerPlan = useMemo(() => {
    if (!timerFormat) {
      return null;
    }

    return buildSessionTimerPlan({
      format: timerFormat,
      label: activeSession.formatLabel,
      workoutPhase: activeSession.phase,
    });
  }, [activeSession.formatLabel, activeSession.phase, timerFormat]);
  const timerPersistenceKey = `training:${profileCode}:${resumeKey}:${activeSessionId}`;
  const timer = useSessionTimerController(timerPlan, timerPersistenceKey);
  const recoveryTimerPlan = useMemo(
    () => buildSessionTimerPlan({
      format: {
        code: `recovery-${activeSessionId}`,
        formatType: "intervalles" as const,
        intervalSeconds: mainExerciseRecoverySeconds,
        label: "Récupération après l’exercice",
        restSeconds: 0,
        seriesCount: 1,
      },
      label: "Récupération après l’exercice",
    }),
    [activeSessionId],
  );
  const recoveryPersistenceKey = `${timerPersistenceKey}:recovery`;
  const recoveryTimer = useSessionTimerController(
    activeSession.phase === "main" && isTimerComplete(timer.snapshot)
      ? recoveryTimerPlan
      : null,
    recoveryPersistenceKey,
  );
  const timerPlanError = resolveTimerPlanError(timerFormat, timerPlan);
  const step = buildTrainingGuidedStep(
    training,
    activeSeance,
    activeSession,
    timerPlan,
  );
  const feedbackDraft =
    feedbackDrafts[activeSessionId] ?? createDefaultFeedbackDraft();
  const saveMessage = saveMessageBySessionId[activeSessionId];
  const saveError = saveErrorBySessionId[activeSessionId];
  const isSessionComplete = Boolean(timer.snapshot?.isComplete);
  const requiresFeedback = activeSession.phase === "main";
  const isFeedbackSaved =
    !requiresFeedback || savedSessionIds.includes(activeSessionId);
  const isRecoveryComplete =
    !requiresFeedback || Boolean(recoveryTimer.snapshot?.isComplete);

  useEffect(() => {
    let active = true;
    setIsRestoringFeedback(true);
    void readGuidedTrainingFeedbackResume(feedbackResumeKey)
      .then((restored) => {
        if (!active) return;
        setFeedbackDrafts(restored.drafts);
        setSavedSessionIds(restored.savedSessionIds);
      })
      .finally(() => {
        if (active) setIsRestoringFeedback(false);
      });

    return () => {
      active = false;
    };
  }, [feedbackResumeKey]);

  useEffect(() => {
    if (isRestoringFeedback) return;
    void writeGuidedTrainingFeedbackResume(feedbackResumeKey, {
      drafts: feedbackDrafts,
      savedSessionIds,
    });
  }, [feedbackDrafts, feedbackResumeKey, isRestoringFeedback, savedSessionIds]);

  useEffect(() => {
    if (
      requiresFeedback &&
      isSessionComplete &&
      recoveryTimer.snapshot?.status === "idle"
    ) {
      recoveryTimer.toggle();
    }
  }, [isSessionComplete, recoveryTimer, requiresFeedback]);

  const updateFeedbackDraft = (updates: Partial<SessionFeedbackDraft>) => {
    setFeedbackDrafts((currentDrafts) => ({
      ...currentDrafts,
      [activeSessionId]: {
        ...feedbackDraft,
        ...updates,
      },
    }));
    setSaveMessageBySessionId((currentMessages) => ({
      ...currentMessages,
      [activeSessionId]: "",
    }));
    setSavedSessionIds((currentIds) =>
      currentIds.filter((sessionId) => sessionId !== activeSessionId),
    );
  };

  const saveCurrentSessionFeedback = async () => {
    if (!isSessionComplete) {
      return false;
    }
    if (!requiresFeedback) return true;
    if (feedbackDraft.appreciationRating === null) {
      setSaveErrorBySessionId((currentErrors) => ({
        ...currentErrors,
        [activeSessionId]: "Choisis une appréciation de 1 à 5 avant d'enregistrer.",
      }));
      return false;
    }

    setIsSaving(true);
    setSaveErrorBySessionId((currentErrors) => ({
      ...currentErrors,
      [activeSessionId]: "",
    }));

    try {
      await saveTrainingSessionFeedback({
        profileCode,
        trainingCode: training.code,
        seanceCode: activeSeance.code,
        seanceIndex: activeSeanceIndex,
        seanceTitle: activeSeance.title,
        sessionCode: activeSession.code,
        sessionIndex: seanceSessionIndex,
        exerciseName: activeSession.exerciseName,
        sessionTemplateId: activeSession.sessionTemplateId,
        exerciseId: activeSession.exerciseId,
        exerciseCode: activeSession.exerciseCode,
        formatId: activeSession.formatId,
        formatCode: activeSession.formatCode ?? null,
        formatLabel: activeSession.formatLabel,
        level: activeSession.level,
        pillar: activeSeance.pillar ?? activeSession.phase,
        sessionPhase: activeSession.phase,
        prescription: activeSession.prescription,
        timerPlanCode: timerPlan?.id ?? null,
        totalSeconds: timer.snapshot?.totalSeconds ?? 0,
        completedSeconds: timer.snapshot?.elapsedSeconds ?? 0,
        phaseCount: timerPlan?.phases.length ?? 0,
        status: timer.snapshot?.isComplete ? "completed" : "stopped",
        effortRating: feedbackDraft.effortRating,
        qualityRating: feedbackDraft.qualityRating,
        appreciationRating: feedbackDraft.appreciationRating,
        painLevel: feedbackDraft.painLevel,
        progressionPreference: feedbackDraft.progressionPreference,
      });
      setSaveMessageBySessionId((currentMessages) => ({
        ...currentMessages,
        [activeSessionId]: "Session enregistrée",
      }));
      setSavedSessionIds((currentIds) =>
        currentIds.includes(activeSessionId)
          ? currentIds
          : [...currentIds, activeSessionId],
      );

      return true;
    } catch (error) {
      setSaveErrorBySessionId((currentErrors) => ({
        ...currentErrors,
        [activeSessionId]: errorMessageFromUnknown(error),
      }));

      return false;
    } finally {
      setIsSaving(false);
    }
  };

  const continueAfterSavedFeedback = async () => {
    if (
      requiresFeedback &&
      !canAdvanceAfterMainExercise({
        feedbackSaved: isFeedbackSaved,
        recoveryComplete: isRecoveryComplete,
      })
    ) {
      if (!isFeedbackSaved) {
        setSaveErrorBySessionId((currentErrors) => ({
          ...currentErrors,
          [activeSessionId]:
            "Enregistre le feedback de session avant de continuer.",
        }));
        return;
      }
      setSaveErrorBySessionId((currentErrors) => ({
        ...currentErrors,
        [activeSessionId]: "Termine ou interromps la récupération avant de continuer.",
      }));
      return;
    }

    await Promise.all([
      clearSessionTimerState(timerPersistenceKey),
      clearSessionTimerState(recoveryPersistenceKey),
    ]);
    if (isLastSession) {
      await clearGuidedTrainingFeedbackResume(feedbackResumeKey);
      onFinish();
      return;
    }

    onNext();
  };

  if (isRestoringFeedback) {
    return (
      <GuidedExerciseStep
        currentIndex={sessionIndex + 1}
        step={step}
        totalCount={guidedSessions.length}
      >
        <Card variant="muted">
          <CardHeader
            description="Récupération des réponses enregistrées sur cet appareil."
            title="Restauration de la séance"
          />
        </Card>
      </GuidedExerciseStep>
    );
  }

  return (
    <GuidedExerciseStep
      currentIndex={sessionIndex + 1}
      footer={
        <View className="flex-row flex-wrap gap-2">
          <ActionButton
            className="min-w-[132px] flex-1"
            onPress={onBack}
            variant="secondary"
          >
            Retour
          </ActionButton>
          {isSessionComplete && requiresFeedback ? (
            <>
              <ActionButton
                className="min-w-[132px] flex-1"
                disabled={isSaving || isFeedbackSaved}
                onPress={() => {
                  void saveCurrentSessionFeedback();
                }}
                variant="secondary"
              >
                {isSaving ? "Enregistrement..." : "Enregistrer"}
              </ActionButton>
              <ActionButton
                className="min-w-[132px] flex-1"
                disabled={isSaving || !isFeedbackSaved || !isRecoveryComplete}
                onPress={continueAfterSavedFeedback}
                variant="primary"
              >
                {isLastSession ? "Terminer la séance" : "Session suivante"}
              </ActionButton>
            </>
          ) : isSessionComplete ? (
            <ActionButton
              className="min-w-[132px] flex-1"
              onPress={continueAfterSavedFeedback}
              variant="primary"
            >
              {isLastSession ? "Terminer la séance" : "Continuer"}
            </ActionButton>
          ) : null}
        </View>
      }
      step={step}
      totalCount={guidedSessions.length}
    >
      {timerPlan && timer.isRestoring ? (
        <Card variant="muted">
          <CardHeader
            description="Récupération de la progression enregistrée sur cet appareil."
            title="Restauration du minuteur"
          />
        </Card>
      ) : timerPlan && timer.snapshot ? (
        <SessionTimerPanel
          allowEarlyFinish={trainingSessionAllowsEarlyFinish(activeSession.phase)}
          isPreparing={timer.isPreparing}
          onCompleteEffortPhase={timer.completeEffortPhase}
          onFinish={timer.finish}
          onReset={timer.reset}
          onToggle={timer.toggle}
          plan={timerPlan}
          snapshot={timer.snapshot}
        />
      ) : timerPlanError ? (
        <Card>
          <CardHeader
            title="Format de session incomplet"
            description={timerPlanError}
            action={<Badge variant="warning">Format</Badge>}
          />
        </Card>
      ) : null}

      {isSessionComplete && requiresFeedback ? (
        <>
          {recoveryTimerPlan && recoveryTimer.isRestoring ? (
            <Card variant="muted">
              <CardHeader
                description="Récupération de la progression enregistrée sur cet appareil."
                title="Restauration du minuteur"
              />
            </Card>
          ) : recoveryTimerPlan && recoveryTimer.snapshot ? (
            <Card>
              <CardHeader
                description="Le feedback peut être rempli pendant ces 90 secondes."
                title="Récupération"
              />
              <SessionTimerPanel
                allowEarlyFinish
                isPreparing={recoveryTimer.isPreparing}
                onCompleteEffortPhase={recoveryTimer.completeEffortPhase}
                onFinish={recoveryTimer.finish}
                onReset={recoveryTimer.reset}
                onToggle={recoveryTimer.toggle}
                plan={recoveryTimerPlan}
                snapshot={recoveryTimer.snapshot}
              />
            </Card>
          ) : null}
          <SessionFeedbackPanel
            draft={feedbackDraft}
            onChange={updateFeedbackDraft}
            progressionContext={formatProgressionContext(activeSession)}
            saveError={saveError}
            saveMessage={saveMessage}
          />
        </>
      ) : null}
    </GuidedExerciseStep>
  );
}

function isTimerComplete(snapshot: { isComplete: boolean } | null) {
  return Boolean(snapshot?.isComplete);
}
