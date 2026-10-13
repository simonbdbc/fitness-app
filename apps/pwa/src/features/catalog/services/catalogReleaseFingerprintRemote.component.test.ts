import { beforeEach, describe, expect, it, vi } from "vitest";

const remoteQuery = vi.hoisted(() => ({
  calls: [] as unknown[][],
  data: [] as unknown[],
  error: null as unknown,
}));

vi.mock("@shared/config/supabaseClient", () => ({
  getSupabaseClient: () => ({
    from: (table: string) => {
      remoteQuery.calls.push(["from", table]);
      const builder = {
        select(columns: string) {
          remoteQuery.calls.push(["select", columns]);
          return builder;
        },
        eq(column: string, value: string) {
          remoteQuery.calls.push(["eq", column, value]);
          return builder;
        },
        order(column: string, options: unknown) {
          remoteQuery.calls.push(["order", column, options]);
          return builder;
        },
        async limit(value: number) {
          remoteQuery.calls.push(["limit", value]);
          return {
            data: remoteQuery.data,
            error: remoteQuery.error,
          };
        },
      };
      return builder;
    },
  }),
}));

import { fetchActiveCatalogReleaseFingerprint } from "./catalogReleaseFingerprintRemote";

describe("remote catalog release fingerprint", () => {
  beforeEach(() => {
    remoteQuery.calls = [];
    remoteQuery.data = [];
    remoteQuery.error = null;
  });

  it("fetches one active release with four revision fields only", async () => {
    remoteQuery.data = [
      {
        code: "catalog-v4",
        source_revision: "revision-2",
        activated_at: "2026-07-28T11:00:00.000Z",
        updated_at: "2026-07-28T11:00:00.000Z",
      },
    ];

    await expect(fetchActiveCatalogReleaseFingerprint()).resolves.toEqual({
      code: "catalog-v4",
      sourceRevision: "revision-2",
      activatedAt: "2026-07-28T11:00:00.000Z",
      updatedAt: "2026-07-28T11:00:00.000Z",
    });
    expect(remoteQuery.calls).toEqual([
      ["from", "catalog_releases"],
      ["select", "code, source_revision, activated_at, updated_at"],
      ["eq", "status", "active"],
      ["order", "id", { ascending: false }],
      ["limit", 1],
    ]);
  });

  it("propagates the lightweight query error without inventing a release", async () => {
    const networkError = new Error("offline");
    remoteQuery.error = networkError;

    await expect(fetchActiveCatalogReleaseFingerprint()).rejects.toBe(
      networkError,
    );
  });
});
