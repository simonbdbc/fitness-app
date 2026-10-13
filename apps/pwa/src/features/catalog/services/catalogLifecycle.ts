import { withDatabase, type LocalDatabase } from "@shared/db";
import {
  exerciseLibraryRevision,
} from "../data/exerciseLibrarySeed";
import { acreaLevelEvaluationV4Mappings } from "../../programming/data/acreaLevelEvaluationV4";
import {
  catalogSeedFromSnapshot,
  type CatalogSnapshotForCache,
} from "../domain/catalogSnapshot";
import type {
  CatalogExerciseMediaKind,
  CatalogSeed,
} from "../types";
import { getLocalCatalogSeed } from "./catalogSeed";
import { readActiveCatalogReleaseFingerprint } from "./catalogReleaseFingerprintLocal";
import {
  replaceCatalogCacheFromSeed,
  resolvePendingProfileEquipment,
} from "./catalogSeedWriter";
import {
  catalogSyncErrorMessage,
  checkActiveCatalogReleaseFingerprint,
  fetchRemoteCatalogAdminSnapshot,
  shouldAttemptRemoteCatalogSync,
  type CatalogReleaseFingerprint,
} from "./catalogSyncPolicy";

type CatalogSyncMetadataRow = {
  catalog_last_attempt_at: string | null;
  catalog_last_success_at: string | null;
  catalog_last_error: string | null;
};

const exerciseLibraryStorageVersion = 2;
const exerciseLibraryMetadataKey =
  `exercise-library:v${exerciseLibraryStorageVersion}:` +
  exerciseLibraryRevision;
let catalogReadyPromise: Promise<void> | null = null;
let catalogReleaseCheckPromise: Promise<void> | null = null;
const catalogDetailBatchSize = 25;

export type CatalogLibraryDownloadProgress = {
  completed: number;
  total: number;
  currentSlug: string | null;
};

export type PendingCatalogReleaseUpdate = {
  releaseCode: string;
  sourceRevision: string;
  detectedAt: string;
};

export async function checkCatalogReleaseUpdate() {
  if (!catalogReleaseCheckPromise) {
    catalogReleaseCheckPromise = checkCatalogReleaseUpdateRemote().finally(() => {
      catalogReleaseCheckPromise = null;
    });
  }
  await catalogReleaseCheckPromise;
}

export async function syncCatalogFromRemoteNow() {
  await ensureCatalogReady();
  if (!shouldAttemptRemoteCatalogSync()) {
    throw new Error("Supabase n'est pas configuré pour cet environnement.");
  }
  await syncCatalogSnapshotFromRemote({ throwOnError: true });
}

export async function replaceLocalCatalogCacheFromSnapshot(
  snapshot: CatalogSnapshotForCache,
) {
  await ensureCatalogReady();
  await withDatabase(async (db) => {
    const activeReleases = snapshot.releases.filter(
      (release) => release.status === "active",
    );
    if (activeReleases.length !== 1) {
      throw new Error(
        "Le snapshot distant doit déclarer exactement une release active.",
      );
    }
    const activeReleaseCode = activeReleases[0].code;
    const authoritativeExerciseCodes = new Set(
      snapshot.exercises.map((exercise) => exercise.code),
    );
    const authoritativeReleaseCodes = new Set(
      snapshot.releases.map((release) => release.code),
    );
    const visibleExerciseCodes = new Set(
      snapshot.exercises
        .filter(
          (exercise) =>
            exercise.releaseCode === activeReleaseCode &&
            exercise.isActive,
        )
        .map((exercise) => exercise.code),
    );
    await replaceCatalogCacheFromSeed(db, catalogSeedFromSnapshot(snapshot), {
        authoritativeExerciseCodes,
        authoritativeReleaseCodes,
        authoritativeVisibility: {
          activeReleaseCode,
          exerciseCodes: visibleExerciseCodes,
        },
    });
    await seedCanonicalEvaluationMappings(db);
    await markExerciseLibraryRevision(db);
  });
}

export async function ensureCatalogReady() {
  if (!catalogReadyPromise) {
    catalogReadyPromise = withDatabase(seedCatalogIfEmpty).catch(
      (error: unknown) => {
        catalogReadyPromise = null;
        throw error;
      },
    );
  }

  return catalogReadyPromise;
}

export async function getLocalActiveCatalogReleaseFingerprint(): Promise<
  CatalogReleaseFingerprint | null
> {
  await ensureCatalogReady();
  return withDatabase((db) => readActiveCatalogReleaseFingerprint(db));
}

/** Loads the search/generation index only after the Library (or generator) asks for it. */
export async function ensureCatalogLibraryIndex() {
  await ensureCatalogReady();
  if (await hasUsableCatalogIndex()) return;
  if (!shouldAttemptRemoteCatalogSync()) return;

  const { fetchActiveCatalogIndex } = await import("./catalogProgressiveRemote");
  const index = await fetchActiveCatalogIndex();
  await writeCatalogIndexInBatches(index);
  await withDatabase((db) => markCatalogIndexAvailable(db, index));
}

