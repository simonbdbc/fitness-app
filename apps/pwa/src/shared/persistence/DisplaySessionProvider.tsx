import { useEffect, useState, type PropsWithChildren } from "react";

import { AppLoadingScreen } from "@shared/ui";
import {
  getWebNavigationType,
  initializeDisplaySessionPersistence,
  shouldOpenHomeForNewDisplayRuntime,
} from "./displaySessionPersistence";

export function DisplaySessionProvider({ children }: PropsWithChildren) {
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    let active = true;
    void initializeDisplaySessionPersistence().finally(() => {
      if (!active) return;
      if (
        typeof window !== "undefined" &&
        shouldOpenHomeForNewDisplayRuntime({
          navigationType: getWebNavigationType(),
          pathname: window.location.pathname,
        })
      ) {
        window.location.replace("/home");
        return;
      }
      setIsReady(true);
    });
    return () => {
      active = false;
    };
  }, []);

  if (!isReady) {
    return (
      <AppLoadingScreen accessibilityLabel="Préparation de la session d’affichage" />
    );
  }

  return <>{children}</>;
}
