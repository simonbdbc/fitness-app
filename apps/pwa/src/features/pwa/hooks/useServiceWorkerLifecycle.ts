import { useCallback, useEffect, useRef, useState } from "react";
import { Platform } from "react-native";

import {
  reportTechnicalDegradation,
  reportTechnicalDegradationOnce,
} from "@shared/observability/technicalDiagnostics";
import { clearCurrentDisplaySession } from "@shared/persistence";
import type {
  PwaBuildInfo,
  PwaServiceWorkerStatus,
  PwaUpdateStatus,
} from "../types";
import { trackPwaEvent } from "../services/pwaAnalytics";
import {
  hasRemoteBuildChanged,
  shouldReloadAfterControllerChange,
} from "../services/pwaLifecycle";
import {
  fallbackBuildInfo,
  fetchBuildInfo,
  getInitialServiceWorkerStatus,
  isServiceWorkerDisabledForRuntime,
  lastUpdateErrorKey,
  requestActiveWorkerBuildInfo,
  requestWorkerSkipWaiting,
  serviceWorkerUrl,
  unregisterDevelopmentServiceWorkers,
  waitForWaitingWorker,
} from "../services/serviceWorkerClient";

export function useServiceWorkerLifecycle() {
  const [buildInfo, setBuildInfo] = useState<PwaBuildInfo | null>(
    Platform.OS === "web" ? null : fallbackBuildInfo,
  );
  const [remoteBuildInfo, setRemoteBuildInfo] = useState<PwaBuildInfo | null>(
    null,
  );
  const [isUpdateAvailable, setIsUpdateAvailable] = useState(false);
  const [lastUpdateError, setLastUpdateError] = useState<string | null>(null);
  const [serviceWorkerStatus, setServiceWorkerStatus] =
    useState<PwaServiceWorkerStatus>(
      Platform.OS === "web" ? getInitialServiceWorkerStatus() : "unsupported",
    );
  const [updateStatus, setUpdateStatus] =
    useState<PwaUpdateStatus>("idle");
  const registrationRef = useRef<ServiceWorkerRegistration | null>(null);
  const trackedRemoteBuildIdRef = useRef<string | null>(null);
  const waitingWorkerRef = useRef<ServiceWorker | null>(null);
  const updateReloadStartedRef = useRef(false);

  const refreshBuildInfo = useCallback(async () => {
    if (Platform.OS !== "web" || typeof window === "undefined") {
      return;
    }

    const [currentInfo, nextRemoteInfo] = await Promise.all([
      readOptionalPwaValue(
        "pwa-active-worker-build-info",
        requestActiveWorkerBuildInfo,
      ),
      readOptionalPwaValue("pwa-remote-build-info", fetchBuildInfo),
    ]);
    const nextCurrentInfo = currentInfo ?? nextRemoteInfo;

    if (nextCurrentInfo) setBuildInfo(nextCurrentInfo);
    if (nextRemoteInfo) setRemoteBuildInfo(nextRemoteInfo);

    if (
      nextCurrentInfo &&
      nextRemoteInfo &&
      hasRemoteBuildChanged(nextCurrentInfo.buildId, nextRemoteInfo.buildId)
    ) {
      setIsUpdateAvailable(true);
      setUpdateStatus((currentStatus) =>
        ["applied", "reloadRequired", "updating"].includes(currentStatus)
          ? currentStatus
          : "available",
      );
      if (trackedRemoteBuildIdRef.current !== nextRemoteInfo.buildId) {
        trackedRemoteBuildIdRef.current = nextRemoteInfo.buildId;
        trackPwaEvent("pwa_update_available", {
          currentBuildId: nextCurrentInfo.buildId,
          remoteBuildId: nextRemoteInfo.buildId,
        });
      }
      return;
    }

    if (nextCurrentInfo && nextRemoteInfo) {
      setIsUpdateAvailable(false);
      trackedRemoteBuildIdRef.current = null;
      setUpdateStatus((currentStatus) =>
        currentStatus === "available" ? "idle" : currentStatus,
      );
    }
  }, []);

  const dismissUpdate = useCallback(() => {
    setIsUpdateAvailable(false);
    setUpdateStatus("idle");
    trackPwaEvent("pwa_update_dismissed");
  }, []);

  const applyUpdate = useCallback(async () => {
    if (Platform.OS !== "web" || typeof window === "undefined") {
      return;
    }

    try {
      setUpdateStatus("updating");
      trackPwaEvent("pwa_update_apply_started");
      window.localStorage.removeItem(lastUpdateErrorKey);
      const registration = !("serviceWorker" in navigator)
        ? null
        : (registrationRef.current ??
          (await navigator.serviceWorker.getRegistration()) ??
          null);
      if (registration) registrationRef.current = registration;
      await registration?.update();
      const waitingWorker =
        waitingWorkerRef.current ??
        registration?.waiting ??
        (registration ? await waitForWaitingWorker(registration) : null);

      if (waitingWorker) {
        updateReloadStartedRef.current = true;
        const acknowledged = await requestWorkerSkipWaiting(waitingWorker);
        if (!acknowledged) {
          updateReloadStartedRef.current = false;
          throw new Error(
            "Le service worker n'a pas confirmé la mise à jour. Réessaie sans recharger la page.",
          );
        }
        return;
      }

      setLastUpdateError(
        "La mise à jour est encore en téléchargement. Réessaie dans quelques secondes.",
      );
      setUpdateStatus("available");
    } catch (error) {
      const message = errorMessageFromUnknown(error);
      window.localStorage.setItem(lastUpdateErrorKey, message);
      setLastUpdateError(message);
      setUpdateStatus("error");
      trackPwaEvent("pwa_update_apply_failed", { message });
      reportTechnicalDegradation("pwa-update-apply", error);
    }
  }, []);

  useEffect(() => {
    if (Platform.OS !== "web" || typeof window === "undefined") {
      return undefined;
    }

    let cancelled = false;
    const controllerChangeHandler = () => {
      trackPwaEvent("pwa_controller_changed");
      if (shouldReloadAfterControllerChange(updateReloadStartedRef.current)) {
        waitingWorkerRef.current = null;
        setServiceWorkerStatus("active");
        setUpdateStatus("applied");
        void clearCurrentDisplaySession().finally(() => {
          window.location.replace("/");
        });
        return;
      }
      void refreshBuildInfo();
    };

    if (!("serviceWorker" in navigator)) {
      setServiceWorkerStatus("unsupported");
      void refreshBuildInfo();
      return undefined;
    }

    if (isServiceWorkerDisabledForRuntime()) {
      setServiceWorkerStatus("disabled");
      void unregisterDevelopmentServiceWorkers()
        .catch((error: unknown) => {
          reportTechnicalDegradationOnce(
            "pwa-development-worker-unregister",
            error,
          );
        })
        .finally(() => {
          void refreshBuildInfo();
        });
      return undefined;
    }

    setServiceWorkerStatus("registering");
    void navigator.serviceWorker
      .register(serviceWorkerUrl)
      .then((registration) => {
        if (cancelled) return;

        registrationRef.current = registration;
        trackPwaEvent("pwa_service_worker_registered", {
          scope: registration.scope,
        });

        if (registration.waiting) {
          waitingWorkerRef.current = registration.waiting;
          setServiceWorkerStatus("waiting");
          setIsUpdateAvailable(true);
          setUpdateStatus("available");
          trackPwaEvent("pwa_service_worker_waiting");
        } else if (registration.installing) {
          setServiceWorkerStatus("installing");
        } else {
          setServiceWorkerStatus("active");
        }

        registration.addEventListener("updatefound", () => {
          const installingWorker = registration.installing;
          if (!installingWorker) return;

          setServiceWorkerStatus("installing");
          installingWorker.addEventListener("statechange", () => {
            if (installingWorker.state !== "installed") return;

            if (navigator.serviceWorker.controller) {
              waitingWorkerRef.current = installingWorker;
              setServiceWorkerStatus("waiting");
              setIsUpdateAvailable(true);
              setUpdateStatus("available");
              trackPwaEvent("pwa_service_worker_waiting");
            } else {
              setServiceWorkerStatus("active");
            }
          });
        });

        updateRegistrationInBackground(registration);
        void refreshBuildInfo();
      })
      .catch((error: unknown) => {
        const message = errorMessageFromUnknown(error);
        window.localStorage.setItem(lastUpdateErrorKey, message);
        setLastUpdateError(message);
        setServiceWorkerStatus("error");
        trackPwaEvent("pwa_service_worker_error", { message });
        reportTechnicalDegradation("pwa-service-worker-register", error);
        void refreshBuildInfo();
      });

    navigator.serviceWorker.addEventListener(
      "controllerchange",
      controllerChangeHandler,
    );

    const visibilityHandler = () => {
      if (document.visibilityState === "visible") {
        updateRegistrationInBackground(registrationRef.current);
        void refreshBuildInfo();
      }
    };
    document.addEventListener("visibilitychange", visibilityHandler);
    const interval = window.setInterval(() => {
      updateRegistrationInBackground(registrationRef.current);
      void refreshBuildInfo();
    }, 30 * 60 * 1_000);

    return () => {
      cancelled = true;
      window.clearInterval(interval);
      document.removeEventListener("visibilitychange", visibilityHandler);
      navigator.serviceWorker.removeEventListener(
        "controllerchange",
        controllerChangeHandler,
      );
    };
  }, [refreshBuildInfo]);

  useEffect(() => {
    if (Platform.OS === "web") {
      setLastUpdateError(
        typeof window !== "undefined"
          ? window.localStorage.getItem(lastUpdateErrorKey)
          : null,
      );
    }
  }, []);

  return {
    applyUpdate,
    buildInfo,
    dismissUpdate,
    isUpdateAvailable,
    lastUpdateError,
    refreshBuildInfo,
    remoteBuildInfo,
    serviceWorkerStatus,
    updateStatus,
  };
}

function errorMessageFromUnknown(error: unknown) {
  if (error instanceof Error && error.message.trim()) return error.message;
  return "Action PWA indisponible.";
}

async function readOptionalPwaValue<T>(
  scope: string,
  operation: () => Promise<T>,
): Promise<T | null> {
  try {
    return await operation();
  } catch (error) {
    reportTechnicalDegradationOnce(scope, error);
    return null;
  }
}

function updateRegistrationInBackground(
  registration: ServiceWorkerRegistration | null,
) {
  if (!registration) return;

  void registration.update().catch((error: unknown) => {
    reportTechnicalDegradationOnce(
      "pwa-service-worker-background-update",
      error,
    );
  });
}