export async function getPendingCatalogReleaseUpdate(): Promise<
  PendingCatalogReleaseUpdate | null
> {
  await ensureCatalogReady();
  return withDatabase(async (db) => {
    const row = await db.getFirstAsync<{
      release_code: string;
      source_revision: string;
      detected_at: string;
    }>(`
      SELECT release_code, source_revision, detected_at
      FROM catalog_release_updates
      WHERE status = 'available'
      ORDER BY detected_at DESC
      LIMIT 1
    `);
    return row
      ? {
          releaseCode: row.release_code,
          sourceRevision: row.source_revision,
          detectedAt: row.detected_at,
        }
      : null;
  });
}

/**
 * A detected revision is only fetched after an explicit user action.  The
 * current schema keeps a stable release code for this beta; a code change is
 * deliberately rejected rather than silently mixing two catalogue graphs.
 */
export async function acceptPendingCatalogReleaseUpdate() {
  await ensureCatalogReady();
  const pending = await getPendingCatalogReleaseUpdate();
  if (!pending) return;
  const local = await getLocalActiveCatalogReleaseFingerprint();
  if (local && local.code !== pending.releaseCode) {
    throw new Error(
      "Cette mise à jour change de release et requiert une migration catalogue dédiée.",
    );
  }
  const { fetchActiveCatalogIndex } = await import("./catalogProgressiveRemote");
  const index = await fetchActiveCatalogIndex();
  const remote = index.releases?.find((release) => release.status === "active");
  if (
    !remote ||
    remote.code !== pending.releaseCode ||
    remote.sourceRevision !== pending.sourceRevision
  ) {
    throw new Error("La release a changé pendant le téléchargement. Réessaie.");
  }
  await writeCatalogIndexInBatches(index);
  await withDatabase(async (db) => {
    await markCatalogIndexAvailable(db, index);
    await db.runAsync(
      `UPDATE catalog_release_updates
       SET status = 'accepted'
       WHERE release_code = ? AND source_revision = ?`,
      [pending.releaseCode, pending.sourceRevision],
    );
  });
}

/** Hydrates at most 25 complete sheets and validates their requested media bytes. */
export async function ensureCatalogExerciseDetails(
  slugs: readonly string[],
  options: {
    media?: "poster" | "animation" | "all";
    signal?: AbortSignal;
  } = {},
) {
  await ensureCatalogLibraryIndex();
  const requested = [...new Set(slugs)].slice(0, catalogDetailBatchSize);
  if (requested.length === 0) return;
  const media = options.media ?? "poster";
  const missing = await listMissingCatalogDetailSlugs(
    requested,
    media === "all" ? ["poster", "animation"] : [media],
  );
  if (missing.length === 0) return;

  const { fetchActiveCatalogDetails } = await import("./catalogProgressiveRemote");
  const details = await fetchActiveCatalogDetails(missing);
  await writeCatalogDetails(details);
  await cacheHydratedMedia(details, media, options.signal);
}

/**
 * Explicit, resumable complete-library action.  Work is deliberately split
 * into bounded detail RPCs and one short SQLite transaction per response;
 * only this function writes catalogue rows, through the shared database queue.
 */
export async function downloadCompleteCatalogLibrary(options: {
  onProgress?: (progress: CatalogLibraryDownloadProgress) => void;
  signal?: AbortSignal;
} = {}) {
  await ensureCatalogLibraryIndex();
  const requested = await withDatabase(async (db) => {
    const rows = await db.getAllAsync<{ slug: string }>(`
      SELECT exercise.slug
      FROM catalog_exercises exercise
      JOIN catalog_releases release ON release.id = exercise.release_id
      WHERE release.status = 'active' AND exercise.is_active = 1
      ORDER BY exercise.label
    `);
    return rows.map((row) => row.slug);
  });
  const slugs = await listMissingCatalogDetailSlugs(requested, [
    "poster",
    "animation",
  ]);
  const total = slugs.length;
  let completed = 0;
  options.onProgress?.({ completed, total, currentSlug: null });

  const { fetchActiveCatalogDetails } = await import("./catalogProgressiveRemote");
  for (const batch of chunk(slugs, catalogDetailBatchSize)) {
    if (options.signal?.aborted) {
      throw new DOMException("Téléchargement annulé.", "AbortError");
    }
    const details = await fetchActiveCatalogDetails(batch);
    await writeCatalogDetails(details);
    await cacheHydratedMedia(details, "all", options.signal);
    completed += details.exercises.length;
    options.onProgress?.({
      completed,
      total,
      currentSlug: details.exercises.at(-1)?.slug ?? null,
    });
  }
  await withDatabase((db) => markCompleteLibraryAvailable(db));
}

