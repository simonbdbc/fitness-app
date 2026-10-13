type PublicEnvKey =
  | "EXPO_PUBLIC_PWA_ANALYTICS_ENDPOINT"
  | "EXPO_PUBLIC_API_BASE_URL"
  | "EXPO_PUBLIC_APP_ORIGIN"
  | "EXPO_PUBLIC_LANDING_ORIGIN"
  | "EXPO_PUBLIC_RELEASE_CHANNEL"
  | "EXPO_PUBLIC_SUPPORT_CONTACT"
  | "EXPO_PUBLIC_SUPABASE_URL"
  | "EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY";

type PublicRuntimeEnv = Partial<Record<PublicEnvKey, string>>;

declare const process: {
  env: Partial<Record<PublicEnvKey, string | undefined>>;
};

declare global {
  interface Window {
    __ACREA_FITNESS_ENV__?: PublicRuntimeEnv;
  }
}

const buildTimeEnv: PublicRuntimeEnv = {
  EXPO_PUBLIC_PWA_ANALYTICS_ENDPOINT:
    process.env.EXPO_PUBLIC_PWA_ANALYTICS_ENDPOINT,
  EXPO_PUBLIC_API_BASE_URL: process.env.EXPO_PUBLIC_API_BASE_URL,
  EXPO_PUBLIC_APP_ORIGIN: process.env.EXPO_PUBLIC_APP_ORIGIN,
  EXPO_PUBLIC_LANDING_ORIGIN: process.env.EXPO_PUBLIC_LANDING_ORIGIN,
  EXPO_PUBLIC_RELEASE_CHANNEL: process.env.EXPO_PUBLIC_RELEASE_CHANNEL,
  EXPO_PUBLIC_SUPPORT_CONTACT: process.env.EXPO_PUBLIC_SUPPORT_CONTACT,
  EXPO_PUBLIC_SUPABASE_URL: process.env.EXPO_PUBLIC_SUPABASE_URL,
  EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY:
    process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
};

function cleanEnvValue(value: string | undefined) {
  const cleaned = value?.trim();
  return cleaned ? cleaned : undefined;
}

export function readPublicEnv(key: PublicEnvKey) {
  if (typeof window !== "undefined") {
    const runtimeValue = cleanEnvValue(window.__ACREA_FITNESS_ENV__?.[key]);
    if (runtimeValue) {
      return runtimeValue;
    }
  }

  return cleanEnvValue(buildTimeEnv[key]) ?? "";
}
