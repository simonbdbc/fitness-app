import type { PropsWithChildren } from "react";
import { useEffect, useState } from "react";
import { Platform, View } from "react-native";

import {
  getLocalDatabaseErrorCode,
  initializeDatabase,
  type LocalDatabaseErrorCode,
} from "@shared/db";
import { useThemeTokens } from "@shared/theme";
import {
  ActionButton,
  AppLoadingScreen,
  BodyText,
  ScreenShell,
} from "@shared/ui";

type DatabaseGateState =
  | { status: "initializing" }
  | { code: LocalDatabaseErrorCode | null; message: string; status: "error" }
  | { status: "ready" };

export function DatabaseGate({ children }: PropsWithChildren) {
  const [state, setState] = useState<DatabaseGateState>({
    status: "initializing",
  });
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let isMounted = true;

    setState({ status: "initializing" });
    void initializeDatabase()
      .then(() => {
        if (isMounted) {
          setState({ status: "ready" });
        }
      })
      .catch((error: unknown) => {
        if (isMounted) {
          setState({
            code: getLocalDatabaseErrorCode(error),
            message: errorMessageFromUnknown(error),
            status: "error",
          });
        }
      });

    return () => {
      isMounted = false;
    };
  }, [attempt]);

  if (state.status === "ready") {
    return <>{children}</>;
  }

  if (state.status === "initializing") {
    return (
      <AppLoadingScreen accessibilityLabel="Initialisation de la base locale" />
    );
  }

  return (
    <DatabaseErrorScreen
      code={state.code}
      message={state.message}
      onReload={reloadApplication}
      onRetry={() => setAttempt((currentAttempt) => currentAttempt + 1)}
    />
  );
}

function DatabaseErrorScreen({
  code,
  message,
  onReload,
  onRetry,
}: {
  code: LocalDatabaseErrorCode | null;
  message: string;
  onReload: () => void;
  onRetry: () => void;
}) {
  const tokens = useThemeTokens();
  const shouldRetry =
    code === "LOCAL_DATABASE_BLOCKED" || Platform.OS !== "web";

  return (
    <ScreenShell>
      <View className="w-full max-w-[520px] flex-1 items-center justify-center gap-6 self-center py-10">
        <BodyText
          accessibilityRole="alert"
          className="text-center text-base leading-6"
          selectable
          style={{ color: tokens.colors.dangerText }}
        >
          {message}
        </BodyText>
        <ActionButton
          className="min-w-[160px]"
          onPress={shouldRetry ? onRetry : onReload}
          variant="primary"
        >
          {shouldRetry ? "Réessayer" : "Recharger"}
        </ActionButton>
      </View>
    </ScreenShell>
  );
}

function reloadApplication() {
  if (Platform.OS === "web" && typeof window !== "undefined") {
    window.location.reload();
  }
}

function errorMessageFromUnknown(error: unknown) {
  if (error instanceof Error && error.message.trim()) {
    return error.message;
  }

  return "La base locale SQLite n'a pas pu être initialisée.";
}