async function hasUsableCatalogIndex() {
  return withDatabase(async (db) => {
    const marker = await db.getFirstAsync<{ exists_flag: number }>(`
      SELECT 1 AS exists_flag
      FROM catalog_cache_entries
      WHERE scope = 'index' AND state = 'available'
      LIMIT 1
    `);
    if (marker) return true;
    // A v32 installation may already hold the complete active release.  It is
    // an index by definition and must not be re-downloaded or purged.
    const complete = await db.getFirstAsync<{ exists_flag: number }>(`
      SELECT 1 AS exists_flag
      FROM catalog_releases release
      WHERE release.status = 'active'
        AND (
          SELECT count(*) FROM catalog_exercises exercise
          WHERE exercise.release_id = release.id AND exercise.is_active = 1
        ) >= release.expected_exercise_count
      LIMIT 1
    `);
    return Boolean(complete);
  });
}

async function writeCatalogIndexInBatches(seed: CatalogSeed) {
  const authoritativeExerciseCodes = new Set(
    seed.exercises.map((exercise) => exercise.code),
  );
  const authoritativeReleaseCodes = new Set(
    (seed.releases ?? []).map((release) => release.code),
  );
  const partialExerciseCodes = authoritativeExerciseCodes;
  const indexOptions = {
    authoritativeExerciseCodes,
    authoritativeReleaseCodes,
    partialExerciseCodes,
  };

  // References first.  The following batches are independent small
  // transactions queued through withDatabase; no background worker receives a
  // second SQLite connection.
  await withDatabase((db) =>
    replaceCatalogCacheFromSeed(db, {
      ...seed,
      exercises: [],
      series: [],
      repetitions: [],
      rests: [],
      intervals: [],
      formats: [],
      sessionTemplates: [],
      sessionTemplateLevels: [],
    }, indexOptions),
  );

  for (const formatBatch of chunk(seed.formats, 100)) {
    const seriesCodes = new Set(formatBatch.map((format) => format.seriesCode));
    const repetitionCodes = new Set(
      formatBatch.flatMap((format) =>
        format.repetitionsCode ? [format.repetitionsCode] : [],
      ),
    );
    const restCodes = new Set(formatBatch.map((format) => format.restCode));
    const intervalCodes = new Set(
      formatBatch.flatMap((format) =>
        format.intervalCode ? [format.intervalCode] : [],
      ),
    );
    await withDatabase((db) =>
      replaceCatalogCacheFromSeed(db, {
        ...seed,
        exercises: [],
        series: seed.series.filter((row) => seriesCodes.has(row.code)),
        repetitions: seed.repetitions.filter((row) => repetitionCodes.has(row.code)),
        rests: seed.rests.filter((row) => restCodes.has(row.code)),
        intervals: seed.intervals.filter((row) => intervalCodes.has(row.code)),
        formats: formatBatch,
        sessionTemplates: [],
        sessionTemplateLevels: [],
      }, indexOptions),
    );
  }

  for (const exerciseBatch of chunk(seed.exercises, 50)) {
    await withDatabase((db) =>
      replaceCatalogCacheFromSeed(db, {
        ...seed,
        exercises: exerciseBatch,
        series: [],
        repetitions: [],
        rests: [],
        intervals: [],
        formats: [],
        sessionTemplates: [],
        sessionTemplateLevels: [],
      }, indexOptions),
    );
  }

  for (const templateBatch of chunk(seed.sessionTemplates, 50)) {
    const templateCodes = new Set(templateBatch.map((template) => template.code));
    const templateExerciseCodes = new Set(
      templateBatch.map((template) => template.exerciseCode),
    );
    await withDatabase((db) =>
      replaceCatalogCacheFromSeed(db, {
        ...seed,
        exercises: seed.exercises.filter((exercise) =>
          templateExerciseCodes.has(exercise.code),
        ),
        series: [],
        repetitions: [],
        rests: [],
        intervals: [],
        formats: [],
        sessionTemplates: templateBatch,
        sessionTemplateLevels: seed.sessionTemplateLevels.filter((level) =>
          templateCodes.has(level.sessionTemplateCode),
        ),
      }, indexOptions),
    );
  }
}

