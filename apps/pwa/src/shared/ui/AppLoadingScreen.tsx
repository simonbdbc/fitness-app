import { ActivityIndicator, Image, View } from "react-native";
import type { ImageStyle } from "react-native";

import appIcon from "../../../assets/app-icon.png";
import { useThemeTokens } from "@shared/theme";
import { ScreenShell } from "./ScreenShell";

type AppLoadingScreenProps = {
  accessibilityLabel: string;
};

const appIconStyle: ImageStyle = {
  borderRadius: 28,
  height: 112,
  width: 112,
};

export function AppLoadingScreen({
  accessibilityLabel,
}: AppLoadingScreenProps) {
  const tokens = useThemeTokens();

  return (
    <ScreenShell>
      <View className="flex-1 items-center justify-center gap-6 py-10">
        <Image
          accessibilityElementsHidden
          accessibilityIgnoresInvertColors
          accessible={false}
          aria-hidden
          resizeMode="contain"
          source={appIcon}
          style={appIconStyle}
          testID="app-loading-icon"
        />
        <ActivityIndicator
          accessibilityLabel={accessibilityLabel}
          color={tokens.colors.accent}
          size="large"
        />
      </View>
    </ScreenShell>
  );
}
