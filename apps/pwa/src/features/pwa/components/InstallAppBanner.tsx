import { View } from "react-native";

import { ActionButton, BodyText, Card, CardHeader } from "@shared/ui";
import { usePwa } from "../providers/PwaProvider";

export function InstallAppBanner() {
  const {
    dismissInstall,
    installError,
    installStatus,
    promptInstall,
  } = usePwa();

  if (!["available", "manual", "error"].includes(installStatus)) {
    return null;
  }

  const isManual = installStatus === "manual";

  return (
    <Card variant={installStatus === "error" ? "danger" : "info"}>
      <CardHeader
        title={isManual ? "Installation via le navigateur" : "Installer ACREA Fitness"}
        description={
          isManual
            ? "Sur iPhone ou iPad, utilise le menu de partage puis Ajouter a l'ecran d'accueil."
            : "Ajoute l'application a l'ecran d'accueil pour l'ouvrir en mode autonome."
        }
      />
      {installError ? <BodyText selectable>{installError}</BodyText> : null}
      <View className="flex-row flex-wrap gap-2">
        {!isManual ? (
          <ActionButton onPress={() => void promptInstall()} variant="primary">
            Installer
          </ActionButton>
        ) : null}
        <ActionButton onPress={dismissInstall} variant="secondary">
          Masquer
        </ActionButton>
      </View>
    </Card>
  );
}
