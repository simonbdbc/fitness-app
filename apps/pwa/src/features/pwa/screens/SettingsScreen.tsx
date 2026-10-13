import { useRouter } from "expo-router";
import { Text, View } from "react-native";

import {
  useWorkoutAudioCuesPreference,
  type WorkoutAudioMode,
} from "@features/workouts";
import { useThemeTokens } from "@shared/theme";
import {
  ActionButton,
  Badge,
  BodyText,
  Card,
  CardHeader,
  TitleText,
} from "@shared/ui";
import { usePwa } from "../providers/PwaProvider";

export function SettingsScreen() {
  const router = useRouter();
  const tokens = useThemeTokens();
  const { isUpdateAvailable, serviceWorkerStatus } = usePwa();
  const { mode: audioCueMode, setMode: setAudioCueMode } =
    useWorkoutAudioCuesPreference();

  return (
    <View className="w-full max-w-full min-w-0 gap-4">
      <View className="gap-2">
        <TitleText>Parametres</TitleText>
        <BodyText>
          Préférences de l'application et accès aux outils de gestion PWA.
        </BodyText>
      </View>

      <Card variant={isUpdateAvailable ? "info" : "default"}>
        <CardHeader
          title="Gestion PWA"
          description="Installation, mises à jour, stockage, version et diagnostics."
          action={
            <Badge variant={isUpdateAvailable ? "warning" : "info"}>
              {isUpdateAvailable ? "update" : serviceWorkerStatus}
            </Badge>
          }
        />
        <ActionButton onPress={() => router.push("/pwa")} variant="primary">
          Tableau de bord PWA
        </ActionButton>
      </Card>

      <Card>
        <CardHeader
          title="Séance"
          description="Préférences locales appliquées au guide."
          action={
            <Badge variant={audioCueMode === "silent" ? "muted" : "success"}>
              {audioCueModeBadgeLabel(audioCueMode)}
            </Badge>
          }
        />
        <View className="w-full max-w-full min-w-0 gap-3">
          <View className="min-w-0 flex-1 gap-1">
            <Text
              className="max-w-full min-w-0 text-sm font-extrabold"
              style={{ color: tokens.colors.textPrimary }}
            >
              Sons de séance
            </Text>
            <BodyText>Bips, voix ou aucun guidage audio.</BodyText>
          </View>
          <View className="flex-row flex-wrap gap-2">
            {audioCueModeOptions.map((option) => (
              <ActionButton
                className="min-w-[112px] flex-1"
                key={option.mode}
                onPress={() => setAudioCueMode(option.mode)}
                variant={
                  audioCueMode === option.mode ? "primary" : "secondary"
                }
              >
                {option.label}
              </ActionButton>
            ))}
          </View>
        </View>
      </Card>
    </View>
  );
}

const audioCueModeOptions: Array<{
  label: string;
  mode: WorkoutAudioMode;
}> = [
  { label: "Sons", mode: "sound" },
  { label: "Voix", mode: "voice" },
  { label: "Silencieux", mode: "silent" },
];

function audioCueModeBadgeLabel(mode: WorkoutAudioMode) {
  if (mode === "voice") {
    return "voix active";
  }

  if (mode === "silent") {
    return "silencieux";
  }

  return "sons actifs";
}
