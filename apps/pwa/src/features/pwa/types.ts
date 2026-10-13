export type PwaInstallStatus =
  | "checking"
  | "available"
  | "installed"
  | "manual"
  | "unsupported"
  | "dismissed"
  | "error";

export type PwaDisplayMode =
  | "browser"
  | "standalone"
  | "fullscreen"
  | "minimal-ui"
  | "unknown";

export type PwaNetworkStatus = "connected" | "offline";

export type PwaApiStatus =
  | "checking"
  | "not-configured"
  | "available"
  | "unavailable";

export type PwaConnectionStatus = PwaNetworkStatus;

export type PwaServiceWorkerStatus =
  | "disabled"
  | "unsupported"
  | "registering"
  | "installing"
  | "active"
  | "waiting"
  | "error";

export type PwaUpdateStatus =
  | "idle"
  | "available"
  | "updating"
  | "applied"
  | "reloadRequired"
  | "error"
  | "forced";

export type PwaMenuTarget = "settings" | "install" | "uninstall";

export type PwaBuildInfo = {
  appName: string;
  appVersion: string;
  buildId: string;
  commitSha: string;
  releaseChannel: string;
  buildDate: string;
  origin: string;
  supportContact: string;
};

export type PwaDiagnostics = {
  manifestDetected: boolean;
  displayMode: PwaDisplayMode;
  serviceWorkerSupported: boolean;
  serviceWorkerStatus: PwaServiceWorkerStatus;
  serviceWorkerActive: boolean;
  caches: string[];
  storageUsageBytes: number | null;
  storageQuotaBytes: number | null;
  currentBuildInfo: PwaBuildInfo | null;
  remoteBuildInfo: PwaBuildInfo | null;
  lastUpdateError: string | null;
  online: boolean;
  networkStatus: PwaNetworkStatus;
  apiStatus: PwaApiStatus;
};
