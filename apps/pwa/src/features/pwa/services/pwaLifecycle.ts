export type InstallResolution =
  | "checking"
  | "available"
  | "installed"
  | "manual"
  | "unsupported"
  | "dismissed";

export function resolveInstallStatus({
  detectionComplete,
  displayMode,
  hasDismissal,
  hasPrompt,
  supportsManualInstall,
}: {
  detectionComplete: boolean;
  displayMode:
    "browser" | "standalone" | "fullscreen" | "minimal-ui" | "unknown";
  hasDismissal: boolean;
  hasPrompt: boolean;
  supportsManualInstall: boolean;
}): InstallResolution {
  if (displayMode !== "browser" && displayMode !== "unknown") {
    return "installed";
  }
  if (hasDismissal) return "dismissed";
  if (hasPrompt) return "available";
  if (!detectionComplete) return "checking";
  return supportsManualInstall ? "manual" : "unsupported";
}

export function hasRemoteBuildChanged(
  currentBuildId: string | null | undefined,
  remoteBuildId: string | null | undefined,
) {
  return Boolean(
    currentBuildId && remoteBuildId && currentBuildId !== remoteBuildId,
  );
}

export function shouldReloadAfterControllerChange(consentRequested: boolean) {
  return consentRequested;
}
