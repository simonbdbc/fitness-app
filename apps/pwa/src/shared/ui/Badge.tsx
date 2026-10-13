import type { PropsWithChildren } from "react";
import { Text, View } from "react-native";
import type { TextStyle, ViewStyle } from "react-native";

import { useThemeTokens } from "@shared/theme";
import { cx } from "./classNames";

type BadgeVariant = "muted" | "info" | "success" | "warning" | "danger" | "dark";

type BadgeProps = PropsWithChildren<{
  variant?: BadgeVariant;
  className?: string;
  textClassName?: string;
  style?: ViewStyle;
  textStyle?: TextStyle;
}>;

export function Badge({
  children,
  className,
  style,
  textClassName,
  textStyle,
  variant = "muted",
}: BadgeProps) {
  const tokens = useThemeTokens();
  const palette = badgePalette(variant, tokens);

  return (
    <View
      className={cx("max-w-full min-w-0 self-start border px-2 py-1", className)}
      style={[
        {
          backgroundColor: palette.backgroundColor,
          borderColor: palette.borderColor,
          borderRadius: 999,
        },
        style,
      ]}
    >
      <Text
        className={cx(
          "max-w-full min-w-0 text-xs font-bold uppercase tracking-[0.8px]",
          textClassName,
        )}
        style={[{ color: palette.color }, textStyle]}
      >
        {children}
      </Text>
    </View>
  );
}

function badgePalette(
  variant: BadgeVariant,
  tokens: ReturnType<typeof useThemeTokens>,
) {
  if (variant === "info") {
    return {
      backgroundColor: tokens.colors.infoSurface,
      borderColor: tokens.colors.infoText,
      color: tokens.colors.infoText,
    };
  }

  if (variant === "success") {
    return {
      backgroundColor: tokens.colors.successSurface,
      borderColor: tokens.colors.successText,
      color: tokens.colors.successText,
    };
  }

  if (variant === "warning") {
    return {
      backgroundColor: tokens.colors.warningSurface,
      borderColor: tokens.colors.warningText,
      color: tokens.colors.warningText,
    };
  }

  if (variant === "danger") {
    return {
      backgroundColor: tokens.colors.dangerSurface,
      borderColor: tokens.colors.dangerText,
      color: tokens.colors.dangerText,
    };
  }

  if (variant === "dark") {
    return {
      backgroundColor: tokens.colors.actionBackground,
      borderColor: tokens.colors.actionBackground,
      color: tokens.colors.actionText,
    };
  }

  return {
    backgroundColor: tokens.colors.surfaceMuted,
    borderColor: tokens.colors.border,
    color: tokens.colors.textSecondary,
  };
}
