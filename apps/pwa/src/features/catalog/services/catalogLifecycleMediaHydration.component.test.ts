import { beforeEach, describe, expect, it, vi } from "vitest";

import type { LocalDatabase } from "@shared/db";

type CatalogMediaRow = {
  code: string;
  detail_cache_state: string | null;
  media_file_name: string | null;
  media_kind: string | null;
  media_sha256: string | null;
  media_status: string | null;
  media_uri: string | null;
  release_revision: string;
  slug: string;
};

const progressiveState = vi.hoisted(() => ({
  cacheMedia: vi.fn(async () => undefined),
  downloadSlugs: [] as string[],
  fetchDetails: vi.fn(),
  hasCachedMedia: vi.fn(async () => false),
  hydratedSlugs: new Set<string>(),
}));

vi.mock("react-native", () => ({
  AppState: { currentState: "active" },
}));

vi.mock("@shared/db", () => {
  const database = {
    async execAsync() {},
    async getAllAsync(sql: string, values?: unknown[]) {
      if (sql.includes("COUNT(*) AS exercise_count")) {
        return [{ exercise_count: 1 }];
      }
      if (sql.includes("media.kind AS media_kind")) {
        const slugs = (values ?? []).filter(
          (value): value is string => typeof value === "string",
        );
        return slugs.flatMap<CatalogMediaRow>((slug): CatalogMediaRow[] => {
          if (!progressiveState.hydratedSlugs.has(slug)) {
            return [
              {
                code: slug,
                detail_cache_state: null,
                media_file_name: null,
                media_kind: null,
                media_sha256: null,
                media_status: null,
                media_uri: null,
                release_revision: "catalog-v4",
                slug,
              },
            ];
          }
          return ["poster", "animation"].map((kind) => ({
            code: slug,
            detail_cache_state: "available",
            media_file_name: `${slug}-${kind}.webp`,
            media_kind: kind,
            media_sha256: `${kind}-digest`,
            media_status: "ready",
            media_uri: `/library/${slug}-${kind}.webp`,
            release_revision: "catalog-v4",
            slug,
          }));
        });
      }
      if (sql.includes("SELECT exercise.slug")) {
        return progressiveState.downloadSlugs.map((slug) => ({ slug }));
      }
      return [];
    },
    async getFirstAsync() {
      return { exists_flag: 1 };
    },
    async runAsync() {
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
  exerciseLibraryRevision: "test",
}));

vi.mock("../domain/catalogSnapshot", () => ({
  catalogSeedFromSnapshot: (snapshot: unknown) => snapshot,
}));

vi.mock("./catalogSeed", () => ({
  getLocalCatalogSeed: () => ({ exercises: [] }),
}));

vi.mock("./catalogReleaseFingerprintLocal", () => ({
  readActiveCatalogReleaseFingerprint: async () => null,
}));

vi.mock("./catalogSeedWriter", () => ({
  replaceCatalogCacheFromSeed: async (
    _database: LocalDatabase,
    seed: { exercises?: readonly { slug: string }[] },
  ) => {
    for (const exercise of seed.exercises ?? []) {
      progressiveState.hydratedSlugs.add(exercise.slug);
    }
  },
  resolvePendingProfileEquipment: async () => undefined,
}));

vi.mock("./catalogSyncPolicy", () => ({
  shouldAttemptRemoteCatalogSync: () => true,
}));

vi.mock("./catalogMediaCache", () => ({
  cacheCatalogMedia: progressiveState.cacheMedia,
  hasCachedCatalogMedia: progressiveState.hasCachedMedia,
}));

vi.mock("./catalogProgressiveRemote", () => ({
  fetchActiveCatalogDetails: progressiveState.fetchDetails,
}));

import {
  downloadCompleteCatalogLibrary,
  ensureCatalogExerciseDetails,
} from "./catalogLifecycle";

const remoteDetails = {
  exercises: [
    {
      code: "heel-to-toe-walk",
      media: [
        {
          fileName: "heel-to-toe-walk-poster.webp",
          kind: "poster",
          sha256: "poster-digest",
          uri: "/library/heel-to-toe-walk-poster.webp",
        },
        {
          fileName: "heel-to-toe-walk-animation.webp",
          kind: "animation",
          sha256: "animation-digest",
          uri: "/library/heel-to-toe-walk-animation.webp",
        },
      ],
      slug: "heel-to-toe-walk",
    },
  ],
  releases: [
    {
      code: "catalog-v4",
      sourceRevision: "catalog-v4",
      status: "active",
    },
  ],
};

describe("progressive catalog detail hydration", () => {
  beforeEach(() => {
    progressiveState.cacheMedia.mockClear();
    progressiveState.downloadSlugs = [];
    progressiveState.hasCachedMedia.mockClear();
    progressiveState.hasCachedMedia.mockResolvedValue(false);
    progressiveState.fetchDetails.mockClear();
    progressiveState.fetchDetails.mockResolvedValue(remoteDetails);
    progressiveState.hydratedSlugs.clear();
    progressiveState.hydratedSlugs.add("heel-to-toe-walk");
  });

  it("re-hydrates a legacy detail marked available when its WebP bytes are absent", async () => {
    await ensureCatalogExerciseDetails(["heel-to-toe-walk"]);

    expect(progressiveState.hasCachedMedia).toHaveBeenCalledWith(
      {
        fileName: "heel-to-toe-walk-poster.webp",
        kind: "poster",
        sha256: "poster-digest",
        uri: "/library/heel-to-toe-walk-poster.webp",
      },
      "catalog-v4",
    );
    expect(progressiveState.fetchDetails).toHaveBeenCalledWith([
      "heel-to-toe-walk",
    ]);
    expect(progressiveState.cacheMedia).toHaveBeenCalledWith(
      remoteDetails.exercises[0].media[0],
      "catalog-v4",
    );
  });

  it("hydrates animation only when a detail explicitly requires all media", async () => {
    progressiveState.hydratedSlugs.clear();

    await ensureCatalogExerciseDetails(["heel-to-toe-walk"], { media: "all" });

    expect(progressiveState.cacheMedia).toHaveBeenCalledTimes(2);
    expect(progressiveState.cacheMedia).toHaveBeenLastCalledWith(
      remoteDetails.exercises[0].media[1],
      "catalog-v4",
    );
  });

  it("hydrates only the animation after an explicit poster click", async () => {
    progressiveState.hydratedSlugs.clear();

    await ensureCatalogExerciseDetails(["heel-to-toe-walk"], {
      media: "animation",
    });

    expect(progressiveState.cacheMedia).toHaveBeenCalledTimes(1);
    expect(progressiveState.cacheMedia).toHaveBeenCalledWith(
      remoteDetails.exercises[0].media[1],
      "catalog-v4",
    );
  });

  it("downloads the full library in bounded batches and reports media progress", async () => {
    progressiveState.downloadSlugs = Array.from(
      { length: 26 },
      (_, index) => `exercise-${index + 1}`,
    );
    progressiveState.fetchDetails.mockImplementation(async (slugs: string[]) =>
      detailSeed(slugs),
    );
    const progress: Array<{ completed: number; total: number }> = [];

    await downloadCompleteCatalogLibrary({
      onProgress: ({ completed, total }) => progress.push({ completed, total }),
    });

    expect(progressiveState.fetchDetails).toHaveBeenNthCalledWith(
      1,
      progressiveState.downloadSlugs.slice(0, 25),
    );
    expect(progressiveState.fetchDetails).toHaveBeenNthCalledWith(
      2,
      progressiveState.downloadSlugs.slice(25),
    );
    expect(progressiveState.cacheMedia).toHaveBeenCalledTimes(52);
    expect(progress).toEqual([
      { completed: 0, total: 26 },
      { completed: 25, total: 26 },
      { completed: 26, total: 26 },
    ]);
  });

  it("cancels after a completed batch and resumes only the remaining details", async () => {
    progressiveState.downloadSlugs = Array.from(
      { length: 26 },
      (_, index) => `exercise-${index + 1}`,
    );
    progressiveState.fetchDetails.mockImplementation(async (slugs: string[]) =>
      detailSeed(slugs),
    );
    progressiveState.hasCachedMedia.mockResolvedValue(true);
    const controller = new AbortController();

    await expect(
      downloadCompleteCatalogLibrary({
        onProgress: ({ completed }) => {
          if (completed === 25) controller.abort();
        },
        signal: controller.signal,
      }),
    ).rejects.toMatchObject({ name: "AbortError" });
    expect(progressiveState.fetchDetails).toHaveBeenCalledTimes(1);

    progressiveState.fetchDetails.mockClear();
    await downloadCompleteCatalogLibrary();

    expect(progressiveState.fetchDetails).toHaveBeenCalledWith([
      "exercise-26",
    ]);
  });
});

function detailSeed(slugs: readonly string[]) {
  return {
    exercises: slugs.map((slug) => ({
      code: slug,
      media: ["poster", "animation"].map((kind) => ({
        fileName: `${slug}-${kind}.webp`,
        kind,
        sha256: `${kind}-digest`,
        uri: `/library/${slug}-${kind}.webp`,
      })),
      slug,
    })),
    releases: remoteDetails.releases,
  };
}
