import type { PropsWithChildren } from "react";
import { createContext, useContext, useMemo } from "react";

import { useAppLifecycle } from "../hooks/useAppLifecycle";
import { useConnectionHealth } from "../hooks/useConnectionHealth";
import { useInstallationLifecycle } from "../hooks/useInstallationLifecycle";
import { usePwaDiagnostics } from "../hooks/usePwaDiagnostics";
import { useServiceWorkerLifecycle } from "../hooks/useServiceWorkerLifecycle";
import type {
  PwaApiStatus,
  PwaBuildInfo,
  PwaDiagnostics,
  PwaDisplayMode,
  PwaInstallStatus,
  PwaMenuTarget,
  PwaNetworkStatus,
  PwaServiceWorkerStatus,
  PwaUpdateStatus,
} from "../types";

export type PwaContextValue = {
  buildInfo: PwaBuildInfo | null;
  remoteBuildInfo: PwaBuildInfo | null;
  networkStatus: PwaNetworkStatus;
  apiStatus: PwaApiStatus;
  diagnostics: PwaDiagnostics | null;
  displayMode: PwaDisplayMode;
  installError: string | null;
  installStatus: PwaInstallStatus;
  isInstallPromptAvailable: boolean;
  isUpdateAvailable: boolean;
  lastUpdateError: string | null;
  menuInstallLabel: string;
  menuInstallTarget: PwaMenuTarget;
  serviceWorkerStatus: PwaServiceWorkerStatus;
  updateStatus: PwaUpdateStatus;
  applyUpdate: () => Promise<void>;
  clearPwaCaches: () => Promise<void>;
  dismissInstall: () => void;
  dismissUpdate: () => void;
  promptInstall: () => Promise<void>;
  refreshDiagnostics: () => Promise<void>;
  resetInstallDismissal: () => void;
};

const PwaContext = createContext<PwaContextValue | null>(null);

const unavailablePwaContextValue: PwaContextValue = {
  apiStatus: "unavailable",
  applyUpdate: async () => undefined,
  buildInfo: null,
  clearPwaCaches: async () => undefined,
  diagnostics: null,
  dismissInstall: () => undefined,
  dismissUpdate: () => undefined,
  displayMode: "unknown",
  installError: "Fonctionnalités PWA indisponibles.",
  installStatus: "unsupported",
  isInstallPromptAvailable: false,
  isUpdateAvailable: false,
  lastUpdateError: "Fonctionnalités PWA indisponibles.",
  menuInstallLabel: "Installation indisponible",
  menuInstallTarget: "install",
  networkStatus: "connected",
  promptInstall: async () => undefined,
  refreshDiagnostics: async () => undefined,
  remoteBuildInfo: null,
  resetInstallDismissal: () => undefined,
  serviceWorkerStatus: "disabled",
  updateStatus: "error",
};

export function PwaProvider({ children }: PropsWithChildren) {
  useAppLifecycle();
  const { apiStatus, networkStatus, refreshConnectionStatus } =
    useConnectionHealth();
  const {
    dismissInstall,
    displayMode,
    installError,
    installStatus,
    isInstallPromptAvailable,
    promptInstall,
    resetInstallDismissal,
  } = useInstallationLifecycle();
  const {
    applyUpdate,
    buildInfo,
    dismissUpdate,
    isUpdateAvailable,
    lastUpdateError,
    remoteBuildInfo,
    serviceWorkerStatus,
    updateStatus,
  } = useServiceWorkerLifecycle();
  const { clearPwaCaches, diagnostics, refreshDiagnostics } =
    usePwaDiagnostics({
      apiStatus,
      buildInfo,
      lastUpdateError,
      refreshConnectionStatus,
      remoteBuildInfo,
      serviceWorkerStatus,
    });
  const menuInstallTarget = getMenuInstallTarget({
    displayMode,
    installStatus,
    isUpdateAvailable,
    updateStatus,
  });
  const menuInstallLabel = getMenuInstallLabel({
    displayMode,
    installStatus,
    isUpdateAvailable,
    updateStatus,
  });

  const value = useMemo<PwaContextValue>(
    () => ({
      apiStatus,
      applyUpdate,
      buildInfo,
      clearPwaCaches,
      diagnostics,
      dismissInstall,
      dismissUpdate,
      displayMode,
      installError,
      installStatus,
      isInstallPromptAvailable,
      isUpdateAvailable,
      lastUpdateError,
      menuInstallLabel,
      menuInstallTarget,
      networkStatus,
      promptInstall,
      refreshDiagnostics,
      remoteBuildInfo,
      resetInstallDismissal,
      serviceWorkerStatus,
      updateStatus,
    }),
    [
      apiStatus,
      applyUpdate,
      buildInfo,
      clearPwaCaches,
      diagnostics,
      dismissInstall,
      dismissUpdate,
      displayMode,
      installError,
      installStatus,
      isInstallPromptAvailable,
      isUpdateAvailable,
      lastUpdateError,
      menuInstallLabel,
      menuInstallTarget,
      networkStatus,
      promptInstall,
      refreshDiagnostics,
      remoteBuildInfo,
      resetInstallDismissal,
      serviceWorkerStatus,
      updateStatus,
    ],
  );

  return <PwaContext.Provider value={value}>{children}</PwaContext.Provider>;
}

export function PwaUnavailableProvider({ children }: PropsWithChildren) {
  return (
    <PwaContext.Provider value={unavailablePwaContextValue}>
      {children}
    </PwaContext.Provider>
  );
}

export function usePwa() {
  const value = useContext(PwaContext);

  if (!value) {
    throw new Error("usePwa must be used inside PwaProvider");
  }

  return value;
}

function getMenuInstallTarget({
  displayMode,
  installStatus,
  isUpdateAvailable,
  updateStatus,
}: {
  displayMode: PwaDisplayMode;
  installStatus: PwaInstallStatus;
  isUpdateAvailable: boolean;
  updateStatus: PwaUpdateStatus;
}): PwaMenuTarget {
  if (isUpdateAvailable || updateStatus === "available") return "settings";
  if (displayMode !== "browser" || installStatus === "installed") {
    return "uninstall";
  }
  return "install";
}

function getMenuInstallLabel({
  displayMode,
  installStatus,
  isUpdateAvailable,
  updateStatus,
}: {
  displayMode: PwaDisplayMode;
  installStatus: PwaInstallStatus;
  isUpdateAvailable: boolean;
  updateStatus: PwaUpdateStatus;
}) {
  if (isUpdateAvailable || updateStatus === "available") {
    return "Mise a jour disponible";
  }
  if (displayMode !== "browser" || installStatus === "installed") {
    return "App installee";
  }

  switch (installStatus) {
    case "available":
      return "Installer l'app";
    case "manual":
      return "Installer manuellement";
    case "dismissed":
      return "Installation masquee";
    case "error":
      return "Installation en erreur";
    case "checking":
      return "Installation";
    default:
      return "Installation indisponible";
  }
}
