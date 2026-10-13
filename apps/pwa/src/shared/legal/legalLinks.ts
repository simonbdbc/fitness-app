import { readPublicEnv } from "@shared/config/runtimeEnv";

const defaultLandingOrigin = "https://acrea-fitness.fr";

export function getLegalLinks() {
  const origin =
    readPublicEnv("EXPO_PUBLIC_LANDING_ORIGIN") || defaultLandingOrigin;

  return {
    cookies: new URL("/cookies/", origin).toString(),
    privacy: new URL("/politique-de-confidentialite/", origin).toString(),
    terms: new URL("/conditions-generales-utilisation/", origin).toString(),
  };
}
