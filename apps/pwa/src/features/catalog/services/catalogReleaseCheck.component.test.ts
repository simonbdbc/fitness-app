import { beforeEach, describe, expect, it, vi } from "vitest";

import type { LocalDatabase } from "@shared/db";

const lifecycleState = vi.hoisted(() => ({
  fingerprintStatus: "unchanged" as
    | "changed"
    | "unchanged"
    | "unavailable",
  fullSnapshotFetches: 0,
  releaseUpdateWrites: 0,
  syncDue: false,
  metadata: {
    catalog_last_attempt_at:
      "2026-07-28T10:00:00.000Z" as string | null,
    catalog_last_success_at:
      "2026-07-28T10:00:00.000Z" as string | null,
    catalog_last_error: null as string | null,
  },
}));

vi.mock("react-native", () => ({
  AppState: { currentState: "active" },
  Platform: { OS: "web", Version: 0 },
}));

vi.mock("@shared/db", () => {
  const database = {
    async execAsync() {},
    async getAllAsync(sql: string) {
      if (sql.includes("COUNT(*) AS exercise_count")) {
        return [{ exercise_count: 0 }];
      }
      if (sql.includes("FROM sync_metadata")) {
        return [{ ...lifecycleState.metadata }];
      }
      return [];
    },
    async getFirstAsync() {
      return null;
    },
    async runAsync(sql: string, parameters: unknown[] = []) {
      if (sql.includes("INSERT INTO catalog_release_updates")) {
        lifecycleState.releaseUpdateWrites += 1;
      }
      if (
        sql.includes("INSERT INTO sync_metadata") &&
        parameters.length === 3
      ) {
        lifecycleState.metadata = {
          catalog_last_attempt_at: parameters[0] as string | null,
          catalog_last_success_at: parameters[1] as string | null,
          catalog_last_error: parameters[2] as string | null,
        };
      }
      return {} as never;
    },
    async withTransactionAsync(operation: () => Promise<void>) {
      await operation();
    },
  } as unknown as LocalDatabase;

  return {
    withDatabase: async <TResult>(
      operation: (db: LocalDatabase) => Promise<TResult>,
    ) => operation(database),
  };
});

vi.mock("../data/exerciseLibrarySeed", () => ({
  exerciseLibraryExerciseCount: 0,
  exerciseLibraryExerciseSeeds: [],
  exerciseLibraryReleaseSeeds: [],
  exerciseLibraryRevision: "test",
  mergeExerciseLibraryIntoCatalogSeed: (seed: unknown) => seed,
}));

vi.mock("../domain/catalogSnapshot", () => ({
  catalogSeedFromSnapshot: (snapshot: unknown) => snapshot,
}));

vi.mock("./catalogSeed", () => ({
  getLocalCatalogSeed: () => ({
    exercises: [],
    releases: [{ code: "catalog-v4", status: "active" }],
  }),
}));

vi.mock("./catalogReleaseFingerprintLocal", () => ({
  readActiveCatalogReleaseFingerprint: async () => ({
    code: "catalog-v4",
    sourceRevision: "revision-1",
    activatedAt: "2026-07-28T10:00:00.000Z",
    updatedAt: "2026-07-28T10:00:00.000Z",
  }),
}));

vi.mock("./catalogSeedWriter", () => ({
  replaceCatalogCacheFromSeed: async () => undefined,
  resolvePendingProfileEquipment: async () => undefined,
  upsertExerciseLibraryExercisesFromSeed: async () => undefined,
  upsertCanonicalFormatsFromSeed: async () => undefined,
}));

vi.mock("./catalogSyncPolicy", () => ({
  catalogSyncErrorMessage: (error: unknown) =>
    error instanceof Error ? error.message : "sync failed",
  checkActiveCatalogReleaseFingerprint: async (local: {
    sourceRevision: string;
  }) => {
    if (lifecycleState.fingerprintStatus === "unavailable") {
      return { status: "unavailable", error: new Error("offline") };
    }
    const sourceRevision =
      lifecycleState.fingerprintStatus === "changed"
        ? "revision-2"
        : "revision-1";
    return {
      status:
        local.sourceRevision === sourceRevision ? "unchanged" : "changed",
      remote: {
        code: "catalog-v4",
        sourceRevision,
        activatedAt: "2026-07-28T10:00:00.000Z",
        updatedAt: "2026-07-28T10:00:00.000Z",
      },
    };
  },
  fetchRemoteCatalogAdminSnapshot: async () => {
    lifecycleState.fullSnapshotFetches += 1;
    const sourceRevision =
      lifecycleState.fingerprintStatus === "changed"
        ? "revision-2"
        : "revision-1";
    return {
      exercises: [],
      releases: [
        {
          code: "catalog-v4",
          status: "active",
          sourceRevision,
          activatedAt: "2026-07-28T10:00:00.000Z",
          updatedAt: "2026-07-28T10:00:00.000Z",
        },
      ],
    };
  },
  isCatalogSyncDue: () => lifecycleState.syncDue,
  shouldAttemptRemoteCatalogSync: () => true,
}));

import { checkCatalogReleaseUpdate } from "./catalogLifecycle";

describe("catalog release check when the Library opens", () => {
  beforeEach(() => {
    lifecycleState.fingerprintStatus = "unchanged";
    lifecycleState.fullSnapshotFetches = 0;
    lifecycleState.releaseUpdateWrites = 0;
    lifecycleState.syncDue = false;
    lifecycleState.metadata = {
      catalog_last_attempt_at: "2026-07-28T10:00:00.000Z",
      catalog_last_success_at: "2026-07-28T10:00:00.000Z",
      catalog_last_error: null,
    };
  });

  it("records a user-visible update when the active release changes", async () => {
    lifecycleState.fingerprintStatus = "changed";

    await checkCatalogReleaseUpdate();

    expect(lifecycleState.fullSnapshotFetches).toBe(0);
    expect(lifecycleState.releaseUpdateWrites).toBe(1);
  });

  it("does not download a fresh snapshot on every foreground", async () => {
    await checkCatalogReleaseUpdate();

    expect(lifecycleState.fullSnapshotFetches).toBe(0);
  });

  it("never revives the historical full snapshot TTL", async () => {
    lifecycleState.syncDue = true;

    await checkCatalogReleaseUpdate();

    expect(lifecycleState.fullSnapshotFetches).toBe(0);
  });

  it("keeps serving the local cache when the fingerprint probe is offline", async () => {
    lifecycleState.fingerprintStatus = "unavailable";

    await expect(checkCatalogReleaseUpdate()).resolves.toBeUndefined();
    expect(lifecycleState.fullSnapshotFetches).toBe(0);
  });
});
