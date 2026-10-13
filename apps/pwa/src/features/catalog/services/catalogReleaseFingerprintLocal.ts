import type { LocalDatabase } from "@shared/db";

import type { CatalogReleaseFingerprint } from "./catalogSyncPolicy";

export async function readActiveCatalogReleaseFingerprint(
  db: LocalDatabase,
): Promise<CatalogReleaseFingerprint | null> {
  const row = await db.getFirstAsync<{
    code: string;
    source_revision: string;
    activated_at: string | null;
    updated_at: string;
  }>(
    `SELECT code, source_revision, activated_at, updated_at
     FROM catalog_releases
     WHERE status = 'active'
     ORDER BY id DESC
     LIMIT 1`,
  );

  if (!row) return null;

  return {
    code: row.code,
    sourceRevision: row.source_revision,
    activatedAt: row.activated_at,
    updatedAt: row.updated_at,
  };
}
