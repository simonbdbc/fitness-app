import { useRouter } from "expo-router";
import { View } from "react-native";

import {
  ActionButton,
  BodyText,
  Card,
  CardHeader,
  ScreenShell,
  TitleText,
} from "@shared/ui";
import { usePwa } from "../providers/PwaProvider";

export function OfflineScreen() {
  const router = useRouter();
  const { apiStatus, networkStatus } = usePwa();
  const networkStatusLabel =
    networkStatus === "connected" ? "connecte" : "hors ligne";
  const apiStatusLabel =
    apiStatus === "available"
      ? "disponible"
      : apiStatus === "checking"
        ? "en vérification"
        : apiStatus === "not-configured"
          ? "non configurée"
          : "indisponible";

  return (
    <ScreenShell>
      <View className="w-full max-w-full min-w-0 gap-4">
        <View className="gap-2">
          <TitleText>Connexion indisponible</TitleText>
          <BodyText>
            Certaines zones ne peuvent pas etre chargees pour le moment.
          </BodyText>
        </View>
        <Card>
          <CardHeader
            title="Etat reseau"
            description={`Supabase : ${networkStatusLabel}. API : ${apiStatusLabel}.`}
          />
          <BodyText>
            Les donnees locales deja disponibles restent accessibles depuis
            l'application.
          </BodyText>
          <View className="flex-row flex-wrap gap-2">
            <ActionButton
              onPress={() => router.replace("/home")}
              variant="primary"
            >
              Accueil
            </ActionButton>
            <ActionButton
              onPress={() => {
                if (typeof window !== "undefined") {
                  window.location.reload();
                }
              }}
              variant="secondary"
            >
              Reessayer
            </ActionButton>
          </View>
        </Card>
      </View>
    </ScreenShell>
  );
}
