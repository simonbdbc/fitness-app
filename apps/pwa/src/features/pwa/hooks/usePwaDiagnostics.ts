import { useCallback, useEffect, useRef, useState } from "react";
import { Platform } from "react-native";

import { reportTechnicalDegradationOnce } from "@shared/observability/technicalDiagnostics";
import type {
  PwaApiStatus,
  PwaBuildInfo,
  PwaDiagnostics,
  PwaNetworkStatus,
  PwaServiceWorkerStatus,
} from "../types";
import { readPwaDisplayMode } from "../services/installationEnvironment";
import { trackPwaEvent } from "../services/pwaAnalytics";
import {
  fallbackBuildInfo,
  lastUpdateErrorKey,
  pwaCachePrefix,
  requestServiceWorkerDiagnostics,
} from "../services/serviceWorkerClient";

type ConnectionStatus = {
  apiStatus: PwaApiStatus;
  networkStatus: PwaNetworkStatus;
};

export function usePwaDiagnostics({
  apiStatus,
  buildInfo,
  lastUpdateError,
  refreshConnectionStatus,
  remoteBuildInfo,
  serviceWorkerStatus,
}: {
  apiStatus: PwaApiStatus;
  buildInfo: PwaBuildInfo | null;
  lastUpdateError: string | null;
  refreshConnectionStatus: () => Promise<ConnectionStatus>;
  remoteBuildInfo: PwaBuildInfo | null;
  serviceWorkerStatus: PwaServiceWorkerStatus;
}) {
  const [diagnostics, setDiagnostics] = useState<PwaDiagnostics | null>(null);
  const initialDiagnosticsStartedRef = useRef(false);

  const refreshDiagnostics = useCallback(async () => {
    if (Platform.OS !== "web" || typeof window === "undefined") {
      setDiagnostics({
        manifestDetected: false,
        displayMode: "unknown",
        serviceWorkerSupported: false,
        serviceWorkerStatus: "unsupported",
        serviceWorkerActive: false,
        caches: [],
        storageUsageBytes: null,
        storageQuotaBytes: null,
        currentBuildInfo: fallbackBuildInfo,
        remoteBuildInfo: null,
        lastUpdateError: null,
        online: true,
        networkStatus: "connected",
        apiStatus,
      });
      return;
    }

    const [
      manifestDetected,
      cacheNames,
      estimate,
      workerDiagnostics,
      connectionStatus,
    ] = await Promise.all([
      fetch("/manifest.webmanifest", { cache: "no-store" })
        .then((response) => response.ok)
        .catch((error: unknown) =>
          optionalDiagnosticFallback("pwa-manifest-diagnostic", error, false),
        ),
      "caches" in window
        ? caches
            .keys()
            .catch((error: unknown) =>
              optionalDiagnosticFallback("pwa-cache-diagnostic", error, []),
            )
        : Promise.resolve([]),
      navigator.storage
        ?.estimate?.()
        .catch((error: unknown) =>
          optionalDiagnosticFallback("pwa-storage-diagnostic", error, null),
        ) ??
        Promise.resolve(null),
      requestServiceWorkerDiagnostics().catch((error: unknown) =>
        optionalDiagnosticFallback("pwa-worker-diagnostic", error, null),
      ),
      refreshConnectionStatus(),
    ]);

    const activeBuildInfo = workerDiagnostics?.buildInfo ?? buildInfo;
    const nextDiagnostics: PwaDiagnostics = {
      manifestDetected,
      displayMode: readPwaDisplayMode(),
      serviceWorkerSupported: "serviceWorker" in navigator,
      serviceWorkerStatus,
      serviceWorkerActive: Boolean(navigator.serviceWorker?.controller),
      caches: workerDiagnostics?.caches ?? cacheNames,
      storageUsageBytes: estimate?.usage ?? null,
      storageQuotaBytes: estimate?.quota ?? null,
      currentBuildInfo: activeBuildInfo,
      remoteBuildInfo,
      lastUpdateError:
        window.localStorage.getItem(lastUpdateErrorKey) ?? lastUpdateError,
      online: navigator.onLine,
      networkStatus: connectionStatus.networkStatus,
      apiStatus: connectionStatus.apiStatus,
    };

    setDiagnostics(nextDiagnostics);
    trackPwaEvent("pwa_diagnostics_refreshed", {
      cacheCount: nextDiagnostics.caches.length,
      serviceWorkerActive: nextDiagnostics.serviceWorkerActive,
      serviceWorkerStatus: nextDiagnostics.serviceWorkerStatus,
      storageUsageBytes: nextDiagnostics.storageUsageBytes,
    });
  }, [
    apiStatus,
    buildInfo,
    lastUpdateError,
    refreshConnectionStatus,
    remoteBuildInfo,
    serviceWorkerStatus,
  ]);

  const clearPwaCaches = useCallback(async () => {
    if (
      Platform.OS !== "web" ||
      typeof window === "undefined" ||
      !("caches" in window)
    ) {
      return;
    }

    try {
      trackPwaEvent("pwa_cache_clear_started");
      const cacheNames = await caches.keys();
      await Promise.all(
        cacheNames
          .filter((cacheName) => cacheName.startsWith(`${pwaCachePrefix}-`))
          .map((cacheName) => caches.delete(cacheName)),
      );
      await refreshDiagnostics();
      trackPwaEvent("pwa_cache_clear_completed", {
        cacheCount: cacheNames.length,
      });
    } catch (error) {
      trackPwaEvent("pwa_cache_clear_failed", {
        message: errorMessageFromUnknown(error),
      });
      throw error;
    }
  }, [refreshDiagnostics]);

  useEffect(() => {
    if (
      Platform.OS === "web" &&
      typeof window !== "undefined" &&
      !initialDiagnosticsStartedRef.current
    ) {
      initialDiagnosticsStartedRef.current = true;
      void refreshDiagnostics();
    }
  }, [refreshDiagnostics]);

  return { clearPwaCaches, diagnostics, refreshDiagnostics };
}

function errorMessageFromUnknown(error: unknown) {
  if (error instanceof Error && error.message.trim()) return error.message;
  return "Action PWA indisponible.";
}

function optionalDiagnosticFallback<T>(
  scope: string,
  error: unknown,
  fallback: T,
): T {
  reportTechnicalDegradationOnce(scope, error);
  return fallback;
}
