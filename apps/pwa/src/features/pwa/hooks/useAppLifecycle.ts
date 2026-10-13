import { useEffect, useRef } from "react";
import { Platform } from "react-native";

import { trackPwaEvent } from "../services/pwaAnalytics";

export function useAppLifecycle() {
  const hasTrackedStartRef = useRef(false);

  useEffect(() => {
    if (Platform.OS !== "web" || typeof document === "undefined") {
      return undefined;
    }

    let previousVisibility = document.visibilityState;

    if (!hasTrackedStartRef.current) {
      hasTrackedStartRef.current = true;
      trackPwaEvent("pwa_app_start");
    }

    const handleVisibilityChange = () => {
      const currentVisibility = document.visibilityState;
      if (currentVisibility === previousVisibility) return;

      const previousState = previousVisibility;
      previousVisibility = currentVisibility;

      if (currentVisibility === "hidden") {
        trackPwaEvent("pwa_app_background", {
          previousVisibility: previousState,
        });
      } else if (
        currentVisibility === "visible" &&
        previousState === "hidden"
      ) {
        trackPwaEvent("pwa_app_foreground");
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, []);
}
