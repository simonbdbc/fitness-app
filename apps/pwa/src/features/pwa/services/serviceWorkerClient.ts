import { Platform } from "react-native";

import type { PwaBuildInfo, PwaServiceWorkerStatus } from "../types";

type ServiceWorkerMessage = {
  type: string;
  buildInfo?: PwaBuildInfo;
  caches?: string[];
};

export const pwaCachePrefix = "acrea-fitness";
export const lastUpdateErrorKey = "acrea-fitness-public-demo.pwa-last-update-error";
export const serviceWorkerUrl = "/service-worker.js";
export const fallbackBuildInfo: PwaBuildInfo = {
  appName: "ACREA Fitness",
  appVersion: "0.1.0",
  buildId: "native",
  commitSha: "native",
  releaseChannel: "native",
  buildDate: "native",
  origin: "native",
  supportContact: "Démonstration locale",
};

const developmentServiceWorkerResetKey =
  "acrea-fitness-public-demo.pwa-development-service-worker-reset";
const buildInfoUrl = "/pwa-build.json";

export async function fetchBuildInfo() {
  const response = await fetch(`${buildInfoUrl}?t=${Date.now()}`, {
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error("Version distante indisponible.");
  }

  return (await response.json()) as PwaBuildInfo;
}

export async function requestActiveWorkerBuildInfo() {
  const response = await postServiceWorkerMessage({ type: "GET_VERSION" });
  return response?.buildInfo ?? null;
}

export async function requestServiceWorkerDiagnostics() {
  return postServiceWorkerMessage({ type: "GET_DIAGNOSTICS" });
}

export function requestWorkerSkipWaiting(worker: ServiceWorker) {
  if (typeof MessageChannel === "undefined") {
    worker.postMessage({ type: "SKIP_WAITING" });
    return Promise.resolve(false);
  }

  return new Promise<boolean>((resolve) => {
    const channel = new MessageChannel();
    const timer = window.setTimeout(() => resolve(false), 1_000);

    channel.port1.onmessage = (event: MessageEvent<ServiceWorkerMessage>) => {
      window.clearTimeout(timer);
      resolve(event.data?.type === "SKIP_WAITING_ACK");
    };

    worker.postMessage({ type: "SKIP_WAITING" }, [channel.port2]);
  });
}

export async function waitForWaitingWorker(
  registration: ServiceWorkerRegistration,
  timeoutMs = 5_000,
) {
  const deadline = Date.now() + timeoutMs;

  while (Date.now() < deadline) {
    if (registration.waiting) {
      return registration.waiting;
    }
    await new Promise((resolve) => window.setTimeout(resolve, 100));
  }

  return registration.waiting;
}

export function getInitialServiceWorkerStatus(): PwaServiceWorkerStatus {
  return isServiceWorkerDisabledForRuntime() ? "disabled" : "registering";
}

export function isServiceWorkerDisabledForRuntime() {
  return __DEV__;
}

export async function unregisterDevelopmentServiceWorkers() {
  if (
    Platform.OS !== "web" ||
    typeof window === "undefined" ||
    !("serviceWorker" in navigator)
  ) {
    return;
  }

  const hadController = Boolean(navigator.serviceWorker.controller);
  const registrations = await navigator.serviceWorker.getRegistrations();
  await Promise.all(
    registrations
      .filter((registration) =>
        registration.scope.startsWith(window.location.origin),
      )
      .map((registration) => registration.unregister()),
  );

  if ("caches" in window) {
    const cacheNames = await caches.keys();
    await Promise.all(
      cacheNames
        .filter((cacheName) => cacheName.startsWith(`${pwaCachePrefix}-`))
        .map((cacheName) => caches.delete(cacheName)),
    );
  }

  if (!hadController) {
    window.sessionStorage.removeItem(developmentServiceWorkerResetKey);
    return;
  }

  if (window.sessionStorage.getItem(developmentServiceWorkerResetKey)) {
    return;
  }

  window.sessionStorage.setItem(developmentServiceWorkerResetKey, "1");
  window.location.reload();
}

function postServiceWorkerMessage(message: { type: string }) {
  if (
    Platform.OS !== "web" ||
    typeof window === "undefined" ||
    !navigator.serviceWorker?.controller ||
    typeof MessageChannel === "undefined"
  ) {
    return Promise.resolve<ServiceWorkerMessage | null>(null);
  }

  return new Promise<ServiceWorkerMessage | null>((resolve) => {
    const channel = new MessageChannel();
    const timer = window.setTimeout(() => resolve(null), 1_200);

    channel.port1.onmessage = (event: MessageEvent<ServiceWorkerMessage>) => {
      window.clearTimeout(timer);
      resolve(event.data);
    };

    navigator.serviceWorker.controller?.postMessage(message, [channel.port2]);
  });
}
