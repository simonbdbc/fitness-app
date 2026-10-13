import { useRouter } from "expo-router";
import { View } from "react-native";

import {
  ActionButton,
  Badge,
  BodyText,
  Card,
  CardHeader,
  SubtleText,
  TitleText,
} from "@shared/ui";
import { AppVersionInfo } from "../components/AppVersionInfo";
import { InstallAppButton } from "../components/InstallAppButton";
import { PwaDiagnosticsScreen } from "../components/PwaDiagnosticsScreen";
import { usePwa } from "../providers/PwaProvider";

export function InstallAppScreen() {
  const router = useRouter();
  const { displayMode, installStatus, serviceWorkerStatus } = usePwa();

  return (
    <View className="w-full max-w-full min-w-0 gap-4">
      <View className="gap-2">
        <TitleText>Installer l'application</TitleText>
        <BodyText>
          Etat d'installation, instructions par plateforme et controles utiles
          avant ajout a l'ecran d'accueil.
        </BodyText>
      </View>

      <Card variant="info">
        <CardHeader
          title="Etat detecte"
          description="Le navigateur ou l'OS garde le controle final de l'installation."
          action={<Badge variant="info">{installStatusLabel(installStatus)}</Badge>}
        />
        <View className="gap-2">
          <StatusRow label="Mode d'affichage" value={displayMode} />
          <StatusRow label="Service worker" value={serviceWorkerStatus} />
        </View>
        <View className="flex-row flex-wrap gap-2">
          <ActionButton onPress={() => router.push("/pwa")} variant="secondary">
            Tableau de bord PWA
          </ActionButton>
          <ActionButton onPress={() => router.push("/uninstall")} variant="secondary">
            Desinstallation
          </ActionButton>
        </View>
      </Card>

      <InstallAppButton />

      <Card>
        <CardHeader
          title="Prerequis"
          description="A verifier si le bouton d'installation n'apparait pas."
        />
        <InstructionLine text="Application servie en HTTPS, sauf localhost en developpement." />
        <InstructionLine text="Manifest web detecte et icones valides." />
        <InstructionLine text="Service worker actif pour l'offline, les diagnostics et la version." />
        <InstructionLine text="Session et donnees sensibles jamais precachees." />
      </Card>

      <Card>
        <CardHeader
          title="Desktop Chromium"
          description="Chrome, Edge et navigateurs compatibles."
        />
        <InstructionLine text="Utiliser le bouton Installer lorsqu'il est disponible." />
        <InstructionLine text="Sinon ouvrir le menu du navigateur puis Installer ACREA Fitness." />
        <InstructionLine text="Apres installation, l'application s'ouvre en mode standalone." />
      </Card>

      <Card>
        <CardHeader title="Android Chromium" description="Chrome Android." />
        <InstructionLine text="Utiliser le prompt natif ou le menu Ajouter a l'ecran d'accueil." />
        <InstructionLine text="Si le prompt est masque, attendre l'expiration du rejet ou reafficher depuis cette page." />
      </Card>

      <Card>
        <CardHeader title="iOS et iPadOS Safari" description="Installation manuelle." />
        <InstructionLine text="Ouvrir le menu Partager de Safari." />
        <InstructionLine text="Choisir Ajouter a l'ecran d'accueil." />
        <InstructionLine text="Valider le nom et ouvrir depuis l'icone creee." />
      </Card>

      <Card variant="muted">
        <CardHeader
          title="Navigateurs non compatibles"
          description="L'application reste utilisable comme site web."
        />
        <BodyText>
          Si l'installation n'est pas supportee, utiliser l'application dans le
          navigateur et conserver cette page pour les diagnostics support.
        </BodyText>
      </Card>

      <AppVersionInfo />
      <PwaDiagnosticsScreen />
    </View>
  );
}

function StatusRow({ label, value }: { label: string; value: string }) {
  return (
    <View className="flex-row flex-wrap items-start justify-between gap-2">
      <SubtleText>{label}</SubtleText>
      <BodyText className="min-w-0 flex-1 text-right" selectable>
        {value}
      </BodyText>
    </View>
  );
}

function InstructionLine({ text }: { text: string }) {
  return (
    <View className="flex-row items-start gap-2">
      <Badge variant="muted">ok</Badge>
      <BodyText className="min-w-0 flex-1">{text}</BodyText>
    </View>
  );
}

function installStatusLabel(status: ReturnType<typeof usePwa>["installStatus"]) {
  switch (status) {
    case "available":
      return "disponible";
    case "installed":
      return "installee";
    case "manual":
      return "manuel";
    case "dismissed":
      return "masquee";
    case "error":
      return "erreur";
    case "checking":
      return "detection";
    default:
      return "indisponible";
  }
}
