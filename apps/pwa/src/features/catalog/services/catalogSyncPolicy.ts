import { isSupabaseConfigured } from "@shared/config/clientConfig";

const catalogSyncIntervalMs = 24 * 60 * 60 * 1000;

export type CatalogReleaseFingerprint = {
  code: string;
  sourceRevision: string;
  activatedAt: string | null;
  updatedAt: string;
};

export type CatalogReleaseFingerprintCheck =
  | {
      status: "changed" | "unchanged";
      remote: CatalogReleaseFingerprint | null;
    }
  | {
      status: "unavailable";
      error: unknown;
    };

export function isCatalogSyncDue(
  timestamp: string | null,
  nowMs = Date.now(),
) {
  if (!timestamp) return true;
  return nowMs - new Date(timestamp).getTime() > catalogSyncIntervalMs;
}

export function shouldAttemptRemoteCatalogSync() {
  return isSupabaseConfigured;
}

export async function fetchRemoteCatalogAdminSnapshot() {
  const { fetchCatalogAdminSnapshot } = await import("./catalogRemote");
  return fetchCatalogAdminSnapshot();
}

export async function fetchRemoteActiveCatalogReleaseFingerprint() {
  const { fetchActiveCatalogReleaseFingerprint } =
    await import("./catalogReleaseFingerprintRemote");
  return fetchActiveCatalogReleaseFingerprint();
}

export function hasActiveCatalogReleaseChanged(
  local: CatalogReleaseFingerprint | null,
  remote: CatalogReleaseFingerprint | null,
) {
  if (!local || !remote) return local !== remote;

  return (
    local.code !== remote.code ||
    local.sourceRevision !== remote.sourceRevision ||
    local.activatedAt !== remote.activatedAt ||
    local.updatedAt !== remote.updatedAt
  );
}

export async function checkActiveCatalogReleaseFingerprint(
  local: CatalogReleaseFingerprint | null,
  fetchRemote: () => Promise<CatalogReleaseFingerprint | null> =
    fetchRemoteActiveCatalogReleaseFingerprint,
): Promise<CatalogReleaseFingerprintCheck> {
  try {
    const remote = await fetchRemote();
    return {
      status: hasActiveCatalogReleaseChanged(local, remote)
        ? "changed"
        : "unchanged",
      remote,
    };
  } catch (error) {
    return { status: "unavailable", error };
  }
}

export function catalogSyncErrorMessage(error: unknown) {
  if (error instanceof Error && error.message.trim()) return error.message;
  return "Synchronisation catalogue impossible.";
}
