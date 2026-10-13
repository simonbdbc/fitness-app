export type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{
    outcome: "accepted" | "dismissed";
    platform: string;
  }>;
};

export const capturedInstallPromptKey = "__ACREA_PWA_INSTALL_PROMPT__";
export const capturedInstallPromptEventName = "acrea:pwa-install-prompt";

declare global {
  interface Window {
    __ACREA_PWA_INSTALL_PROMPT__?: BeforeInstallPromptEvent | null;
  }
}

export function readCapturedInstallPrompt() {
  if (typeof window === "undefined") return null;
  return window[capturedInstallPromptKey] ?? null;
}

export function rememberCapturedInstallPrompt(
  event: BeforeInstallPromptEvent,
) {
  if (typeof window !== "undefined") {
    window[capturedInstallPromptKey] = event;
  }
}

export function clearCapturedInstallPrompt(
  expectedEvent?: BeforeInstallPromptEvent,
) {
  if (typeof window === "undefined") return;
  if (
    expectedEvent &&
    window[capturedInstallPromptKey] !== expectedEvent
  ) {
    return;
  }
  window[capturedInstallPromptKey] = null;
}
