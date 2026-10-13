import { useCallback, useEffect, useRef, useState } from "react";
import { Platform } from "react-native";

import {
  apiBaseUrl,
  isApiConfigured,
  supabasePublishableKey,
  supabaseUrl,
} from "@shared/config/clientConfig";
import { reportTechnicalDegradationOnce } from "@shared/observability/technicalDiagnostics";
import type { PwaApiStatus, PwaNetworkStatus } from "../types";
import {
  apiStatusForConnectivity,
  isExpectedApiHealthPayload,
} from "../services/apiHealthContract";
import { trackPwaEvent } from "../services/pwaAnalytics";

const connectionProbeTimeoutMs = 2_500;
const successfulProbeCacheDurationMs = 30_000;
const failedProbeCacheDurationMs = 60_000;
const activeConnectionProbes = new Map<string, Promise<boolean>>();
const recentConnectionProbeResults = new Map<
  string,
  { expiresAt: number; result: boolean }
>();

export function useConnectionHealth() {
  const [networkStatus, setNetworkStatus] = useState<PwaNetworkStatus>(() =>
    Platform.OS === "web" &&
    typeof navigator !== "undefined" &&
    !navigator.onLine
      ? "offline"
      : "connected",
  );
  const [apiStatus, setApiStatus] = useState<PwaApiStatus>(() =>
    apiStatusForConnectivity({
      configured: isApiConfigured,
      online:
        Platform.OS === "web" && typeof navigator !== "undefined"
          ? navigator.onLine
          : false,
    }),
  );
  const networkStatusRef = useRef<PwaNetworkStatus>(networkStatus);
  const apiStatusRef = useRef<PwaApiStatus>(apiStatus);

  const setTrackedNetworkStatus = useCallback(
    (nextStatus: PwaNetworkStatus) => {
      if (networkStatusRef.current !== nextStatus) {
        networkStatusRef.current = nextStatus;
        trackPwaEvent("pwa_connection_changed", {
          scope: "network",
          status: nextStatus,
        });
      }

      setNetworkStatus(nextStatus);
    },
    [],
  );

  const setTrackedApiStatus = useCallback((nextStatus: PwaApiStatus) => {
    if (apiStatusRef.current !== nextStatus) {
      apiStatusRef.current = nextStatus;
      trackPwaEvent("pwa_connection_changed", {
        scope: "api",
        status: nextStatus,
      });
    }

    setApiStatus(nextStatus);
  }, []);

  const refreshConnectionStatus = useCallback(async () => {
    if (Platform.OS !== "web" || typeof window === "undefined") {
      return {
        apiStatus: apiStatusForConnectivity({
          configured: isApiConfigured,
          online: false,
        }),
        networkStatus: "connected" as PwaNetworkStatus,
      };
    }

    if (!navigator.onLine) {
      setTrackedNetworkStatus("offline");
      setTrackedApiStatus("unavailable");
      return {
        apiStatus: "unavailable" as PwaApiStatus,
        networkStatus: "offline" as PwaNetworkStatus,
      };
    }

    const supabaseProbeUrl = getSupabaseConnectionProbeUrl();
    const apiProbeUrl = getApiConnectionProbeUrl();
    const [isDatabaseReachable, isApiReachable] = await Promise.all([
      supabaseProbeUrl
        ? probeConnection(
            "pwa-supabase-health-probe",
            () => probeSupabaseConnection(supabaseProbeUrl),
          )
        : Promise.resolve(true),
      apiProbeUrl
        ? probeConnection(
            "pwa-api-health-probe",
            () => probeApiConnection(apiProbeUrl),
          )
        : Promise.resolve(false),
    ]);
    const nextNetworkStatus: PwaNetworkStatus = isDatabaseReachable
      ? "connected"
      : "offline";
    const nextApiStatus: PwaApiStatus = !isApiConfigured
      ? "not-configured"
      : isApiReachable
        ? "available"
        : "unavailable";

    setTrackedNetworkStatus(nextNetworkStatus);
    setTrackedApiStatus(nextApiStatus);
    return {
      apiStatus: nextApiStatus,
      networkStatus: nextNetworkStatus,
    };
  }, [setTrackedApiStatus, setTrackedNetworkStatus]);

  useEffect(() => {
    if (Platform.OS !== "web" || typeof window === "undefined") {
      return undefined;
    }

    const syncBrowserConnection = () => {
      const isOnline = navigator.onLine;
      setTrackedNetworkStatus(isOnline ? "connected" : "offline");
      if (!isOnline || !isApiConfigured) {
        setTrackedApiStatus(
          apiStatusForConnectivity({
            configured: isApiConfigured,
            online: isOnline,
          }),
        );
      }
      if (isOnline) void refreshConnectionStatus();
    };

    syncBrowserConnection();
    window.addEventListener("online", syncBrowserConnection);
    window.addEventListener("offline", syncBrowserConnection);

    return () => {
      window.removeEventListener("online", syncBrowserConnection);
      window.removeEventListener("offline", syncBrowserConnection);
    };
  }, [refreshConnectionStatus, setTrackedApiStatus, setTrackedNetworkStatus]);

  return { apiStatus, networkStatus, refreshConnectionStatus };
}

