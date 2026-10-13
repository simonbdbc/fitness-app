import { useRouter } from "expo-router";
import { View } from "react-native";

import {
  ActionButton,
  Badge,
  BodyText,
  Card,
  CardHeader,
  TitleText,
} from "@shared/ui";
import { AppVersionInfo } from "../components/AppVersionInfo";
import { InstallAppButton } from "../components/InstallAppButton";
import { PwaDiagnosticsScreen } from "../components/PwaDiagnosticsScreen";
import { StorageUsagePanel } from "../components/StorageUsagePanel";
import { usePwa } from "../providers/PwaProvider";

export function PwaDashboardScreen() {
  const router = useRouter();
  const {
    buildInfo,
    displayMode,
    installStatus,
    isUpdateAvailable,
    remoteBuildInfo,
    serviceWorkerStatus,
  } = usePwa();
  const info = buildInfo ?? remoteBuildInfo;
  const isInstalled =
    installStatus === "installed" || displayMode !== "browser";

  return (
    <View className="w-full max-w-full min-w-0 gap-4">
      <View className="gap-2">
        <TitleText>Tableau de bord PWA</TitleText>
        <BodyText>
          Installation, mises à jour, stockage local, version et diagnostics de
          l'application.
        </BodyText>
      </View>

      <Card variant={isUpdateAvailable ? "info" : "default"}>
        <CardHeader
          title="Gestion PWA"
          description="État courant et accès aux procédures par plateforme."
          action={
            <Badge
              variant={
                isUpdateAvailable ? "warning" : isInstalled ? "success" : "info"
              }
            >
              {isUpdateAvailable
                ? "mise à jour"
                : isInstalled
                  ? "installée"
                  : installStatus}
            </Badge>
          }
        />
        <BodyText>
          Mode {displayMode}. Service worker {serviceWorkerStatus}.
        </BodyText>
        <View className="flex-row flex-wrap gap-2">
          <ActionButton
            onPress={() => router.push("/install")}
            variant="secondary"
          >
            Installation manuelle
          </ActionButton>
          <ActionButton
            onPress={() => router.push("/uninstall")}
            variant="secondary"
          >
            Désinstallation
          </ActionButton>
        </View>
        <BodyText selectable>
          Support : {info?.supportContact ?? "support@acrea-fitness.fr"}
        </BodyText>
      </Card>

      <InstallAppButton />
      <AppVersionInfo />
      <StorageUsagePanel />
      <PwaDiagnosticsScreen />
    </View>
  );
}
