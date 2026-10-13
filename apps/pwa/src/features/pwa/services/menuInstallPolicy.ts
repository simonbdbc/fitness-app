import type { PwaDisplayMode, PwaInstallStatus } from "../types";

export function shouldShowMenuInstallButton({
  displayMode,
  installStatus,
}: {
  displayMode: PwaDisplayMode;
  installStatus: PwaInstallStatus;
}) {
  return (
    displayMode === "browser" &&
    installStatus !== "installed" &&
    installStatus !== "dismissed"
  );
}
