import { View } from "react-native";

import { ActionButton, Badge, BodyText, Card, CardHeader } from "@shared/ui";
import { usePwa } from "../providers/PwaProvider";
import { BrowserInstallElement } from "./BrowserInstallElement";

export function InstallAppButton() {
  const {
    installError,
    installStatus,
    isInstallPromptAvailable,
    promptInstall,
    resetInstallDismissal,
  } = usePwa();
  const isManual = installStatus === "manual";
  const isInstalled = installStatus === "installed";
  const isInstallable = isInstallPromptAvailable && !isInstalled;
  const statusLabel = isInstallPromptAvailable
    ? "Disponible"
    : installStatusLabel(installStatus);

  return (
    <Card>
      <CardHeader
        title="Installation"
        description={
          isManual
            ? "Installation disponible depuis le menu du navigateur sur cette plateforme."
            : "Etat d'installation detecte par le navigateur."
        }
        action={<Badge variant={isInstalled ? "success" : "info"}>{statusLabel}</Badge>}
      />
      {installError ? <BodyText selectable>{installError}</BodyText> : null}
      {isManual ? (
        <BodyText>
          Sur iOS/iPadOS Safari, ouvre Partager puis Ajouter a l'ecran
          d'accueil.
        </BodyText>
      ) : null}
      <View className="flex-row flex-wrap gap-2">
        <BrowserInstallElement enabled={!isInstalled}>
          <ActionButton
            disabled={!isInstallable}
            onPress={() => void promptInstall()}
            variant="primary"
          >
            {isInstalled ? "Deja installee" : "Installer"}
          </ActionButton>
        </BrowserInstallElement>
        {installStatus === "dismissed" ? (
          <ActionButton onPress={resetInstallDismissal} variant="secondary">
            Reafficher
          </ActionButton>
        ) : null}
      </View>
    </Card>
  );
}

function installStatusLabel(status: ReturnType<typeof usePwa>["installStatus"]) {
  switch (status) {
    case "available":
      return "Disponible";
    case "installed":
      return "Installee";
    case "manual":
      return "Menu";
    case "dismissed":
      return "Masquee";
    case "error":
      return "Erreur";
    case "checking":
      return "Detection";
    default:
      return "Indisponible";
  }
}
