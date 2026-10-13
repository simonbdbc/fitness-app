import { Platform } from "react-native";

import type { PwaDisplayMode, PwaInstallStatus } from "../types";

const installDismissedAtKey = "acrea-fitness.pwa-install-dismissed-at";
const installDismissalTtlMs = 14 * 24 * 60 * 60 * 1_000;

export function readPwaDisplayMode(): PwaDisplayMode {
  if (Platform.OS !== "web" || typeof window === "undefined") {
    return "unknown";
  }

  const navigatorWithStandalone = navigator as Navigator & {
    standalone?: boolean;
  };

  if (
    window.matchMedia("(display-mode: standalone)").matches ||
    navigatorWithStandalone.standalone
  ) {
    return "standalone";
  }

  if (window.matchMedia("(display-mode: fullscreen)").matches) {
    return "fullscreen";
  }

  if (window.matchMedia("(display-mode: minimal-ui)").matches) {
    return "minimal-ui";
  }

  return "browser";
}

export function readInstallFallbackStatus(): PwaInstallStatus {
  if (Platform.OS !== "web" || typeof window === "undefined") {
    return "unsupported";
  }

  if (readPwaDisplayMode() !== "browser") {
    return "installed";
  }

  if (hasRecentInstallDismissal()) {
    return "dismissed";
  }

  return isIosLike() || supportsManualInstallation()
    ? "manual"
    : "unsupported";
}

export function hasRecentInstallDismissal() {
  if (typeof window === "undefined") {
    return false;
  }

  const dismissedAt = Number.parseInt(
    window.localStorage.getItem(installDismissedAtKey) ?? "",
    10,
  );

  return (
    Number.isFinite(dismissedAt) &&
    Date.now() - dismissedAt < installDismissalTtlMs
  );
}

export function writeInstallDismissal() {
  if (typeof window !== "undefined") {
    window.localStorage.setItem(installDismissedAtKey, `${Date.now()}`);
  }
}

export function clearInstallDismissal() {
  if (typeof window !== "undefined") {
    window.localStorage.removeItem(installDismissedAtKey);
  }
}

export function supportsManualInstallation() {
  if (typeof window === "undefined" || typeof navigator === "undefined") {
    return false;
  }

  return (
    "serviceWorker" in navigator &&
    Boolean(document.querySelector('link[rel="manifest"]'))
  );
}

export function isIosLike() {
  if (typeof navigator === "undefined") {
    return false;
  }

  const userAgent = navigator.userAgent.toLowerCase();
  const platform = navigator.platform.toLowerCase();
  return (
    /iphone|ipad|ipod/.test(userAgent) ||
    (platform === "macintel" && navigator.maxTouchPoints > 1)
  );
}
