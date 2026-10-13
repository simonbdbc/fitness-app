import { useEffect, useState } from "react";

import type { ACREATraining } from "@features/programming";

import {
  clearGuidedTrainingResume,
  readGuidedTrainingResume,
  writeGuidedTrainingResume,
} from "../services/guidedTrainingResume";

export function useGuidedTrainingResume({
  guidedSessionIndex,
  guidedTrainingCode,
  planResumeKey,
  profileId,
  setGuidedSessionIndex,
  setGuidedTrainingCode,
  trainings,
}: {
  guidedSessionIndex: number;
  guidedTrainingCode: ACREATraining["code"] | null;
  planResumeKey: string | null;
  profileId: string;
  setGuidedSessionIndex: (index: number) => void;
  setGuidedTrainingCode: (code: ACREATraining["code"] | null) => void;
  trainings: ACREATraining[];
}) {
  const [isRestoringGuidedSession, setIsRestoringGuidedSession] =
    useState(false);

  useEffect(() => {
    let active = true;
    if (!planResumeKey || guidedTrainingCode) {
      setIsRestoringGuidedSession(false);
      return () => {
        active = false;
      };
    }

    setIsRestoringGuidedSession(true);
    void readGuidedTrainingResume(profileId, planResumeKey)
      .then(async (saved) => {
        if (!active || !saved) return;
        const training = trainings.find(
          ({ code }) => code === saved.trainingCode,
        );
        const sessionCount =
          training?.seances.reduce(
            (count, seance) => count + seance.sessions.length,
            0,
          ) ?? 0;
        if (!training || saved.sessionIndex >= sessionCount) {
          await clearGuidedTrainingResume(profileId);
          return;
        }
        setGuidedTrainingCode(training.code);
        setGuidedSessionIndex(saved.sessionIndex);
      })
      .finally(() => {
        if (active) setIsRestoringGuidedSession(false);
      });

    return () => {
      active = false;
    };
  }, [
    guidedTrainingCode,
    planResumeKey,
    profileId,
    setGuidedSessionIndex,
    setGuidedTrainingCode,
    trainings,
  ]);

  useEffect(() => {
    if (!planResumeKey || !guidedTrainingCode) return;
    void writeGuidedTrainingResume(profileId, {
      planKey: planResumeKey,
      sessionIndex: guidedSessionIndex,
      trainingCode: guidedTrainingCode,
    });
  }, [guidedSessionIndex, guidedTrainingCode, planResumeKey, profileId]);

  return { isRestoringGuidedSession };
}
