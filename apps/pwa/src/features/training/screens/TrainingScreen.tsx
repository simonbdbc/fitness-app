import { useRouter } from "expo-router";
import { useMemo, useState } from "react";
import { View } from "react-native";

import {
  acreaLevelEvaluationProtocolVersion,
  isACREAProfileComplete,
  useACREAProfile,
  type ACREATraining,
} from "@features/programming";
import {
  ActionButton,
  Badge,
  BodyText,
  Card,
  CardHeader,
  TitleText,
} from "@shared/ui";

import { GuidedTrainingSession } from "../components/GuidedTrainingSession";
import { TrainingCard } from "../components/TrainingCard";
import { TrainingWeekSummary } from "../components/TrainingWeekSummary";
import { useTrainingCatalogFormats } from "../hooks/useTrainingCatalogFormats";
import { useGuidedTrainingResume } from "../hooks/useGuidedTrainingResume";
import { useWeeklyTrainingPlan } from "../hooks/useWeeklyTrainingPlan";
import { clearGuidedTrainingResume } from "../services/guidedTrainingResume";

export function TrainingScreen() {
  const router = useRouter();
  const { profile, weeklyProgramRevision } = useACREAProfile();
  const programProfile = isACREAProfileComplete(profile) ? profile : null;
  const {
    error: catalogFormatError,
    isLoading: areCatalogFormatsLoading,
    resolveFormat,
  } = useTrainingCatalogFormats();
  const { loadError, reload, setTrainingStatus, weekPlan } =
    useWeeklyTrainingPlan(programProfile, weeklyProgramRevision);
  const [guidedTrainingCode, setGuidedTrainingCode] = useState<
    ACREATraining["code"] | null
  >(null);
  const [guidedSessionIndex, setGuidedSessionIndex] = useState(0);
  const trainings = weekPlan?.trainings ?? [];
  const planResumeKey = useMemo(
    () =>
      weekPlan
        ? JSON.stringify({
            catalogVersion: weekPlan.catalogVersion,
            isoWeekNumber: weekPlan.isoWeekNumber,
            isoWeekYear: weekPlan.isoWeekYear,
            schemaVersion: weekPlan.schemaVersion,
            trainings: weekPlan.trainings.map((training) => ({
              code: training.code,
              scheduledDate: training.scheduledDate,
              sessions: training.seances.flatMap((seance) =>
                seance.sessions.map((session) => ({
                  code: session.code,
                  exerciseId: session.exerciseId,
                  formatId: session.formatId,
                  prescription: session.prescription,
                  sessionTemplateId: session.sessionTemplateId,
                })),
              ),
            })),
          })
        : null,
    [weekPlan],
  );
  const guidedTraining = guidedTrainingCode
    ? trainings.find((training) => training.code === guidedTrainingCode)
    : undefined;

  const { isRestoringGuidedSession } = useGuidedTrainingResume({
    guidedSessionIndex,
    guidedTrainingCode,
    planResumeKey,
    profileId: profile.id,
    setGuidedSessionIndex,
    setGuidedTrainingCode,
    trainings,
  });

  if (
    profile.levelTestStatus !== "completed" ||
    profile.levelTestVersion < acreaLevelEvaluationProtocolVersion ||
    Object.values(profile.pillarLevels).some((level) => level === null)
  ) {
    return (
      <View className="w-full max-w-full min-w-0 gap-4">
        <TitleText>Entraînement</TitleText>
        <Card variant="info">
          <CardHeader
            title="Évaluation de niveau requise"
            description="Les trois séances d’évaluation ACREA doivent être validées avant la génération."
          />
          <ActionButton onPress={() => router.push("/level-test")} variant="primary">
            Ouvrir l’évaluation de niveau
          </ActionButton>
        </Card>
      </View>
    );
  }

  if (!programProfile) {
    return (
      <View className="w-full max-w-full min-w-0 gap-4">
        <TitleText>Entraînement</TitleText>
        <Card variant="info">
          <CardHeader
            title="Réglages du profil requis"
            description="Renseigne ton objectif, ton rythme, la durée et au moins un jour pour générer la semaine."
          />
          <ActionButton onPress={() => router.push("/profile")} variant="primary">
            Ouvrir mon profil
          </ActionButton>
        </Card>
      </View>
    );
  }

  if (guidedTraining) {
    return (
      <GuidedTrainingSession
        onBack={() => {
          if (guidedSessionIndex === 0) {
            void clearGuidedTrainingResume(profile.id);
            setGuidedTrainingCode(null);
            return;
          }

          setGuidedSessionIndex((currentIndex) => currentIndex - 1);
        }}
        onFinish={() => {
          setTrainingStatus(guidedTraining.code, "terminee");
          void clearGuidedTrainingResume(profile.id);
          setGuidedTrainingCode(null);
          setGuidedSessionIndex(0);
        }}
        onNext={() => setGuidedSessionIndex((currentIndex) => currentIndex + 1)}
        profileCode={profile.id}
        resumeKey={planResumeKey ?? "programme-inconnu"}
        resolveFormat={resolveFormat}
        sessionIndex={guidedSessionIndex}
        training={guidedTraining}
      />
    );
  }

  if (!weekPlan) {
    return (
      <View className="w-full max-w-full min-w-0 gap-4">
        <TitleText>Entraînement</TitleText>
        <Card variant={loadError ? "default" : "muted"}>
          <CardHeader
            action={
              <Badge variant={loadError ? "warning" : "info"}>
                {loadError ? "Erreur" : "ACREA"}
              </Badge>
            }
            description={loadError ?? "Chargement de la semaine enregistrée..."}
            title={
              loadError ? "Programme indisponible" : "Préparation du programme"
            }
          />
          {loadError ? (
            <ActionButton onPress={reload} variant="secondary">
              Réessayer
            </ActionButton>
          ) : null}
        </Card>
      </View>
    );
  }

  if (isRestoringGuidedSession) {
    return (
      <View className="w-full max-w-full min-w-0 gap-4">
        <TitleText>Entraînement</TitleText>
        <Card variant="muted">
          <CardHeader
            description="Récupération de la séance enregistrée sur cet appareil."
            title="Restauration de l’entraînement"
          />
        </Card>
      </View>
    );
  }

  return (
    <View className="w-full max-w-full min-w-0 gap-4">
      <View className="gap-2">
        <TitleText>Entraînement</TitleText>
        <BodyText>
          Semaine {weekPlan.isoWeekNumber} ACREA : volume prudent, trois
          piliers, timers et technique propre.
        </BodyText>
      </View>

      <TrainingWeekSummary profile={programProfile} weekPlan={weekPlan} />

      {loadError ? (
        <Card variant="muted">
          <BodyText>{loadError}</BodyText>
        </Card>
      ) : null}

      {catalogFormatError ? (
        <Card variant="muted">
          <BodyText>
            Formats du catalogue indisponibles : {catalogFormatError}
          </BodyText>
        </Card>
      ) : null}

      <View className="gap-3">
        {trainings.map((training) => (
          <TrainingCard
            isGuideDisabled={
              areCatalogFormatsLoading || Boolean(catalogFormatError)
            }
            key={training.code}
            onOpenGuide={() => {
              void clearGuidedTrainingResume(profile.id);
              setGuidedTrainingCode(training.code);
              setGuidedSessionIndex(0);
            }}
            onStatusChange={(status) =>
              setTrainingStatus(training.code, status)
            }
            resolveFormat={resolveFormat}
            training={training}
          />
        ))}
      </View>
    </View>
  );
}
