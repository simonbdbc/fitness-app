import { useRouter } from "expo-router";
import { useEffect, useState } from "react";
import { View } from "react-native";

import {
  acreaLevelEvaluationProtocolVersion,
  acreaPillarLabels,
  isACREAProfileComplete,
  loadCurrentWeeklyProgram,
  useACREAProfile,
  type ACREAPillar,
  type ACREAWeekPlan,
} from "@features/programming";
import { useThemeTokens } from "@shared/theme";
import {
  ActionButton,
  Badge,
  BodyText,
  Card,
  CardHeader,
  StatTile,
  TitleText,
} from "@shared/ui";

export function HomeScreen() {
  const router = useRouter();
  const tokens = useThemeTokens();
  const { profile, weeklyProgramRevision } = useACREAProfile();
  const [weekPlan, setWeekPlan] = useState<ACREAWeekPlan | null>(null);
  const [generationError, setGenerationError] = useState<string | null>(null);
  const evaluationRequired =
    profile.levelTestStatus !== "completed" ||
    profile.levelTestVersion < acreaLevelEvaluationProtocolVersion ||
    Object.values(profile.pillarLevels).some((level) => level === null);
  const isProfileComplete = isACREAProfileComplete(profile);

  useEffect(() => {
    let active = true;
    setGenerationError(null);
    if (evaluationRequired || !isProfileComplete) {
      setWeekPlan(null);
      return () => {
        active = false;
      };
    }
    void loadCurrentWeeklyProgram(profile)
      .then((plan) => {
        if (active) setWeekPlan(plan);
      })
      .catch((error: unknown) => {
        if (!active) return;
        setGenerationError(
          error instanceof Error
            ? error.message
            : typeof error === "string" && error.trim()
              ? error
              : "Le programme hebdomadaire est indisponible.",
        );
      });
    return () => {
      active = false;
    };
  }, [evaluationRequired, isProfileComplete, profile, weeklyProgramRevision]);

  const today = localIsoDate(new Date());
  const plannedTrainings = weekPlan?.trainings ?? [];
  const todayTraining = plannedTrainings.find(
    (training) =>
      training.status === "a faire" && training.scheduledDate === today,
  );
  const nextTraining =
    todayTraining ??
    plannedTrainings.find(
      (training) =>
        training.status === "a faire" && training.scheduledDate >= today,
    );
  const completedCount = plannedTrainings.filter(
    (training) => training.status === "terminee",
  ).length;
  const progressPercent = plannedTrainings.length
    ? Math.round((completedCount / plannedTrainings.length) * 100)
    : 0;

  return (
    <View className="w-full max-w-full min-w-0 gap-5">
      <View className="gap-2">
        <TitleText>Aujourd’hui</TitleText>
        <BodyText>
          Ton entraînement du jour ou ton évaluation, tes niveaux ACREA et ta
          progression de la semaine.
        </BodyText>
      </View>

      <View className="gap-3">
        <TitleText className="text-lg leading-6">
          Ton entraînement du jour
        </TitleText>
        {evaluationRequired ? (
          <Card variant="info">
            <CardHeader
              action={<Badge variant="warning">À faire</Badge>}
              description="Tes trois niveaux seront calculés à partir des séances d’évaluation, sans valeur préremplie."
              title="Évaluation de niveau ACREA"
            />
            <ActionButton
              onPress={() => router.push("/level-test")}
              variant="primary"
            >
              Commencer l’évaluation
            </ActionButton>
          </Card>
        ) : !isProfileComplete ? (
          <Card variant="info">
            <CardHeader
              action={<Badge variant="warning">Incomplet</Badge>}
              description="Choisis ton objectif, ton rythme, la durée et au moins un jour d’entraînement."
              title="Finalise ton profil"
            />
            <ActionButton
              onPress={() => router.push("/profile")}
              variant="primary"
            >
              Compléter mon profil
            </ActionButton>
          </Card>
        ) : nextTraining ? (
          <Card variant={todayTraining ? "success" : "default"}>
            <CardHeader
              action={
                <Badge variant={todayTraining ? "success" : "info"}>
                  {todayTraining ? "Aujourd’hui" : nextTraining.day}
                </Badge>
              }
              description={`${nextTraining.durationMinutes} min · ${
                acreaPillarLabels[nextTraining.dominantPillar]
              }`}
              title={nextTraining.title}
            />
            <ActionButton
              onPress={() => router.push("/training")}
              variant="primary"
            >
              Ouvrir l’entraînement
            </ActionButton>
          </Card>
        ) : (
          <Card variant="muted">
            <CardHeader
              action={generationError ? <Badge variant="warning">Erreur</Badge> : undefined}
              description={
                generationError ?? "Aucune séance n’est encore planifiée."
              }
              title={
                generationError
                  ? "Programme indisponible"
                  : "Semaine terminée"
              }
            />
          </Card>
        )}
      </View>

      <View className="gap-3">
        <TitleText className="text-lg leading-6">Tes niveaux ACREA</TitleText>
        <View className="flex-row flex-wrap gap-3">
          {(Object.keys(acreaPillarLabels) as ACREAPillar[]).map((pillar) => (
            <Card className="min-w-[160px] flex-1 py-3" key={pillar}>
              <StatTile
                label={acreaPillarLabels[pillar]}
                tone={pillar === "strength" ? "success" : "default"}
                value={levelLabel(profile.pillarLevels[pillar])}
              />
            </Card>
          ))}
        </View>
      </View>

      <View className="gap-3">
        <TitleText className="text-lg leading-6">
          Progression de la semaine
        </TitleText>
        <Card>
          <CardHeader
            action={
              <Badge variant={progressPercent === 100 ? "success" : "info"}>
                {progressPercent} %
              </Badge>
            }
            description={weeklyProgressDescription({
              evaluationRequired,
              generationError,
              isProfileComplete,
              plannedCount: plannedTrainings.length,
            })}
            title={
              plannedTrainings.length
                ? `${completedCount} séance${completedCount > 1 ? "s" : ""} terminée${completedCount > 1 ? "s" : ""}`
                : "Progression à venir"
            }
          />
          <View
            accessibilityLabel="Progression des séances de la semaine"
            accessibilityRole="progressbar"
            accessibilityValue={{
              max: plannedTrainings.length || 1,
              min: 0,
              now: completedCount,
            }}
            className="h-3 w-full overflow-hidden"
            style={{
              backgroundColor: tokens.colors.surfaceMuted,
              borderRadius: 6,
            }}
          >
            <View
              className="h-full"
              style={{
                backgroundColor: tokens.colors.successText,
                borderRadius: 6,
                width: `${progressPercent}%`,
              }}
            />
          </View>
          {plannedTrainings.length ? (
            <View className="flex-row flex-wrap gap-3">
              <StatTile
                label="terminées"
                tone="success"
                value={`${completedCount}`}
              />
              <StatTile label="planifiées" value={`${plannedTrainings.length}`} />
              <StatTile
                label="restantes"
                tone="info"
                value={`${plannedTrainings.length - completedCount}`}
              />
            </View>
          ) : null}
        </Card>
      </View>
    </View>
  );
}

function levelLabel(level: number | null) {
  return level === null ? "À évaluer" : `Niveau ${level}`;
}

function weeklyProgressDescription({
  evaluationRequired,
  generationError,
  isProfileComplete,
  plannedCount,
}: {
  evaluationRequired: boolean;
  generationError: string | null;
  isProfileComplete: boolean;
  plannedCount: number;
}) {
  if (evaluationRequired) {
    return "La progression commencera après la validation de l’évaluation.";
  }
  if (!isProfileComplete) {
    return "La progression commencera lorsque ton profil sera complet.";
  }
  if (generationError) return generationError;
  if (!plannedCount) return "Aucune séance planifiée pour le moment.";
  return `${plannedCount} séance${plannedCount > 1 ? "s" : ""} au programme cette semaine.`;
}

function localIsoDate(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}
