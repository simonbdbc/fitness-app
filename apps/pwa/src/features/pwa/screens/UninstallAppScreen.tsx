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
import { StorageUsagePanel } from "../components/StorageUsagePanel";
import { usePwa } from "../providers/PwaProvider";

export function UninstallAppScreen() {
  const router = useRouter();
  const { buildInfo, displayMode, installStatus, remoteBuildInfo } = usePwa();
  const info = buildInfo ?? remoteBuildInfo;

  return (
    <View className="w-full max-w-full min-w-0 gap-4">
      <View className="gap-2">
        <TitleText>Desinstaller l'application</TitleText>
        <BodyText>
          La suppression de l'icone installee depend du navigateur ou du
          systeme. Cette page aide aussi a nettoyer les caches PWA et a
          reinstaller proprement.
        </BodyText>
      </View>

      <Card variant={installStatus === "installed" ? "success" : "muted"}>
        <CardHeader
          title="Etat local"
          description="ACREA Fitness ne peut pas supprimer lui-meme une installation OS."
          action={<Badge variant="info">{displayMode}</Badge>}
        />
        <View className="gap-2">
          <StatusRow label="Installation" value={installStatus} />
          <StatusRow
            label="Support"
            value={info?.supportContact ?? "Démonstration locale"}
          />
        </View>
        <View className="flex-row flex-wrap gap-2">
          <ActionButton onPress={() => router.push("/install")} variant="secondary">
            Installer
          </ActionButton>
          <ActionButton onPress={() => router.push("/pwa")} variant="secondary">
            Tableau de bord PWA
          </ActionButton>
        </View>
      </Card>

      <Card>
        <CardHeader
          title="Desktop Chromium"
          description="Chrome, Edge et navigateurs compatibles."
        />
        <InstructionLine text="Ouvrir l'application installee." />
        <InstructionLine text="Utiliser le menu de la fenetre ou la page d'informations de l'application." />
        <InstructionLine text="Choisir Desinstaller ou Supprimer ACREA Fitness." />
      </Card>

      <Card>
        <CardHeader title="Android" description="Chrome ou launcher Android." />
        <InstructionLine text="Appui long sur l'icone ACREA Fitness." />
        <InstructionLine text="Choisir Supprimer ou Desinstaller selon le launcher." />
        <InstructionLine text="Les donnees du navigateur peuvent rester tant qu'elles ne sont pas effacees." />
      </Card>

      <Card>
        <CardHeader title="iOS et iPadOS" description="Ecran d'accueil." />
        <InstructionLine text="Appui long sur l'icone ACREA Fitness." />
        <InstructionLine text="Choisir Supprimer le signet ou Retirer de l'ecran d'accueil." />
        <InstructionLine text="Effacer les donnees Safari se fait depuis les reglages du systeme si necessaire." />
      </Card>

      <StorageUsagePanel />

      <Card variant="info">
        <CardHeader
          title="Reinstallation propre"
          description="Sequence conseillee en cas de version bloquee."
        />
        <InstructionLine text="Supprimer l'icone installee depuis le navigateur ou l'OS." />
        <InstructionLine text="Vider les caches PWA depuis le panneau stockage." />
        <InstructionLine text="Recharger l'application dans le navigateur." />
        <InstructionLine text="Relancer l'installation depuis la page Installer." />
      </Card>

      <AppVersionInfo />
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
      <Badge variant="muted">info</Badge>
      <BodyText className="min-w-0 flex-1">{text}</BodyText>
    </View>
  );
}
