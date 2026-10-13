import { View } from "react-native";

import { Badge } from "@shared/ui";
import { usePwa } from "../providers/PwaProvider";
import type { PwaApiStatus, PwaNetworkStatus } from "../types";

const networkStatusLabel: Record<PwaNetworkStatus, string> = {
  connected: "Connecté",
  offline: "Hors ligne",
};

const apiStatusDescription: Record<PwaApiStatus, string> = {
  checking: "API en cours de vérification",
  "not-configured": "API non configurée",
  available: "API disponible",
  unavailable: "API indisponible",
};

const apiStatusVariant: Record<PwaApiStatus, "muted" | "success" | "danger"> = {
  checking: "muted",
  "not-configured": "muted",
  available: "success",
  unavailable: "danger",
};

export function ConnectionStatus() {
  const { apiStatus, networkStatus } = usePwa();
  const apiDescription = apiStatusDescription[apiStatus];

  return (
    <View className="flex-row flex-wrap items-center gap-2">
      <Badge variant={networkStatus === "connected" ? "success" : "danger"}>
        {networkStatusLabel[networkStatus]}
      </Badge>
      <View
        accessible
        accessibilityLabel={apiDescription}
        accessibilityRole="text"
        {...({ title: apiDescription } as { title: string })}
      >
        <Badge variant={apiStatusVariant[apiStatus]}>API</Badge>
      </View>
    </View>
  );
}
