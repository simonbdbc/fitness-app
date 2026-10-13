import { getSupabaseClient } from "@shared/config/supabaseClient";

import type { CatalogReleaseFingerprint } from "./catalogSyncPolicy";

type RemoteCatalogReleaseFingerprintRow = {
  code: string;
  source_revision: string;
  activated_at: string | null;
  updated_at: string;
};

export async function fetchActiveCatalogReleaseFingerprint(): Promise<
  CatalogReleaseFingerprint | null
> {
  const { data, error } = await getSupabaseClient()
    .from("catalog_releases")
    .select("code, source_revision, activated_at, updated_at")
    .eq("status", "active")
    .order("id", { ascending: false })
    .limit(1);

  if (error) throw error;

  const row = (data?.[0] ?? null) as RemoteCatalogReleaseFingerprintRow | null;
  if (!row) return null;

  return {
    code: row.code,
    sourceRevision: row.source_revision,
    activatedAt: row.activated_at,
    updatedAt: row.updated_at,
  };
}
