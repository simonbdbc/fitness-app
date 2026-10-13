import type { PropsWithChildren } from "react";
import { Text } from "react-native";
import type { TextProps } from "react-native";

import { useThemeTokens } from "@shared/theme";
import { cx } from "./classNames";

type TypographyProps = PropsWithChildren<
  TextProps & {
    className?: string;
  }
>;

export function TitleText({ children, className, style, ...props }: TypographyProps) {
  const tokens = useThemeTokens();

  return (
    <Text
      {...props}
      className={cx("max-w-full min-w-0 text-2xl font-extrabold", className)}
      style={[{ color: tokens.colors.textPrimary }, style]}
    >
      {children}
    </Text>
  );
}

export function BodyText({ children, className, style, ...props }: TypographyProps) {
  const tokens = useThemeTokens();

  return (
    <Text
      {...props}
      className={cx("max-w-full min-w-0 text-sm leading-5", className)}
      style={[{ color: tokens.colors.textSecondary }, style]}
    >
      {children}
    </Text>
  );
}

export function SubtleText({
  children,
  className,
  style,
  ...props
}: TypographyProps) {
  const tokens = useThemeTokens();

  return (
    <Text
      {...props}
      className={cx("max-w-full min-w-0 text-xs leading-4", className)}
      style={[{ color: tokens.colors.textMuted }, style]}
    >
      {children}
    </Text>
  );
}
