import "../global.css";
import "react-native-gesture-handler";

import { Stack } from "expo-router";
import { SafeAreaProvider } from "react-native-safe-area-context";

import {
  ApplicationFatalScreen,
  DatabaseGate,
  ProviderErrorBoundary,
} from "@application";
import { AuthProvider } from "@features/auth";
import { PwaProvider, PwaUnavailableProvider } from "@features/pwa";
import { ACREAProfileProvider } from "@features/programming";
import { DisplaySessionProvider } from "@shared/persistence";
import { ThemeProvider } from "@shared/theme";

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <ThemeProvider>
        <DisplaySessionProvider>
          <ProviderErrorBoundary
            fallback={
              <PwaUnavailableProvider>
                <CoreApplicationBoundary />
              </PwaUnavailableProvider>
            }
            scope="pwa-provider"
          >
            <PwaProvider>
              <CoreApplicationBoundary />
            </PwaProvider>
          </ProviderErrorBoundary>
        </DisplaySessionProvider>
      </ThemeProvider>
    </SafeAreaProvider>
  );
}

function CoreApplicationBoundary() {
  return (
    <ProviderErrorBoundary
      fallback={<ApplicationFatalScreen />}
      scope="core-application"
    >
      <DatabaseGate>
        <AuthProvider>
          <ACREAProfileProvider>
            <Stack screenOptions={{ headerShown: false }} />
          </ACREAProfileProvider>
        </AuthProvider>
      </DatabaseGate>
    </ProviderErrorBoundary>
  );
}