async function writeCatalogDetails(seed: CatalogSeed) {
  const activeRelease = seed.releases?.find(
    (release) => release.status === "active",
  );
  if (!activeRelease) {
    throw new Error("Les fiches distantes ne déclarent aucune release active.");
  }
  const authoritativeExerciseCodes = new Set(
    seed.exercises.map((exercise) => exercise.code),
  );
  await withDatabase((db) =>
    replaceCatalogCacheFromSeed(db, seed, {
      authoritativeExerciseCodes,
      authoritativeReleaseCodes: new Set([activeRelease.code]),
    }),
  );
  await withDatabase(async (db) => {
    const now = new Date().toISOString();
    for (const exercise of seed.exercises) {
      await db.runAsync(
        `INSERT INTO catalog_cache_entries (
           scope, cache_key, release_code, exercise_code, sha256, state,
           updated_at, completed_at, error_message
         ) VALUES ('detail', ?, ?, ?, NULL, 'available', ?, ?, NULL)
         ON CONFLICT(scope, cache_key) DO UPDATE SET
           release_code = excluded.release_code, state = excluded.state,
           updated_at = excluded.updated_at, completed_at = excluded.completed_at,
           error_message = NULL`,
        [exercise.code, activeRelease.code, exercise.code, now, now],
      );
    }
  });
}

async function cacheHydratedMedia(
  seed: CatalogSeed,
  mode: "poster" | "animation" | "all",
  signal?: AbortSignal,
) {
  const activeRelease = seed.releases?.find(
    (release) => release.status === "active",
  );
  if (!activeRelease) return;
  const { cacheCatalogMedia } = await import("./catalogMediaCache");
  for (const exercise of seed.exercises) {
    const media = (exercise.media ?? []).filter((item) =>
      mode === "all" ? true : item.kind === mode,
    );
    for (const item of media) {
      try {
        if (signal?.aborted) {
          throw new DOMException("Téléchargement annulé.", "AbortError");
        }
        await cacheCatalogMedia(item, activeRelease.sourceRevision);
        await withDatabase((db) =>
          db.runAsync(
            `INSERT INTO catalog_cache_entries (
               scope, cache_key, release_code, exercise_code, sha256, state,
               updated_at, completed_at, error_message
             ) VALUES ('media', ?, ?, ?, ?, 'available', ?, ?, NULL)
             ON CONFLICT(scope, cache_key) DO UPDATE SET
               sha256 = excluded.sha256, state = excluded.state,
               updated_at = excluded.updated_at, completed_at = excluded.completed_at,
               error_message = NULL`,
            [
              `${exercise.code}:${item.kind}`,
              activeRelease.code,
              exercise.code,
              item.sha256,
              new Date().toISOString(),
              new Date().toISOString(),
            ],
          ),
        );
      } catch (error) {
        await withDatabase((db) =>
          db.runAsync(
            `INSERT INTO catalog_cache_entries (
               scope, cache_key, release_code, exercise_code, sha256, state,
               updated_at, completed_at, error_message
             ) VALUES ('media', ?, ?, ?, ?, 'failed', ?, NULL, ?)
             ON CONFLICT(scope, cache_key) DO UPDATE SET
               state = excluded.state, updated_at = excluded.updated_at,
               error_message = excluded.error_message`,
            [
              `${exercise.code}:${item.kind}`,
              activeRelease.code,
              exercise.code,
              item.sha256,
              new Date().toISOString(),
              error instanceof Error ? error.message : "Média indisponible.",
            ],
          ),
        );
        throw error;
      }
    }
  }
}

type LocalCatalogDetailMedia = {
  fileName: string;
  kind: CatalogExerciseMediaKind;
  sha256: string | null;
  uri: string;
};

type LocalCatalogDetail = {
  code: string;
  detailCacheState: string | null;
  media: LocalCatalogDetailMedia[];
  releaseRevision: string;
  slug: string;
};

/**
 * A cache marker alone is not enough: v32 catalogues were migrated to those
 * markers before WebP payloads moved to Cache Storage.  Keep the SQLite read
 * short, then inspect Cache Storage outside of the database write queue.
 */
async function listMissingCatalogDetailSlugs(
  slugs: readonly string[],
  requiredMediaKinds: readonly CatalogExerciseMediaKind[] = ["poster"],
) {
  if (slugs.length === 0) return [];

  const details = await readLocalCatalogDetails(slugs);
  const bundledCoreExerciseCodes = new Set(
    getLocalCatalogSeed().exercises.map((exercise) => exercise.code),
  );
  const { hasCachedCatalogMedia } = await import("./catalogMediaCache");
  const missing: string[] = [];

  for (const slug of slugs) {
    const detail = details.get(slug);
    if (!detail) throw new Error(`Exercice inconnu : ${slug}.`);
    if (detail.detailCacheState !== "available") {
      missing.push(slug);
      continue;
    }

    // The six V4 evaluation exercises ship with the application, so they are
    // available even before Cache Storage exists on a first launch.
    if (bundledCoreExerciseCodes.has(detail.code)) continue;

    const media = requiredMediaKinds.map((kind) =>
      detail.media.find((item) => item.kind === kind),
    );
    const requiredMedia = media.filter(
      (item): item is LocalCatalogDetailMedia => item !== undefined,
    );
    if (requiredMedia.length !== requiredMediaKinds.length) {
      missing.push(slug);
      continue;
    }

    const cached = await Promise.all(
      requiredMedia.map((item) =>
        hasCachedCatalogMedia(item, detail.releaseRevision),
      ),
    );
    if (cached.some((available) => !available)) missing.push(slug);
  }

  return missing;
}

