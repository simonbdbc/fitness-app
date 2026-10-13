import { ActivityIndicator, View } from "react-native";

import { useThemeTokens } from "@shared/theme";
import { ActionButton, BodyText, Card, CardHeader } from "@shared/ui";
import { usePwa } from "../providers/PwaProvider";

export function UpdateAvailablePrompt() {
  const {
    applyUpdate,
    dismissUpdate,
    isUpdateAvailable,
    lastUpdateError,
    updateStatus,
  } = usePwa();
  const tokens = useThemeTokens();

  if (!isUpdateAvailable && updateStatus !== "error") {
    return null;
  }

  const isUpdating =
    updateStatus === "updating" ||
    updateStatus === "reloadRequired" ||
    updateStatus === "applied";
  const isForced = updateStatus === "forced";

  return (
    <Card variant={updateStatus === "error" ? "danger" : "success"}>
      <CardHeader
        title="Mise a jour disponible"
        description="Une nouvelle version de ACREA Fitness peut etre appliquee."
      />
      {lastUpdateError ? <BodyText selectable>{lastUpdateError}</BodyText> : null}
      <View className="flex-row flex-wrap gap-2">
        <ActionButton
          disabled={isUpdating}
          onPress={() => void applyUpdate()}
          prefix={
            isUpdating ? (
              <ActivityIndicator color={tokens.colors.actionText} size="small" />
            ) : undefined
          }
          variant="primary"
        >
          {isUpdating ? "Mise a jour..." : "Mettre a jour"}
        </ActionButton>
        {!isForced ? (
          <ActionButton disabled={isUpdating} onPress={dismissUpdate} variant="secondary">
            Plus tard
          </ActionButton>
        ) : null}
      </View>
    </Card>
  );
}
