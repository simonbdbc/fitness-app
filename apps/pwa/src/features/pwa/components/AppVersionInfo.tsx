import { View } from "react-native";

import { Badge, BodyText, Card, CardHeader, SubtleText } from "@shared/ui";
import { usePwa } from "../providers/PwaProvider";

export function AppVersionInfo() {
  const {
    buildInfo,
    displayMode,
    remoteBuildInfo,
    serviceWorkerStatus,
  } = usePwa();
  const info = buildInfo ?? remoteBuildInfo;

  return (
    <Card>
      <CardHeader
        title="Version"
        description="Informations utiles au support et a la QA."
        action={<Badge variant="dark">{info?.appVersion ?? "n/a"}</Badge>}
      />
      <View className="gap-2">
        <InfoRow label="Application" value={info?.appName ?? "ACREA Fitness"} />
        <InfoRow label="Version" value={info?.appVersion ?? "inconnue"} />
        <InfoRow label="Build" value={info?.buildId ?? "inconnu"} />
        <InfoRow label="Commit" value={info?.commitSha ?? "inconnu"} />
        <InfoRow label="Canal" value={info?.releaseChannel ?? "inconnu"} />
        <InfoRow label="Date" value={info?.buildDate ?? "inconnue"} />
        <InfoRow label="Origine" value={info?.origin ?? "inconnue"} />
        <InfoRow label="Mode" value={displayMode} />
        <InfoRow label="Service worker" value={serviceWorkerStatus} />
        <InfoRow label="Support" value={info?.supportContact ?? "non configure"} />
      </View>
    </Card>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <View className="flex-row flex-wrap items-start justify-between gap-2">
      <SubtleText>{label}</SubtleText>
      <BodyText className="min-w-0 flex-1 text-right" selectable>
        {value}
      </BodyText>
    </View>
  );
}