async function readLocalCatalogDetails(slugs: readonly string[]) {
  const placeholders = slugs.map(() => "?").join(", ");
  const rows = await withDatabase((db) =>
    db.getAllAsync<{
      code: string;
      detail_cache_state: string | null;
      media_file_name: string | null;
      media_kind: CatalogExerciseMediaKind | null;
      media_sha256: string | null;
      media_status: string | null;
      media_uri: string | null;
      release_revision: string;
      slug: string;
    }>(
      `SELECT exercise.slug, exercise.code,
              detail_cache.state AS detail_cache_state,
              release.source_revision AS release_revision,
              media.kind AS media_kind, media.uri AS media_uri,
              media.file_name AS media_file_name, media.sha256 AS media_sha256,
              media.status AS media_status
       FROM catalog_exercises exercise
       JOIN catalog_releases release ON release.id = exercise.release_id
       LEFT JOIN catalog_cache_entries detail_cache
         ON detail_cache.scope = 'detail' AND detail_cache.cache_key = exercise.code
       LEFT JOIN catalog_exercise_media media
         ON media.exercise_id = exercise.id
       WHERE exercise.slug IN (${placeholders})`,
      [...slugs],
    ),
  );

  const details = new Map<string, LocalCatalogDetail>();
  for (const row of rows) {
    const detail = details.get(row.slug) ?? {
      code: row.code,
      detailCacheState: row.detail_cache_state,
      media: [],
      releaseRevision: row.release_revision,
      slug: row.slug,
    };
    if (
      row.media_kind &&
      row.media_status === "ready" &&
      row.media_uri &&
      row.media_file_name
    ) {
      detail.media.push({
        fileName: row.media_file_name,
        kind: row.media_kind,
        sha256: row.media_sha256,
        uri: row.media_uri,
      });
    }
    details.set(row.slug, detail);
  }
  return details;
}

async function markCatalogIndexAvailable(db: LocalDatabase, seed: CatalogSeed) {
  const release = seed.releases?.find((candidate) => candidate.status === "active");
  if (!release) throw new Error("Index sans release active.");
  const now = new Date().toISOString();
  await db.runAsync(
    `INSERT INTO catalog_cache_entries (
       scope, cache_key, release_code, exercise_code, sha256, state,
       updated_at, completed_at, error_message
     ) VALUES ('index', ?, ?, NULL, ?, 'available', ?, ?, NULL)
     ON CONFLICT(scope, cache_key) DO UPDATE SET
       release_code = excluded.release_code, sha256 = excluded.sha256,
       state = excluded.state, updated_at = excluded.updated_at,
       completed_at = excluded.completed_at, error_message = NULL`,
    [release.code, release.code, release.sourceRevision, now, now],
  );
}

async function markCompleteLibraryAvailable(db: LocalDatabase) {
  const release = await db.getFirstAsync<{ code: string; source_revision: string }>(`
    SELECT code, source_revision FROM catalog_releases
    WHERE status = 'active' LIMIT 1
  `);
  if (!release) return;
  const now = new Date().toISOString();
  await db.runAsync(
    `INSERT INTO catalog_cache_entries (
       scope, cache_key, release_code, exercise_code, sha256, state,
       updated_at, completed_at, error_message
     ) VALUES ('library', ?, ?, NULL, ?, 'available', ?, ?, NULL)
     ON CONFLICT(scope, cache_key) DO UPDATE SET
       sha256 = excluded.sha256, state = excluded.state,
       updated_at = excluded.updated_at, completed_at = excluded.completed_at,
       error_message = NULL`,
    [release.code, release.code, release.source_revision, now, now],
  );
}

function chunk<TValue>(items: readonly TValue[], size: number) {
  const batches: TValue[][] = [];
  for (let index = 0; index < items.length; index += size) {
    batches.push(items.slice(index, index + size));
  }
  return batches;
}

