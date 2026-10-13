import { Platform, View } from "react-native";

import {
  ActionButton,
  BodyText,
  Card,
  CardHeader,
  ScreenShell,
  TitleText,
} from "@shared/ui";

export function ApplicationFatalScreen() {
  return (
    <ScreenShell>
      <View className="w-full max-w-[760px] gap-4 self-center py-6">
        <TitleText>ACREA Fitness</TitleText>
        <Card variant="danger">
          <CardHeader
            description="Le diagnostic technique a été conservé dans la console."
            title="L'application n'a pas pu démarrer"
          />
          <BodyText>
            Recharge l'application. Les données locales ne sont pas effacées.
          </BodyText>
          <ActionButton onPress={reloadApplication} variant="secondary">
            Recharger
          </ActionButton>
        </Card>
      </View>
    </ScreenShell>
  );
}

function reloadApplication() {
  if (Platform.OS === "web" && typeof window !== "undefined") {
    window.location.reload();
  }
}
