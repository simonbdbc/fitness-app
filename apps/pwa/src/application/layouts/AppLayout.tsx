import type { PropsWithChildren, SetStateAction } from "react";
import {
    Platform,
    Pressable,
    Switch,
    Text,
    View,
    useWindowDimensions,
} from "react-native";
import type { TextStyle, ViewStyle } from "react-native";

import { useAuth } from "@features/auth";
import {
    ConnectionStatus,
    InstallAppBanner,
    UpdateAvailablePrompt,
} from "@features/pwa";
import { useAppDesignTheme, useTheme, useThemeTokens } from "@shared/theme";
import {
    displaySessionStorageKey,
    getDisplaySessionRuntimeId,
    usePersistentScreenState,
} from "@shared/persistence";
import { ActionButton, Badge, Icon, ScreenShell } from "@shared/ui";
import { AppNavigation } from "../components/AppNavigation";
import type { AppView } from "../navigation/routes";
import { ScrollView } from "react-native-gesture-handler";

type AppLayoutProps = PropsWithChildren<{
    activeView: AppView;
    onViewChange: (view: AppView) => void;
}>;

const webBackdropStyle = {
    bottom: 0,
    left: 0,
    position: "fixed",
    right: 0,
    top: 0,
    zIndex: 40,
} as unknown as ViewStyle;

const webSidebarStyle = {
    bottom: 0,
    left: 0,
    maxHeight: "100vh",
    maxWidth: "86vw",
    overflow: "hidden",
    overflowX: "hidden",
    position: "fixed",
    top: 0,
    width: 292,
    zIndex: 50,
} as unknown as ViewStyle;

const webDesktopContentStyle = {
    boxSizing: "border-box",
    maxWidth: "100%",
    overflowX: "hidden",
    paddingLeft: 292,
    width: "100%",
} as unknown as ViewStyle;

const nativeBackdropStyle: ViewStyle = {
    bottom: 0,
    left: 0,
    position: "absolute",
    right: 0,
    top: 0,
    zIndex: 40,
};

const nativeSidebarStyle: ViewStyle = {
    bottom: 0,
    left: 0,
    maxWidth: "86%",
    overflow: "hidden",
    position: "absolute",
    top: 0,
    width: 292,
    zIndex: 50,
};

const desktopSidebarBreakpoint = 1024;
const compactHeaderBreakpoint = 700;
const narrowHeaderBreakpoint = 430;
const sidebarNavigationContentStyle = {
    paddingBottom: 8,
};

const appTitle = "ACREA Fitness";
const subAppTitle = "Programme hebdomadaire poids du corps";

