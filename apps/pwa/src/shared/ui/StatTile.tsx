import { View } from "react-native";

import { useThemeTokens } from "@shared/theme";
import { BodyText, TitleText } from "./Typography";

type StatTileProps = {
  label: string;
  value: string;
  tone?: "default" | "success" | "info" | "warning";
};

export function StatTile({ label, tone = "default", value }: StatTileProps) {
  const tokens = useThemeTokens();
  const toneColor =
    tone === "success"
      ? tokens.colors.successText
      : tone === "info"
        ? tokens.colors.infoText
        : tone === "warning"
          ? tokens.colors.warningText
          : tokens.colors.textPrimary;

  return (
    <View className="min-w-[128px] flex-1 gap-1">
      <TitleText className="text-xl leading-6" style={{ color: toneColor }}>
        {value}
      </TitleText>
      <BodyText className="text-xs uppercase tracking-[0.8px]">{label}</BodyText>
    </View>
  );
}
