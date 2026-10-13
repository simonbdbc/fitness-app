import type { PropsWithChildren, ReactNode } from "react";
import { Pressable, Text } from "react-native";
import type { TextStyle, ViewStyle } from "react-native";

import { useAppDesignTheme, useThemeTokens } from "@shared/theme";
import { cx } from "./classNames";

type ActionButtonVariant = "primary" | "secondary" | "danger";

type ActionButtonProps = PropsWithChildren<{
  variant?: ActionButtonVariant;
  disabled?: boolean;
  className?: string;
  prefix?: ReactNode;
  suffix?: ReactNode;
  textClassName?: string;
  onPress: () => void;
}>;

export function ActionButton({
  children,
  className,
  disabled,
  onPress,
  prefix,
  suffix,
  textClassName,
  variant = "secondary",
}: ActionButtonProps) {
  const tokens = useThemeTokens();
  const designTheme = useAppDesignTheme();
  const buttonStyle: ViewStyle =
    variant === "primary"
      ? {
          backgroundColor: tokens.colors.actionBackground,
          borderColor: tokens.colors.actionBackground,
          borderRadius: designTheme.radii.control,
        }
      : variant === "danger"
        ? {
            backgroundColor: tokens.colors.dangerSurface,
            borderColor: tokens.colors.dangerText,
            borderRadius: designTheme.radii.control,
          }
      : {
            backgroundColor: designTheme.colors.panelElevated,
            borderColor: designTheme.colors.border,
            borderRadius: designTheme.radii.control,
          };
  const textStyle: TextStyle = {
    color:
      variant === "primary"
        ? tokens.colors.actionText
        : variant === "danger"
          ? tokens.colors.dangerText
        : tokens.colors.textPrimary,
  };

  return (
    <Pressable
      accessibilityRole="button"
      className={cx(
        "max-w-full min-w-0 items-center border px-3.5 py-2.5",
        (Boolean(prefix) || Boolean(suffix)) && "flex-row justify-center gap-2",
        disabled && "opacity-50",
        className,
      )}
      disabled={disabled}
      onPress={onPress}
      style={buttonStyle}
    >
      {prefix}
      <Text
        className={cx(
          "max-w-full min-w-0 break-words text-center text-sm font-bold",
          textClassName,
        )}
        style={textStyle}
      >
        {children}
      </Text>
      {suffix}
    </Pressable>
  );
}