async function seedCatalogIfEmpty(db: LocalDatabase) {
  const rows = await db.getAllAsync<{ exercise_count: number }>(`
    SELECT COUNT(*) AS exercise_count
    FROM catalog_exercises
  `);

  if ((rows[0]?.exercise_count ?? 0) === 0) {
    const localSeed = getLocalCatalogSeed();
    const activeRelease = (localSeed.releases ?? []).find(
      (release) => release.status === "active",
    );
    if (!activeRelease) {
      throw new Error("Le seed local doit déclarer une release active.");
    }
    const exerciseCodes = new Set(localSeed.exercises.map((exercise) => exercise.code));
    await replaceCatalogCacheFromSeed(db, localSeed, {
      authoritativeExerciseCodes: exerciseCodes,
      authoritativeReleaseCodes: new Set(
        (localSeed.releases ?? []).map((release) => release.code),
      ),
      authoritativeVisibility: {
        activeReleaseCode: activeRelease.code,
        exerciseCodes,
      },
    });
    await markSeededCoreCache(db, localSeed);
    await markExerciseLibraryRevision(db);
  } else {
    const currentRevision = await db.getFirstAsync<{ exists_flag: number }>(
      `SELECT 1 AS exists_flag
       FROM sync_metadata
       WHERE key = ?
       LIMIT 1`,
      [exerciseLibraryMetadataKey],
    );
    if (!currentRevision) {
      const localSeed = getLocalCatalogSeed();
      const activeRelease = localSeed.releases?.find(
        (release) => release.status === "active",
      );
      if (!activeRelease) {
        throw new Error("Le seed local doit déclarer une release active.");
      }
      // Existing complete local caches are intentionally retained. Only an
      // installation that has no progressive marker gets the small offline
      // core added; its previously downloaded details are never purged.
      await replaceCatalogCacheFromSeed(db, localSeed);
      await markSeededCoreCache(db, localSeed);
      await markExerciseLibraryRevision(db);
    }
  }

  await resolvePendingProfileEquipment(db);
  await seedCanonicalEvaluationMappings(db);
  await restoreArchivedSessionFeedback(db);
}

async function markSeededCoreCache(db: LocalDatabase, seed: ReturnType<typeof getLocalCatalogSeed>) {
  const timestamp = new Date().toISOString();
  for (const exercise of seed.exercises) {
    const releaseCode = exercise.releaseCode ?? "catalog-v3-legacy";
    await db.runAsync(
      `INSERT INTO catalog_cache_entries (
         scope, cache_key, release_code, exercise_code, sha256, state,
         updated_at, completed_at, error_message
       ) VALUES ('detail', ?, ?, ?, NULL, 'available', ?, ?, NULL)
       ON CONFLICT(scope, cache_key) DO NOTHING`,
      [exercise.code, releaseCode, exercise.code, timestamp, timestamp],
    );
    for (const media of exercise.media ?? []) {
      await db.runAsync(
        `INSERT INTO catalog_cache_entries (
           scope, cache_key, release_code, exercise_code, sha256, state,
           updated_at, completed_at, error_message
         ) VALUES ('media', ?, ?, ?, ?, 'available', ?, ?, NULL)
         ON CONFLICT(scope, cache_key) DO NOTHING`,
        [
          `${exercise.code}:${media.kind}`,
          releaseCode,
          exercise.code,
          media.sha256,
          timestamp,
          timestamp,
        ],
      );
    }
  }
}

async function seedCanonicalEvaluationMappings(db: LocalDatabase) {
  const updatedAt = "2026-08-11T00:00:00.000Z";
  for (const mapping of acreaLevelEvaluationV4Mappings) {
    await db.runAsync(
      `INSERT INTO acrea_level_evaluation_exercise_mappings (
         protocol_version, evaluation_exercise_code, exercise_slug, pillar,
         protocol_variant, confidence, count_unit,
         phase_1_series, phase_1_repetitions, phase_2_series,
         phase_2_repetitions, phase_3_series, level_2_minimum,
         level_3_minimum, validated_at, updated_at
       ) VALUES (4, ?, ?, ?, ?, ?, 'reps', ?, ?, ?, ?, 1, ?, ?, ?, ?)
       ON CONFLICT(protocol_version, evaluation_exercise_code) DO UPDATE SET
         exercise_slug = excluded.exercise_slug,
         pillar = excluded.pillar,
         protocol_variant = excluded.protocol_variant,
         confidence = excluded.confidence,
         phase_1_series = excluded.phase_1_series,
         phase_1_repetitions = excluded.phase_1_repetitions,
         phase_2_series = excluded.phase_2_series,
         phase_2_repetitions = excluded.phase_2_repetitions,
         level_2_minimum = excluded.level_2_minimum,
         level_3_minimum = excluded.level_3_minimum,
         validated_at = excluded.validated_at,
         updated_at = excluded.updated_at`,
      [
        mapping.evaluationExerciseCode,
        mapping.exerciseSlug,
        mapping.pillar,
        mapping.protocolVariant,
        mapping.mappingConfidence,
        mapping.phase1.series,
        mapping.phase1.repetitions,
        mapping.phase2.series,
        mapping.phase2.repetitions,
        mapping.levelThresholds.level2Minimum,
        mapping.levelThresholds.level3Minimum,
        updatedAt,
        updatedAt,
      ],
    );
  }
}

