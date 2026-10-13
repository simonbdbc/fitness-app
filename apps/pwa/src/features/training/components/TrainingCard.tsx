import { Text, View } from "react-native";
import { getCatalogFormatTypeBusinessLabel } from "@features/catalog";
import {
  acreaPillarLabels,
  type ACREATraining,
} from "@features/programming";
import { useThemeTokens } from "@shared/theme";
import {
  ActionButton,
  Badge,
  BodyText,
  Card,
  CardHeader,
} from "@shared/ui";

import {
  formatScheduledDate,
  pillarVariant,
  statusLabel,
  statusVariant,
  type TrainingStatus,
} from "../domain/trainingPresentation";
import type { ResolveTrainingCatalogFormat } from "../hooks/useTrainingCatalogFormats";

export function TrainingCard({
  isGuideDisabled,
  onOpenGuide,
  onStatusChange,
  resolveFormat,
  training,
}: {
  isGuideDisabled: boolean;
  onOpenGuide: () => void;
  resolveFormat: ResolveTrainingCatalogFormat;
  training: ACREATraining;
  onStatusChange: (status: TrainingStatus) => void;
}) {
  const tokens = useThemeTokens();

  return (
    <Card variant={training.status === "terminee" ? "success" : "default"}>
      <CardHeader
        title={`${training.day} ${formatScheduledDate(training.scheduledDate)} - ${training.title}`}
        description={`${training.durationMinutes} min, dominante ${
          acreaPillarLabels[training.dominantPillar]
        }.`}
        action={
          <Badge variant={statusVariant(training.status)}>
            {statusLabel(training.status)}
          </Badge>
        }
      />

      <View className="gap-3">
        {training.seances.map((seance) => {
          const firstSession = seance.sessions[0];
          const format = firstSession
            ? resolveFormat(firstSession)
            : null;
          const formatLabel = format
            ? getCatalogFormatTypeBusinessLabel(format.formatType)
            : "Format";

          return (
            <View
              className="w-full max-w-full min-w-0 gap-2 border-t pt-3"
              key={`${training.code}-${seance.code}`}
              style={{ borderColor: tokens.colors.borderSoft }}
            >
              <View className="w-full max-w-full min-w-0 flex-row flex-wrap items-center gap-2">
                <Badge variant={pillarVariant(seance.pillar ?? seance.phase)}>
                  {seance.pillar
                    ? acreaPillarLabels[seance.pillar]
                    : seance.phase === "warmup"
                      ? "Échauffement"
                      : "Assouplissements"}
                </Badge>
                <Text
                  className="min-w-0 flex-1 text-sm font-extrabold"
                  style={{ color: tokens.colors.textPrimary }}
                >
                  {seance.title}
                </Text>
              </View>
              <BodyText>
                {formatLabel}: {firstSession?.formatLabel ?? "Format à choisir"}
              </BodyText>
              <View className="gap-2">
                {seance.sessions.map((session) => (
                  <View
                    className="gap-1"
                    key={`${seance.code}-${session.code}`}
                  >
                    <BodyText>
                      N{session.level} - {session.exerciseName}
                    </BodyText>
                    <BodyText>
                      Plus facile N{session.easier.level}: {session.easier.name}
                      . {session.easier.note}
                    </BodyText>
                    <BodyText>
                      Plus difficile N{session.harder.level}:{" "}
                      {session.harder.name}. {session.harder.note}
                    </BodyText>
                  </View>
                ))}
              </View>
              <BodyText style={{ color: tokens.colors.warningText }}>
                {firstSession?.safetyRule}
              </BodyText>
            </View>
          );
        })}
      </View>

      <View className="gap-2 pt-1">
        <ActionButton
          className="w-full"
          disabled={isGuideDisabled}
          onPress={onOpenGuide}
          variant="primary"
        >
          Lancer la séance du jour
        </ActionButton>
        <View className="flex-row gap-2">
          <ActionButton
            className="min-w-[132px] flex-1"
            onPress={() => onStatusChange("terminee")}
            variant="secondary"
          >
            Terminée
          </ActionButton>
          <ActionButton
            className="min-w-[132px] flex-1"
            onPress={() => onStatusChange("reportee")}
            variant="secondary"
          >
            Reporter
          </ActionButton>
        </View>
      </View>
    </Card>
  );
}
