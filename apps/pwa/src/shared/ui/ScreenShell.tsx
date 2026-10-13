import { StatusBar } from "expo-status-bar";
import type { PropsWithChildren, ReactNode } from "react";
import { Platform, ScrollView, View } from "react-native";
import type { ViewStyle } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { useThemeTokens } from "@shared/theme";
import { usePersistentScrollPosition } from "@shared/persistence";

const webViewportStyle = {
  height: "100vh",
  maxWidth: "100vw",
  overflowX: "hidden",
  width: "100vw",
} as unknown as ViewStyle;

const webContentStyle = {
  boxSizing: "border-box",
  flexGrow: 1,
  maxWidth: "100vw",
  overflowX: "hidden",
  width: "100%",
} as unknown as ViewStyle;

type ScreenShellProps = PropsWithChildren<{
  fixedContent?: ReactNode;
  scrollStorageKey?: string | null;
}>;

export function ScreenShell({
  children,
  fixedContent,
  scrollStorageKey = null,
}: ScreenShellProps) {
  const tokens = useThemeTokens();
  const scroll = usePersistentScrollPosition(scrollStorageKey);
  const viewportStyle = Platform.OS === "web" ? webViewportStyle : undefined;
  const contentStyle = Platform.OS === "web" ? webContentStyle : undefined;

  return (
    <SafeAreaView
      className="flex-1"
      style={[viewportStyle, { backgroundColor: tokens.colors.background }]}
    >
      <StatusBar style={tokens.mode === "dark" ? "light" : "dark"} />
      <ScrollView
        className="box-border flex-1"
        contentContainerStyle={contentStyle}
        contentInsetAdjustmentBehavior="automatic"
        key={scrollStorageKey ?? "unpersisted-scroll"}
        onContentSizeChange={scroll.onContentSizeChange}
        onMomentumScrollEnd={scroll.onMomentumScrollEnd}
        onScroll={scroll.onScroll}
        onScrollBeginDrag={scroll.onScrollBeginDrag}
        onScrollEndDrag={scroll.onScrollEndDrag}
        ref={scroll.scrollRef}
        scrollEventThrottle={100}
        style={[viewportStyle, { backgroundColor: tokens.colors.background }]}
        testID="protected-scroll-view"
      >
        <View
          className="box-border w-full max-w-full min-w-0 gap-4 p-5"
          style={contentStyle}
        >
          {children}
        </View>
      </ScrollView>
      {fixedContent}
    </SafeAreaView>
  );
}
