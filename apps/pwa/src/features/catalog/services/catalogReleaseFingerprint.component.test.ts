import { describe, expect, it, vi } from "vitest";

import type { LocalDatabase } from "@shared/db";

import { readActiveCatalogReleaseFingerprint } from "./catalogReleaseFingerprintLocal";
import {
  checkActiveCatalogReleaseFingerprint,
  hasActiveCatalogReleaseChanged,
  isCatalogSyncDue,
  type CatalogReleaseFingerprint,
} from "./catalogSyncPolicy";

const currentFingerprint: CatalogReleaseFingerprint = {
  code: "catalog-v4",
  sourceRevision: "revision-1",
  activatedAt: "2026-07-28T10:00:00.000Z",
  updatedAt: "2026-07-28T10:00:00.000Z",
};

describe("catalog release fingerprint", () => {
  it("reads only the active release revision from the local cache", async () => {
    const getFirstAsync = vi.fn().mockResolvedValue({
      code: currentFingerprint.code,
      source_revision: currentFingerprint.sourceRevision,
      activated_at: currentFingerprint.activatedAt,
      updated_at: currentFingerprint.updatedAt,
    });

    await expect(
      readActiveCatalogReleaseFingerprint({
        getFirstAsync,
      } as unknown as LocalDatabase),
    ).resolves.toEqual(currentFingerprint);
    expect(getFirstAsync).toHaveBeenCalledOnce();
    expect(getFirstAsync.mock.calls[0]?.[0]).toContain(
      "WHERE status = 'active'",
    );
  });

  it("forces a refresh as soon as the active release revision changes", async () => {
    const nextFingerprint = {
      ...currentFingerprint,
      sourceRevision: "revision-2",
      updatedAt: "2026-07-28T11:00:00.000Z",
    };

    expect(
      hasActiveCatalogReleaseChanged(
        currentFingerprint,
        currentFingerprint,
      ),
    ).toBe(false);
    await expect(
      checkActiveCatalogReleaseFingerprint(
        currentFingerprint,
        async () => nextFingerprint,
      ),
    ).resolves.toEqual({
      status: "changed",
      remote: nextFingerprint,
    });
  });

  it("keeps the cache usable offline and preserves the TTL fallback", async () => {
    const networkError = new Error("Network request failed");

    await expect(
      checkActiveCatalogReleaseFingerprint(currentFingerprint, async () => {
        throw networkError;
      }),
    ).resolves.toEqual({
      status: "unavailable",
      error: networkError,
    });

    const lastSyncAt = "2026-07-28T10:00:00.000Z";
    expect(
      isCatalogSyncDue(lastSyncAt, Date.parse("2026-07-29T09:59:59.000Z")),
    ).toBe(false);
    expect(
      isCatalogSyncDue(lastSyncAt, Date.parse("2026-07-29T10:00:01.000Z")),
    ).toBe(true);
  });
});
