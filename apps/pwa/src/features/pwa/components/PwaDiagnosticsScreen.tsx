import { useEffect } from "react";
import { View } from "react-native";

import {
  ActionButton,
  Badge,
  BodyText,
  Card,
  CardHeader,
  SubtleText,
} from "@shared/ui";
import { usePwa } from "../providers/PwaProvider";
import type { PwaApiStatus } from "../types";

export function PwaDiagnosticsScreen() {
  const { diagnostics, refreshDiagnostics } = usePwa();

  useEffect(() => {
    void refreshDiagnostics();
  }, [refreshDiagnostics]);

  return (
    <Card>
      <CardHeader
        title="Diagnostics PWA"
        description="Etat local lisible par le support."
        action={
          <Badge
            variant={diagnostics?.serviceWorkerActive ? "success" : "warning"}
          >
            {diagnostics?.serviceWorkerStatus ?? "inconnu"}
          </Badge>
        }
      />
      <View className="gap-2">
        <DiagnosticRow
          label="Manifest"
          value={diagnostics?.manifestDetected ? "detecte" : "absent"}
        />
        <DiagnosticRow
          label="Mode"
          value={diagnostics?.displayMode ?? "inconnu"}
        />
        <DiagnosticRow
          label="Service worker supporte"
          value={diagnostics?.serviceWorkerSupported ? "oui" : "non"}
        />
        <DiagnosticRow
          label="Service worker actif"
          value={diagnostics?.serviceWorkerActive ? "oui" : "non"}
        />
        <DiagnosticRow
          label="Caches connus"
          value={`${diagnostics?.caches.length ?? 0}`}
        />
        <DiagnosticRow
          label="Version courante"
          value={diagnostics?.currentBuildInfo?.buildId ?? "inconnue"}
        />
        <DiagnosticRow
          label="Version distante"
          value={diagnostics?.remoteBuildInfo?.buildId ?? "inconnue"}
        />
        <DiagnosticRow
          label="Navigateur"
          value={
            diagnostics
              ? diagnostics.online
                ? "online"
                : "offline"
              : "inconnu"
          }
        />
        <DiagnosticRow
          label="Base de données"
          value={
            diagnostics
              ? diagnostics.networkStatus === "connected"
                ? "connecte"
                : "hors ligne"
              : "inconnu"
          }
        />
        <DiagnosticRow
          label="API backend"
          value={
            diagnostics ? apiStatusLabel(diagnostics.apiStatus) : "inconnu"
          }
        />
      </View>
      {diagnostics?.lastUpdateError ? (
        <BodyText selectable>{diagnostics.lastUpdateError}</BodyText>
      ) : null}
      <ActionButton
        onPress={() => void refreshDiagnostics()}
        variant="secondary"
      >
        Actualiser
      </ActionButton>
    </Card>
  );
}

function apiStatusLabel(status: PwaApiStatus) {
  if (status === "available") return "disponible";
  if (status === "checking") return "vérification";
  if (status === "not-configured") return "non configurée";
  return "indisponible";
}

function DiagnosticRow({ label, value }: { label: string; value: string }) {
  return (
    <View className="flex-row flex-wrap items-start justify-between gap-2">
      <SubtleText>{label}</SubtleText>
      <BodyText className="min-w-0 flex-1 text-right" selectable>
        {value}
      </BodyText>
    </View>
  );
}
