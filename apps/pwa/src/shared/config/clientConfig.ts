import { readPublicEnv } from "./runtimeEnv";

const localHostnames = new Set(["localhost", "127.0.0.1", "0.0.0.0"]);

export const apiBaseUrl = getApiBaseUrl();

export const isApiConfigured = Boolean(apiBaseUrl);

export const supabaseUrl = readPublicEnv("EXPO_PUBLIC_SUPABASE_URL");

export const supabasePublishableKey = readPublicEnv(
  "EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY",
);

export const isSupabaseConfigured = Boolean(
  supabaseUrl && supabasePublishableKey,
);

export const isLocalRuntime = getIsLocalRuntime();

function getApiBaseUrl() {
  const configuredApiBaseUrl = readPublicEnv("EXPO_PUBLIC_API_BASE_URL");

  if (configuredApiBaseUrl && !isLocalUrlOnRemoteHost(configuredApiBaseUrl)) {
    return configuredApiBaseUrl;
  }

  return "";
}

function getIsLocalRuntime() {
  if (typeof __DEV__ !== "undefined" && __DEV__) {
    return true;
  }

  if (typeof window !== "undefined") {
    return localHostnames.has(window.location.hostname);
  }

  return false;
}

function isLocalUrlOnRemoteHost(value: string) {
  if (
    typeof window === "undefined" ||
    localHostnames.has(window.location.hostname)
  ) {
    return false;
  }

  try {
    return localHostnames.has(new URL(value).hostname);
  } catch {
    return false;
  }
}