export function AppLayout({
    activeView,
    children,
    onViewChange,
}: AppLayoutProps) {
    const { authorizationError, signOut, session, user } = useAuth();
    const { setThemeFamily, setThemeMode, themeFamily, themeMode, tokens } =
        useTheme();
    const designTheme = useAppDesignTheme();
    const { width: viewportWidth } = useWindowDimensions();
    const layoutStorageKey = user?.id
        ? displaySessionStorageKey(user.id, "layout")
        : null;
    const { setValue: setLayoutState, value: layoutState } =
        usePersistentScreenState({
            initialValue: { isSidebarVisible: false },
            parse: parseLayoutState,
            storageKey: layoutStorageKey,
        });
    const isSidebarVisible = layoutState.isSidebarVisible;
    const setIsSidebarVisible = (next: SetStateAction<boolean>) => {
        setLayoutState((current) => ({
            ...current,
            isSidebarVisible:
                typeof next === "function"
                    ? next(current.isSidebarVisible)
                    : next,
        }));
    };
    const isPersistentSidebar =
        Platform.OS === "web" && viewportWidth >= desktopSidebarBreakpoint;
    const isCompactHeader =
        !isPersistentSidebar && viewportWidth < compactHeaderBreakpoint;
    const isNarrowHeader =
        !isPersistentSidebar && viewportWidth < narrowHeaderBreakpoint;
    const isLightTheme = themeMode === "light";
    const isNeonTheme = themeFamily === "neon";
    const backdropStyle =
        Platform.OS === "web"
            ? [webBackdropStyle, { backgroundColor: tokens.colors.overlay }]
            : [nativeBackdropStyle, { backgroundColor: tokens.colors.overlay }];
    const sidebarStyle =
        Platform.OS === "web"
            ? [
                  webSidebarStyle,
                  {
                      backgroundColor: designTheme.colors.panelBackground,
                      borderColor: designTheme.colors.border,
                      boxShadow: `18px 0 36px ${tokens.colors.shadow}`,
                  } as unknown as ViewStyle,
              ]
            : [
                  nativeSidebarStyle,
                  {
                      backgroundColor: designTheme.colors.panelBackground,
                      borderColor: designTheme.colors.border,
                  },
              ];
    const menuButtonStyle: ViewStyle = {
        backgroundColor: designTheme.colors.panelElevated,
        borderColor: designTheme.colors.border,
        borderRadius: designTheme.radii.control,
    };
    const handleViewChange = (view: AppView) => {
        onViewChange(view);
        if (!isPersistentSidebar) {
            setIsSidebarVisible(false);
        }
    };
    const sessionLabel =
        session?.provider === "supabase"
            ? accountTypeLabel(user?.accountType)
            : "invité";
    const sidebarLayer =
        isSidebarVisible || isPersistentSidebar ? (
            <>
                {!isPersistentSidebar ? (
                    <Pressable
                        accessibilityRole="button"
                        className="absolute inset-0"
                        onPress={() => setIsSidebarVisible(false)}
                        style={backdropStyle}
                    />
                ) : null}
                <View
                    className="box-border h-full max-w-full min-w-0 gap-5 border-r px-4 pb-5 pt-6"
                    style={sidebarStyle}
                >
                    <View
                        className="w-full max-w-full min-w-0 shrink-0 gap-4 border-b pb-5"
                        style={{ borderColor: designTheme.colors.borderSoft }}
                    >
                        <View className="w-full max-w-full min-w-0 flex-row items-start justify-between gap-3">
                            <View className="max-w-full min-w-0 flex-1 gap-1">
                                <SidebarBrandTitle
                                    style={{
                                        fontSize: isPersistentSidebar ? 28 : 30,
                                        lineHeight: isPersistentSidebar
                                            ? 32
                                            : 36,
                                    }}
                                />
                                <Text
                                    className="max-w-full min-w-0 break-words text-xs font-bold tracking-[1.2px]"
                                    style={{ color: tokens.colors.accent }}
                                >
                                    {subAppTitle}
                                </Text>
                            </View>
                            {!isPersistentSidebar ? (
                                <Pressable
                                    accessibilityLabel="Fermer le menu"
                                    accessibilityRole="button"
                                    className="h-11 w-11 shrink-0 items-center justify-center border"
                                    onPress={() => setIsSidebarVisible(false)}
                                    style={menuButtonStyle}
                                >
                                    <Icon
                                        color={tokens.colors.textPrimary}
                                        name="close"
                                        size={22}
                                    />
                                </Pressable>
                            ) : null}
                        </View>
                    </View>

                    <ScrollView
                        className="min-h-0 w-full max-w-full min-w-0 flex-1"
                        contentContainerStyle={sidebarNavigationContentStyle}
                        showsVerticalScrollIndicator={false}
                    >
                        <View
                            className="w-full max-w-full min-w-0"
                            style={sidebarNavigationContentStyle}
                        >
                            <AppNavigation
                                activeView={activeView}
                                sessionLabel={sessionLabel}
                                onViewChange={handleViewChange}
                            />
                        </View>
                    </ScrollView>

                    <View
                        className="w-full max-w-full min-w-0 shrink-0 gap-3 border-t pt-4"
                        style={{ borderColor: designTheme.colors.borderSoft }}
                    >
                        <Text
                            className="max-w-full min-w-0 text-xs font-bold uppercase tracking-[1px]"
                            style={{ color: tokens.colors.accent }}
                        >
                            Thème
                        </Text>
                        <OptionSwitchRow
                            accessibilityLabel="Basculer entre thème Pulse et thème Néon"
                            onToggle={(isEnabled) =>
                                setThemeFamily(isEnabled ? "neon" : "pulse")
                            }
                            title={isNeonTheme ? "Néon" : "Pulse"}
                            value={isNeonTheme}
                        />
                        <OptionSwitchRow
                            accessibilityLabel="Thème clair"
                            onToggle={(isEnabled) =>
                                setThemeMode(isEnabled ? "light" : "dark")
                            }
                            title={isLightTheme ? "Clair" : "Sombre"}
                            value={isLightTheme}
                        />
                    </View>
                    <View
                        className="w-full max-w-full min-w-0 shrink-0 gap-4 border-t pt-4"
                        style={{
                            borderColor: designTheme.colors.borderSoft,
                        }}
                    >
                        <View className="gap-2">
                            <ActionButton
                                onPress={() => void signOut()}
                                variant="secondary"
                            >
                                Se déconnecter
                            </ActionButton>
                        </View>
                    </View>
                </View>
            </>
        ) : null;

    return (
        <ScreenShell
            fixedContent={sidebarLayer}
            scrollStorageKey={
                user?.id
                    ? displaySessionStorageKey(
                          user.id,
                          `route:${activeView}:scroll`,
                      )
                    : null
            }
        >
            <View
                className="w-full max-w-full min-w-0 gap-4"
                nativeID={`protected-app-${getDisplaySessionRuntimeId()}`}
                style={isPersistentSidebar ? webDesktopContentStyle : undefined}
            >
                {!isPersistentSidebar ? (
                    <View
                        className="w-full max-w-full min-w-0 gap-3 pt-2"
                        style={topHeaderStyle(isCompactHeader)}
                    >
                        <View
                            className="max-w-full min-w-0 flex-1 flex-row items-start gap-3"
                            style={topHeaderBrandRowStyle(isCompactHeader)}
                        >
                            <Pressable
                                accessibilityLabel={
                                    isSidebarVisible
                                        ? "Fermer le menu"
                                        : "Ouvrir le menu"
                                }
                                accessibilityRole="button"
                                className="h-11 w-11 shrink-0 items-center justify-center border"
                                onPress={() =>
                                    setIsSidebarVisible(
                                        (isVisible) => !isVisible,
                                    )
                                }
                                style={menuButtonStyle}
                            >
                                <Icon
                                    color={tokens.colors.textPrimary}
                                    name={isSidebarVisible ? "close" : "menu"}
                                    size={22}
                                />
                            </Pressable>
                            <View
                                className="min-w-0 flex-1 gap-1.5"
                                style={topHeaderBrandStyle(isCompactHeader)}
                            >
                                <Text
                                    className="max-w-full min-w-0 uppercase font-extrabold"
                                    style={[
                                        { color: tokens.colors.textPrimary },
                                        topHeaderTitleStyle(isNarrowHeader),
                                    ]}
                                >
                                    {appTitle}
                                </Text>
                                <Text
                                    className="break-words text-xs font-bold tracking-[1.2px]"
                                    style={{ color: tokens.colors.accent }}
                                >
                                    {subAppTitle}
                                </Text>
                            </View>
                        </View>
                    </View>
                ) : null}

                <View className="box-border w-full max-w-full min-w-0 gap-4">
                    <View className="w-full max-w-full min-w-0 flex-row justify-end">
                        <ConnectionStatus />
                    </View>
                    <InstallAppBanner />
                    <UpdateAvailablePrompt />
                    {authorizationError ? (
                        <View
                            className="w-full max-w-full min-w-0 border px-4 py-3"
                            style={{
                                backgroundColor: tokens.colors.dangerSurface,
                                borderColor: tokens.colors.dangerText,
                            }}
                        >
                            <Text
                                className="break-words text-sm font-semibold"
                                style={{ color: tokens.colors.dangerText }}
                            >
                                {authorizationError}
                            </Text>
                        </View>
                    ) : null}
                    {children}
                </View>
            </View>
        </ScreenShell>
    );
}