async function markExerciseLibraryRevision(db: LocalDatabase) {
  await db.withTransactionAsync(async () => {
    await db.runAsync(
      `INSERT OR IGNORE INTO sync_metadata (key)
       VALUES (?)`,
      [exerciseLibraryMetadataKey],
    );
    await db.runAsync(
      `DELETE FROM sync_metadata
       WHERE key LIKE 'exercise-library:%'
         AND key <> ?`,
      [exerciseLibraryMetadataKey],
    );
  });
}

async function restoreArchivedSessionFeedback(db: LocalDatabase) {
  const archive = await db.getFirstAsync<{ exists_flag: number }>(
    `SELECT 1 AS exists_flag
     FROM sqlite_master
     WHERE type = 'table' AND name = 'session_feedback_migration_archive'
     LIMIT 1`,
  );
  if (!archive) return;

  await db.execAsync(`
    INSERT OR IGNORE INTO session_feedback (
      execution_id, profile_id, program_id, training_id, session_id,
      session_template_id, exercise_id, exercise_code, format_id,
      training_code, seance_code, seance_index, seance_title, session_code,
      session_index, exercise_name, format_code, format_label, level, pillar,
      performed_at, timer_plan_code, total_seconds, completed_seconds,
      phase_count, status, effort_rating, quality_rating, pain_level,
      progression_decision, progression_preference, notes
    )
    SELECT
      'legacy-' || replace(archive.profile_key, ' ', '-') || '-' || archive.original_id,
      profile.profile_id, NULL, NULL, NULL,
      template.id, exercise.id, exercise.code, format.id,
      coalesce(json_extract(archive.payload_json, '$.trainingCode'), 'legacy-training'),
      coalesce(json_extract(archive.payload_json, '$.seanceCode'), 'legacy-seance'),
      coalesce(json_extract(archive.payload_json, '$.seanceIndex'), 0),
      coalesce(json_extract(archive.payload_json, '$.seanceTitle'), 'Séance historique'),
      archive.session_code,
      coalesce(json_extract(archive.payload_json, '$.sessionIndex'), 0),
      coalesce(json_extract(archive.payload_json, '$.exerciseName'), exercise.label),
      format.code,
      coalesce(json_extract(archive.payload_json, '$.formatLabel'), format.label),
      min(10, max(1, coalesce(json_extract(archive.payload_json, '$.level'), 1))),
      json_extract(archive.payload_json, '$.pillar'),
      coalesce(json_extract(archive.payload_json, '$.performedAt'), archive.archived_at),
      json_extract(archive.payload_json, '$.timerPlanCode'),
      max(0, coalesce(json_extract(archive.payload_json, '$.totalSeconds'), 0)),
      max(0, coalesce(json_extract(archive.payload_json, '$.completedSeconds'), 0)),
      max(0, coalesce(json_extract(archive.payload_json, '$.phaseCount'), 0)),
      coalesce(json_extract(archive.payload_json, '$.status'), 'stopped'),
      json_extract(archive.payload_json, '$.effortRating'),
      json_extract(archive.payload_json, '$.qualityRating'),
      coalesce(json_extract(archive.payload_json, '$.painLevel'), 'none'),
      coalesce(json_extract(archive.payload_json, '$.progressionDecision'), 'maintain'),
      coalesce(json_extract(archive.payload_json, '$.progressionPreference'), 'same'),
      coalesce(json_extract(archive.payload_json, '$.notes'), '')
    FROM session_feedback_migration_archive archive
    JOIN acrea_profiles profile ON profile.profile_id = archive.profile_key
    JOIN catalog_exercises exercise ON exercise.code = archive.exercise_code
    JOIN catalog_formats format ON format.code = archive.format_code
    JOIN catalog_session_templates template ON template.id = (
      SELECT candidate.id
      FROM catalog_session_templates candidate
      JOIN catalog_session_template_levels level_link
        ON level_link.session_template_id = candidate.id
       AND level_link.level = min(10, max(1, coalesce(
         json_extract(archive.payload_json, '$.level'), 1
       )))
      WHERE candidate.exercise_id = exercise.id AND candidate.is_active = 1
      ORDER BY candidate.id
      LIMIT 1
    )
    WHERE archive.restored_at IS NULL
      AND json_extract(archive.payload_json, '$.pillar') IN (
        'strength', 'cardio', 'proprioception'
      );

    UPDATE session_feedback_migration_archive
    SET restored_at = datetime('now'), restore_error = NULL
    WHERE EXISTS (
      SELECT 1 FROM session_feedback feedback
      WHERE feedback.execution_id = 'legacy-' ||
        replace(session_feedback_migration_archive.profile_key, ' ', '-') || '-' ||
        session_feedback_migration_archive.original_id
    );

    UPDATE session_feedback_migration_archive
    SET restore_error = 'Références profil/catalogue non résolues'
    WHERE restored_at IS NULL;
  `);
}

