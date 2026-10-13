import { Platform } from "react-native";

import { readPublicEnv } from "@shared/config/runtimeEnv";
import { reportTechnicalDegradationOnce } from "@shared/observability/technicalDiagnostics";

type PwaEventName =
  | "pwa_app_background"
  | "pwa_app_foreground"
  | "pwa_app_start"
  | "pwa_cache_clear_completed"
  | "pwa_cache_clear_failed"
  | "pwa_cache_clear_started"
  | "pwa_connection_changed"
  | "pwa_controller_changed"
  | "pwa_diagnostics_refreshed"
  | "pwa_display_mode_changed"
  | "pwa_install_dismissed"
  | "pwa_install_element_action"
  | "pwa_install_element_dismissed"
  | "pwa_install_element_validation_error"
  | "pwa_install_prompt_accepted"
  | "pwa_install_prompt_available"
  | "pwa_install_prompt_error"
  | "pwa_install_prompt_started"
  | "pwa_install_reset"
  | "pwa_installed"
  | "pwa_service_worker_error"
  | "pwa_service_worker_registered"
  | "pwa_service_worker_waiting"
  | "pwa_update_available"
  | "pwa_update_apply_failed"
  | "pwa_update_apply_started"
  | "pwa_update_dismissed";

type PwaEventPayload = Record<
  string,
  boolean | number | string | null | undefined
>;

const analyticsEndpointEnvKey = "EXPO_PUBLIC_PWA_ANALYTICS_ENDPOINT";

export function trackPwaEvent(
  name: PwaEventName,
  payload: PwaEventPayload = {},
) {
  if (Platform.OS !== "web" || typeof window === "undefined") {
    return;
  }

  const event = {
    name,
    payload: sanitizePayload(payload),
    timestamp: new Date().toISOString(),
  };
  const analyticsEndpoint = readPublicEnv(analyticsEndpointEnvKey);

  if (__DEV__) {
    console.info("[pwa]", event);
  }

  if (!analyticsEndpoint) {
    return;
  }

  sendPwaEvent(analyticsEndpoint, event);
}

function sanitizePayload(payload: PwaEventPayload) {
  return Object.fromEntries(
    Object.entries(payload).filter(([, value]) => value !== undefined),
  );
}

function sendPwaEvent(
  analyticsEndpoint: string,
  event: {
    name: PwaEventName;
    payload: PwaEventPayload;
    timestamp: string;
  },
) {
  try {
    const body = JSON.stringify(event);

    if (navigator.sendBeacon) {
      navigator.sendBeacon(
        analyticsEndpoint,
        new Blob([body], { type: "application/json" }),
      );
      return;
    }

    void fetch(analyticsEndpoint, {
      body,
      headers: { "Content-Type": "application/json" },
      keepalive: true,
      method: "POST",
    }).catch((error: unknown) => {
      reportTechnicalDegradationOnce("pwa-analytics-delivery", error);
    });
  } catch (error) {
    reportTechnicalDegradationOnce("pwa-analytics-serialization", error);
  }
}