function parseLayoutState(value: unknown) {
    if (!value || typeof value !== "object") return null;
    const candidate = value as { isSidebarVisible?: unknown };
    return typeof candidate.isSidebarVisible === "boolean"
        ? { isSidebarVisible: candidate.isSidebarVisible }
        : null;
}

function accountTypeLabel(accountType: "admin" | "premium" | "basic" | undefined) {
    if (accountType === "admin") return "Administrateur";
    if (accountType === "premium") return "Premium";
    if (accountType === "basic") return "Basic";
    return "connecté";
}

function OptionSwitchRow({
    title,
    accessibilityLabel,
    value,
    onToggle,
}: {
    title: string;
    accessibilityLabel: string;
    value: boolean;
    onToggle: (isEnabled: boolean) => void;
}) {
    const tokens = useThemeTokens();

    return (
        <View className="w-full max-w-full min-w-0 flex-row items-center justify-between gap-3">
            <View className="min-w-0 flex-1 gap-1">
                <Text
                    className="max-w-full min-w-0 text-sm font-extrabold"
                    numberOfLines={1}
                    style={{ color: tokens.colors.textPrimary }}
                >
                    {title}
                </Text>
            </View>
            <Switch
                accessibilityLabel={accessibilityLabel}
                accessibilityRole="switch"
                onValueChange={onToggle}
                thumbColor={
                    value
                        ? tokens.colors.actionBackground
                        : tokens.colors.surfaceElevated
                }
                trackColor={{
                    false: tokens.colors.border,
                    true: tokens.colors.accentSoft,
                }}
                value={value}
            />
        </View>
    );
}

function topHeaderStyle(isCompactHeader: boolean): ViewStyle {
    return {
        alignItems: isCompactHeader ? "stretch" : "flex-start",
        flexDirection: isCompactHeader ? "column" : "row",
        justifyContent: "space-between",
    };
}

function topHeaderBrandRowStyle(isCompactHeader: boolean): ViewStyle {
    return {
        width: isCompactHeader ? "100%" : undefined,
    };
}

function topHeaderBrandStyle(isCompactHeader: boolean): ViewStyle {
    return {
        minWidth: isCompactHeader ? 0 : 180,
    };
}

function topHeaderTitleStyle(isNarrowHeader: boolean): TextStyle {
    return {
        fontSize: isNarrowHeader ? 26 : 30,
        lineHeight: isNarrowHeader ? 29 : 34,
    };
}

function SidebarBrandTitle({ style }: { style: TextStyle }) {
    const { tokens } = useTheme();

    return (
        <View className="max-w-full min-w-0">
            <Text
                className="min-w-0 uppercase font-extrabold"
                numberOfLines={1}
                style={[
                    {
                        color: tokens.colors.textPrimary,
                        flexShrink: 1,
                    },
                    style,
                ]}
            >
                {appTitle}
            </Text>
        </View>
    );
}
