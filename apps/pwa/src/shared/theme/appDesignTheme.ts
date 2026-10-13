import { useMemo } from "react";

import { useThemeTokens } from "./theme";

export type AppDesignTheme = {
  colors: {
    border: string;
    borderSoft: string;
    inputBackground: string;
    panelBackground: string;
    panelElevated: string;
    panelMuted: string;
    textMuted: string;
    textPrimary: string;
    textSecondary: string;
  };
  radii: {
    control: number;
    panel: number;
    section: number;
  };
};

export function useAppDesignTheme(): AppDesignTheme {
  const tokens = useThemeTokens();

  return useMemo(
    () => ({
      colors: {
        border: tokens.colors.border,
        borderSoft: tokens.colors.borderSoft,
        inputBackground: tokens.colors.inputBackground,
        panelBackground: tokens.colors.surface,
        panelElevated: tokens.colors.surfaceElevated,
        panelMuted: tokens.colors.surfaceMuted,
        textMuted: tokens.colors.textMuted,
        textPrimary: tokens.colors.textPrimary,
        textSecondary: tokens.colors.textSecondary,
      },
      radii: {
        control: 8,
        panel: 8,
        section: 8,
      },
    }),
    [tokens],
  );
}
