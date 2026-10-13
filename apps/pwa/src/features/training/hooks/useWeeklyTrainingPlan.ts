import { useCallback, useEffect, useState } from "react";

import {
  acreaLevelEvaluationProtocolVersion,
  generateWeeklyProgram,
  updateWeeklyTrainingStatus,
  type ACREAProfile,
  type ACREATraining,
  type ACREAWeekPlan,
} from "@features/programming";

import {
  errorMessageFromUnknown,
  type TrainingStatus,
} from "../domain/trainingPresentation";

export function useWeeklyTrainingPlan(
  profile: ACREAProfile | null,
  weeklyProgramRevision: number,
) {
  const [weekPlan, setWeekPlan] = useState<ACREAWeekPlan | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [reloadToken, setReloadToken] = useState(0);

  useEffect(() => {
    let active = true;
    setWeekPlan(null);
    setLoadError(null);
    if (
      !profile ||
      profile.levelTestStatus !== "completed" ||
      profile.levelTestVersion < acreaLevelEvaluationProtocolVersion
    ) {
      return;
    }

    void generateWeeklyProgram(profile)
      .then((plan) => {
        if (active) setWeekPlan(plan);
      })
      .catch((error: unknown) => {
        if (active) setLoadError(errorMessageFromUnknown(error));
      });

    return () => {
      active = false;
    };
  }, [profile, reloadToken, weeklyProgramRevision]);

  const reload = useCallback(() => {
    setReloadToken((currentToken) => currentToken + 1);
  }, []);

  const setTrainingStatus = useCallback(
    (code: ACREATraining["code"], status: TrainingStatus) => {
      if (!weekPlan) return;

      const previousStatus = weekPlan.trainings.find(
        (training) => training.code === code,
      )?.status;
      setWeekPlan((currentPlan) =>
        currentPlan
          ? {
              ...currentPlan,
              trainings: currentPlan.trainings.map((training) =>
                training.code === code ? { ...training, status } : training,
              ),
            }
          : currentPlan,
      );
      setLoadError(null);

      if (!profile) return;
      void updateWeeklyTrainingStatus(
        profile.id,
        weekPlan.isoWeekYear,
        weekPlan.isoWeekNumber,
        code,
        status,
      ).catch((error: unknown) => {
        setWeekPlan((currentPlan) =>
          currentPlan && previousStatus
            ? {
                ...currentPlan,
                trainings: currentPlan.trainings.map((training) =>
                  training.code === code
                    ? { ...training, status: previousStatus }
                    : training,
                ),
              }
            : currentPlan,
        );
        setLoadError(errorMessageFromUnknown(error));
      });
    },
    [profile, weekPlan],
  );

  return { loadError, reload, setTrainingStatus, weekPlan };
}
