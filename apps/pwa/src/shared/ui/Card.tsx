import type { PropsWithChildren, ReactNode } from "react";
import { View } from "react-native";
import type { ViewStyle } from "react-native";

import { useAppDesignTheme, useThemeTokens } from "@shared/theme";
import { cx } from "./classNames";
import { BodyText, TitleText } from "./Typography";

type CardVariant = "default" | "muted" | "danger" | "success" | "info";

type CardProps = PropsWithChildren<{
  className?: string;
  style?: ViewStyle;
  variant?: CardVariant;
}>;

export function Card({
  children,
  className,
  style,
  variant = "default",
}: CardProps) {
  const tokens = useThemeTokens();
  const designTheme = useAppDesignTheme();
  const palette = cardPalette(variant, tokens);

  return (
    <View
      className={cx("box-border w-full max-w-full min-w-0 gap-3 border p-4", className)}
      style={[
        {
          backgroundColor: palette.backgroundColor,
          borderColor: palette.borderColor,
          borderRadius: designTheme.radii.panel,
        },
        style,
      ]}
    >
      {children}
    </View>
  );
}

type CardHeaderProps = {
  title: string;
  description?: string;
  action?: ReactNode;
};

export function CardHeader({ action, description, title }: CardHeaderProps) {
  return (
    <View className="w-full max-w-full min-w-0 flex-row items-start justify-between gap-3">
      <View className="min-w-0 flex-1 gap-1">
        <TitleText className="text-lg leading-6">{title}</TitleText>
        {description ? <BodyText>{description}</BodyText> : null}
      </View>
      {action}
    </View>
  );
}

function cardPalette(
  variant: CardVariant,
  tokens: ReturnType<typeof useThemeTokens>,
) {
  if (variant === "danger") {
    return {
      backgroundColor: tokens.colors.dangerSurface,
      borderColor: tokens.colors.dangerText,
    };
  }

  if (variant === "success") {
    return {
      backgroundColor: tokens.colors.successSurface,
      borderColor: tokens.colors.successText,
    };
  }

  if (variant === "info") {
    return {
      backgroundColor: tokens.colors.infoSurface,
      borderColor: tokens.colors.infoText,
    };
  }

  if (variant === "muted") {
    return {
      backgroundColor: tokens.colors.surfaceMuted,
      borderColor: tokens.colors.border,
    };
  }

  return {
    backgroundColor: tokens.colors.surface,
    borderColor: tokens.colors.border,
  };
}
