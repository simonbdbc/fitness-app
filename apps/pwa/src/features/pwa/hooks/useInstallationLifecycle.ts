import { useCallback, useEffect, useRef, useState } from "react";
import { Platform } from "react-native";

import type { PwaDisplayMode, PwaInstallStatus } from "../types";
import {
  clearInstallDismissal,
  hasRecentInstallDismissal,
  isIosLike,
  readInstallFallbackStatus,
  readPwaDisplayMode,
  supportsManualInstallation,
  writeInstallDismissal,
} from "../services/installationEnvironment";
import {
  capturedInstallPromptEventName,
  clearCapturedInstallPrompt,
  readCapturedInstallPrompt,
  rememberCapturedInstallPrompt,
  type BeforeInstallPromptEvent,
} from "../services/installPromptBridge";
import { trackPwaEvent } from "../services/pwaAnalytics";
import { resolveInstallStatus } from "../services/pwaLifecycle";

const installDetectionTimeoutMs = 5_000;

export function useInstallationLifecycle() {
  const [displayMode, setDisplayMode] =
    useState<PwaDisplayMode>("unknown");
  const [installError, setInstallError] = useState<string | null>(null);
  const [installStatus, setInstallStatus] =
    useState<PwaInstallStatus>("checking");
  const [isInstallPromptAvailable, setIsInstallPromptAvailable] =
    useState(false);
  const deferredInstallPromptRef = useRef<BeforeInstallPromptEvent | null>(
    null,
  );

  const promptInstall = useCallback(async () => {
    if (Platform.OS !== "web" || typeof window === "undefined") {
      return;
    }

    const promptEvent =
      deferredInstallPromptRef.current ?? readCapturedInstallPrompt();
    if (!promptEvent) {
      setInstallStatus(readInstallFallbackStatus());
      return;
    }

    try {
      setInstallError(null);
      trackPwaEvent("pwa_install_prompt_started");
      await promptEvent.prompt();
      const choice = await promptEvent.userChoice;
      deferredInstallPromptRef.current = null;
      clearCapturedInstallPrompt(promptEvent);
      setIsInstallPromptAvailable(false);

      if (choice.outcome === "accepted") {
        setInstallStatus("installed");
        trackPwaEvent("pwa_install_prompt_accepted", {
          platform: choice.platform,
        });
      } else {
        writeInstallDismissal();
        setInstallStatus("dismissed");
        trackPwaEvent("pwa_install_dismissed", {
          source: "native_prompt",
        });
      }
    } catch (error) {
      deferredInstallPromptRef.current = null;
      clearCapturedInstallPrompt(promptEvent);
      setIsInstallPromptAvailable(false);
      const message = errorMessageFromUnknown(error);
      setInstallError(message);
      setInstallStatus("error");
      trackPwaEvent("pwa_install_prompt_error", { message });
    }
  }, []);

  const dismissInstall = useCallback(() => {
    writeInstallDismissal();
    setInstallStatus("dismissed");
    trackPwaEvent("pwa_install_dismissed", { source: "app" });
  }, []);

  const resetInstallDismissal = useCallback(() => {
    clearInstallDismissal();
    setInstallStatus(
      deferredInstallPromptRef.current
        ? "available"
        : readInstallFallbackStatus(),
    );
    trackPwaEvent("pwa_install_reset");
  }, []);

  useEffect(() => {
    if (Platform.OS !== "web" || typeof window === "undefined") {
      return undefined;
    }

    const updateDisplayMode = () => {
      const nextDisplayMode = readPwaDisplayMode();
      setDisplayMode((currentDisplayMode) => {
        if (currentDisplayMode !== nextDisplayMode) {
          trackPwaEvent("pwa_display_mode_changed", {
            displayMode: nextDisplayMode,
          });
        }
        return nextDisplayMode;
      });
    };
    updateDisplayMode();

    const standaloneQuery = window.matchMedia("(display-mode: standalone)");
    const fullscreenQuery = window.matchMedia("(display-mode: fullscreen)");
    const minimalUiQuery = window.matchMedia("(display-mode: minimal-ui)");
    standaloneQuery.addEventListener("change", updateDisplayMode);
    fullscreenQuery.addEventListener("change", updateDisplayMode);
    minimalUiQuery.addEventListener("change", updateDisplayMode);

    return () => {
      standaloneQuery.removeEventListener("change", updateDisplayMode);
      fullscreenQuery.removeEventListener("change", updateDisplayMode);
      minimalUiQuery.removeEventListener("change", updateDisplayMode);
    };
  }, []);

  useEffect(() => {
    if (Platform.OS !== "web" || typeof window === "undefined") {
      return undefined;
    }

    const updateStatus = (detectionComplete: boolean) => {
      const currentDisplayMode = readPwaDisplayMode();
      setInstallStatus(
        resolveInstallStatus({
          detectionComplete,
          displayMode: currentDisplayMode,
          hasDismissal: hasRecentInstallDismissal(),
          hasPrompt: Boolean(deferredInstallPromptRef.current),
          supportsManualInstall:
            isIosLike() || supportsManualInstallation(),
        }),
      );
    };

    const captureInstallPrompt = (promptEvent: BeforeInstallPromptEvent) => {
      const isNewPrompt = deferredInstallPromptRef.current !== promptEvent;
      deferredInstallPromptRef.current = promptEvent;
      rememberCapturedInstallPrompt(promptEvent);
      setIsInstallPromptAvailable(true);
      if (isNewPrompt) {
        trackPwaEvent("pwa_install_prompt_available");
      }
      if (!hasRecentInstallDismissal()) {
        setInstallStatus("available");
      }
    };
    const beforeInstallPromptHandler = (event: Event) => {
      event.preventDefault();
      captureInstallPrompt(event as BeforeInstallPromptEvent);
    };
    const capturedInstallPromptHandler = () => {
      const capturedPrompt = readCapturedInstallPrompt();
      if (capturedPrompt) captureInstallPrompt(capturedPrompt);
    };
    const appInstalledHandler = () => {
      deferredInstallPromptRef.current = null;
      clearCapturedInstallPrompt();
      setIsInstallPromptAvailable(false);
      setInstallStatus("installed");
      trackPwaEvent("pwa_installed");
    };
    const timer = window.setTimeout(
      () => updateStatus(true),
      installDetectionTimeoutMs,
    );

    window.addEventListener("beforeinstallprompt", beforeInstallPromptHandler);
    window.addEventListener(
      capturedInstallPromptEventName,
      capturedInstallPromptHandler,
    );
    window.addEventListener("appinstalled", appInstalledHandler);
    capturedInstallPromptHandler();
    updateStatus(false);

    return () => {
      window.clearTimeout(timer);
      window.removeEventListener(
        "beforeinstallprompt",
        beforeInstallPromptHandler,
      );
      window.removeEventListener(
        capturedInstallPromptEventName,
        capturedInstallPromptHandler,
      );
      window.removeEventListener("appinstalled", appInstalledHandler);
    };
  }, []);

  return {
    dismissInstall,
    displayMode,
    installError,
    installStatus,
    isInstallPromptAvailable,
    promptInstall,
    resetInstallDismissal,
  };
}

function errorMessageFromUnknown(error: unknown) {
  if (error instanceof Error && error.message.trim()) {
    return error.message;
  }

  return "Action PWA indisponible.";
}
