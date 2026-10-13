import { Pressable, Text, View } from "react-native";

import { useAppDesignTheme, useThemeTokens } from "@shared/theme";
import { Badge } from "@shared/ui";
import { usePwa } from "../providers/PwaProvider";
import { shouldShowMenuInstallButton } from "../services/menuInstallPolicy";
import type { PwaMenuTarget } from "../types";

type MenuInstallButtonProps = {
  activeTarget?: PwaMenuTarget;
  onNavigate: (target: PwaMenuTarget) => void;
};

export function MenuInstallButton({
  activeTarget,
  onNavigate,
}: MenuInstallButtonProps) {
  const tokens = useThemeTokens();
  const designTheme = useAppDesignTheme();
  const {
    displayMode,
    installStatus,
    isUpdateAvailable,
    menuInstallLabel,
    menuInstallTarget,
    updateStatus,
  } = usePwa();

  if (!shouldShowMenuInstallButton({ displayMode, installStatus })) {
    return null;
  }

  const isActive = activeTarget === menuInstallTarget;
  const badge = getMenuBadge({
    installStatus,
    isUpdateAvailable,
    updateStatus,
  });

  return (
    <Pressable
      accessibilityLabel={menuInstallLabel}
      accessibilityRole="button"
      className="box-border w-full max-w-full min-w-0 border px-3 py-3"
      onPress={() => onNavigate(menuInstallTarget)}
      style={{
        backgroundColor: isActive
          ? tokens.colors.actionBackground
          : designTheme.colors.panelElevated,
        borderColor: isActive
          ? tokens.colors.actionBackground
          : designTheme.colors.border,
        borderRadius: designTheme.radii.control,
      }}
    >
      <View className="w-full max-w-full min-w-0 flex-row items-center justify-between gap-2">
        <Text
          className="min-w-0 flex-1 break-words text-left text-sm font-bold"
          style={{
            color: isActive
              ? tokens.colors.actionText
              : tokens.colors.textPrimary,
          }}
        >
          {menuInstallLabel}
        </Text>
        <Badge variant={badge.variant}>{badge.label}</Badge>
      </View>
    </Pressable>
  );
}

function getMenuBadge({
  installStatus,
  isUpdateAvailable,
  updateStatus,
}: {
  installStatus: ReturnType<typeof usePwa>["installStatus"];
  isUpdateAvailable: boolean;
  updateStatus: ReturnType<typeof usePwa>["updateStatus"];
}) {
  if (isUpdateAvailable || updateStatus === "available") {
    return { label: "update", variant: "warning" as const };
  }

  switch (installStatus) {
    case "installed":
      return { label: "installée", variant: "success" as const };
    case "available":
      return { label: "pwa", variant: "info" as const };
    case "manual":
      return { label: "manuel", variant: "info" as const };
    case "dismissed":
      return { label: "masquée", variant: "muted" as const };
    case "error":
      return { label: "erreur", variant: "danger" as const };
    default:
      return { label: "info", variant: "muted" as const };
  }
}