function getSupabaseConnectionProbeUrl() {
  const normalizedSupabaseUrl = normalizeBaseUrl(supabaseUrl);
  return normalizedSupabaseUrl
    ? `${normalizedSupabaseUrl}/auth/v1/health`
    : null;
}

function getApiConnectionProbeUrl() {
  if (!isApiConfigured) return null;
  const normalizedApiBaseUrl = normalizeBaseUrl(apiBaseUrl);

  if (normalizedApiBaseUrl && !isLocalApiProbeDisabled(normalizedApiBaseUrl)) {
    return `${normalizedApiBaseUrl}/health`;
  }

  return null;
}

async function probeApiConnection(url: string) {
  const response = await probeHttpResponse(url);
  if (!response.ok) return false;
  const contentType = response.headers.get("content-type")?.toLowerCase() ?? "";
  if (!contentType.includes("application/json")) return false;
  return isExpectedApiHealthPayload(await response.json());
}

async function probeSupabaseConnection(url: string) {
  const headers: HeadersInit = {};

  if (supabasePublishableKey) {
    headers.apikey = supabasePublishableKey;
    headers.Authorization = `Bearer ${supabasePublishableKey}`;
  }

  const response = await probeHttpResponse(url, { headers });
  return response.ok || response.status === 401 || response.status === 403;
}

async function probeHttpResponse(url: string, init: RequestInit = {}) {
  const controller = new AbortController();
  const timeout = window.setTimeout(
    () => controller.abort(),
    connectionProbeTimeoutMs,
  );

  try {
    return await fetch(url, {
      ...init,
      cache: "no-store",
      signal: controller.signal,
    });
  } finally {
    window.clearTimeout(timeout);
  }
}

function normalizeBaseUrl(value: string) {
  const normalizedValue = value.trim().replace(/\/+$/, "");
  return normalizedValue || null;
}

function isLocalApiProbeDisabled(normalizedApiBaseUrl: string) {
  if (typeof window === "undefined") {
    return false;
  }

  try {
    const url = new URL(normalizedApiBaseUrl);
    return (
      isLocalHostname(window.location.hostname) && isLocalHostname(url.hostname)
    );
  } catch (error) {
    reportTechnicalDegradationOnce("pwa-api-health-url", error);
    return false;
  }
}

async function probeConnection(
  scope: string,
  operation: () => Promise<boolean>,
): Promise<boolean> {
  const cachedResult = recentConnectionProbeResults.get(scope);
  if (cachedResult && cachedResult.expiresAt > Date.now()) {
    return cachedResult.result;
  }

  const activeProbe = activeConnectionProbes.get(scope);
  if (activeProbe) return activeProbe;

  const probe = operation()
    .catch((error: unknown) => {
      reportTechnicalDegradationOnce(scope, error);
      return false;
    })
    .then((result) => {
      recentConnectionProbeResults.set(scope, {
        expiresAt:
          Date.now() +
          (result
            ? successfulProbeCacheDurationMs
            : failedProbeCacheDurationMs),
        result,
      });
      return result;
    })
    .finally(() => {
      activeConnectionProbes.delete(scope);
    });

  activeConnectionProbes.set(scope, probe);
  return probe;
}

function isLocalHostname(hostname: string) {
  return ["localhost", "127.0.0.1", "0.0.0.0"].includes(hostname);
}