async function checkCatalogReleaseUpdateRemote() {
  await ensureCatalogReady();

  if (shouldAttemptRemoteCatalogSync()) {
    const localFingerprint =
      await getLocalActiveCatalogReleaseFingerprint();
    const fingerprintCheck =
      await checkActiveCatalogReleaseFingerprint(localFingerprint);

    // La détection ne télécharge jamais le catalogue : l'utilisateur valide
    // explicitement la nouvelle release depuis la Bibliothèque.
    if (fingerprintCheck.status === "changed") {
      await markCatalogReleaseUpdateAvailable(fingerprintCheck.remote);
    }
    // Si la sonde est indisponible hors ligne, le cache local reste intact.
  }
}

async function markCatalogReleaseUpdateAvailable(
  remote: CatalogReleaseFingerprint | null,
) {
  if (!remote) return;
  await withDatabase((db) =>
    db.runAsync(
      `INSERT INTO catalog_release_updates (
         release_code, source_revision, activated_at, updated_at, detected_at,
         status
       ) VALUES (?, ?, ?, ?, ?, 'available')
       ON CONFLICT(release_code, source_revision) DO UPDATE SET
         activated_at = excluded.activated_at,
         updated_at = excluded.updated_at,
         detected_at = excluded.detected_at,
         status = 'available'`,
      [
        remote.code,
        remote.sourceRevision,
        remote.activatedAt,
        remote.updatedAt,
        new Date().toISOString(),
      ],
    ),
  );
}

async function syncCatalogSnapshotFromRemote({
  attemptedAt = new Date().toISOString(),
  throwOnError,
}: {
  attemptedAt?: string;
  throwOnError: boolean;
}) {
  await updateCatalogSyncMetadata({
    catalog_last_attempt_at: attemptedAt,
    catalog_last_error: null,
  });

  try {
    const remoteSnapshot = await fetchRemoteCatalogAdminSnapshot();
    const activeReleases = remoteSnapshot.releases.filter(
      (release) => release.status === "active",
    );
    if (activeReleases.length !== 1) {
      throw new Error(
        "Le snapshot distant doit déclarer exactement une release active.",
      );
    }
    const activeRelease = activeReleases[0];
    const consistencyCheck = await checkActiveCatalogReleaseFingerprint({
      code: activeRelease.code,
      sourceRevision: activeRelease.sourceRevision,
      activatedAt: activeRelease.activatedAt,
      updatedAt: activeRelease.updatedAt,
    });
    if (consistencyCheck.status === "unavailable") {
      throw consistencyCheck.error;
    }
    if (consistencyCheck.status === "changed") {
      throw new Error(
        "La release active a changé pendant le téléchargement du catalogue.",
      );
    }
    await replaceLocalCatalogCacheFromSnapshot(remoteSnapshot);
    await updateCatalogSyncMetadata({
      catalog_last_success_at: new Date().toISOString(),
      catalog_last_error: null,
    });
  } catch (error) {
    const message = catalogSyncErrorMessage(error);
    await updateCatalogSyncMetadata({
      catalog_last_error: message,
    });
    if (throwOnError) throw new Error(message);
  }
}

async function getCatalogSyncMetadata(): Promise<CatalogSyncMetadataRow> {
  return withDatabase(readCatalogSyncMetadata);
}

async function readCatalogSyncMetadata(
  db: LocalDatabase,
): Promise<CatalogSyncMetadataRow> {
  const rows = await db.getAllAsync<CatalogSyncMetadataRow>(
    `
    SELECT
      catalog_last_attempt_at,
      catalog_last_success_at,
      catalog_last_error
    FROM sync_metadata
    WHERE key = 'catalog'
    LIMIT 1
    `,
  );

  return (
    rows[0] ?? {
      catalog_last_attempt_at: null,
      catalog_last_success_at: null,
      catalog_last_error: null,
    }
  );
}

async function updateCatalogSyncMetadata(
  metadata: Partial<CatalogSyncMetadataRow>,
) {
  await withDatabase(async (db) => {
    const currentMetadata = await readCatalogSyncMetadata(db);
    const nextMetadata = {
      ...currentMetadata,
      ...metadata,
    };

    await db.runAsync(
      `
      INSERT INTO sync_metadata (
        key,
        catalog_last_attempt_at,
        catalog_last_success_at,
        catalog_last_error
      ) VALUES ('catalog', ?, ?, ?)
      ON CONFLICT(key) DO UPDATE SET
        catalog_last_attempt_at = excluded.catalog_last_attempt_at,
        catalog_last_success_at = excluded.catalog_last_success_at,
        catalog_last_error = excluded.catalog_last_error
      `,
      [
        nextMetadata.catalog_last_attempt_at,
        nextMetadata.catalog_last_success_at,
        nextMetadata.catalog_last_error,
      ],
    );
  });
}
