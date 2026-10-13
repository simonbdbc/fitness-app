import { Pressable, Text, View } from "react-native";

import { MenuInstallButton } from "@features/pwa";
import type { PwaMenuTarget } from "@features/pwa";
import { useAppDesignTheme, useThemeTokens } from "@shared/theme";
import { Badge } from "@shared/ui";
import { type AppView, appViewDisplayNameByView } from "../navigation/routes";

type NavigationItem = {
    view: AppView;
    badge?: string;
};

type AppNavigationProps = {
    activeView: AppView;
    sessionLabel: string;
    onViewChange: (view: AppView) => void;
};

const navigationItems: NavigationItem[] = [
    { view: "home" },
    { view: "levelTest" },
    { view: "training" },
    { view: "timer" },
    { view: "bibliotheque" },
    { view: "profile" },
    { view: "settings" },
];

const pwaMenuTargetByView: Partial<Record<AppView, PwaMenuTarget>> = {
    install: "install",
    settings: "settings",
    uninstall: "uninstall",
};

export function AppNavigation({
    activeView,
    onViewChange,
    sessionLabel,
}: AppNavigationProps) {
    const tokens = useThemeTokens();

    return (
        <View className="box-border w-full max-w-full min-w-0 gap-4">
            <View className="w-full max-w-full min-w-0 flex-row flex-wrap items-center justify-between gap-2">
                <Text
                    className="max-w-full min-w-0 text-xs font-bold uppercase tracking-[1px]"
                    style={{ color: tokens.colors.accent }}
                >
                    Menu
                </Text>
                <Badge variant="dark">{sessionLabel}</Badge>
            </View>

            <View className="w-full max-w-full min-w-0 gap-2">
                {navigationItems.map((item) => (
                    <NavigationButton
                        activeView={activeView}
                        item={item}
                        key={item.view}
                        onViewChange={onViewChange}
                    />
                ))}
                <MenuInstallButton
                    activeTarget={pwaMenuTargetByView[activeView]}
                    onNavigate={onViewChange}
                />

            </View>
        </View>
    );
}

function NavigationButton({
    activeView,
    item,
    onViewChange,
}: {
    activeView: AppView;
    item: NavigationItem;
    onViewChange: (view: AppView) => void;
}) {
    const tokens = useThemeTokens();
    const designTheme = useAppDesignTheme();
    const isActive = activeView === item.view;

    return (
        <Pressable
            accessibilityRole="button"
            className="box-border w-full max-w-full min-w-0 border px-3 py-3"
            onPress={() => onViewChange(item.view)}
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
                    {appViewDisplayNameByView[item.view]}
                </Text>
            </View>
        </Pressable>
    );
}
