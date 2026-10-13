import { Platform } from "react-native";

import type { CatalogExerciseMedia } from "../types";

const cachePrefix = "acrea-catalog-media";

export type CatalogMediaDownloadProgress = {
  completed: number;
  total: number;
  slug: string;
};

export function mediaRequestUrl(uri: string) {
  if (/^https:\/\//iu.test(uri)) return uri;
  if (Platform.OS === "web" && typeof location !== "undefined") {
    return new URL(uri.startsWith("/") ? uri : `/${uri}`, location.origin).toString();
  }
  return uri;
}

async function sha256Hex(bytes: ArrayBuffer) {
  if (!globalThis.crypto?.subtle) {
    throw new Error("La vérification SHA-256 n'est pas disponible sur cet appareil.");
  }
  const digest = await globalThis.crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest), (value) =>
    value.toString(16).padStart(2, "0"),
  ).join("");
}

async function responseHasExpectedDigest(
  response: Response,
  expectedSha256: string | null,
) {
  if (!expectedSha256) return false;
  const bytes = await response.clone().arrayBuffer();
  return (await sha256Hex(bytes)) === expectedSha256;
}

/**
 * SQLite tracks a successful hydration, but cannot prove that Cache Storage
 * still contains the corresponding bytes.  In particular, v32 installations
 * predate Cache Storage and therefore have valid SQL metadata without a WebP
 * payload.  Check the browser cache itself before deciding that a media item
 * is available offline.
 */
export async function hasCachedCatalogMedia(
  media: Pick<CatalogExerciseMedia, "uri" | "sha256" | "fileName">,
  releaseRevision: string,
) {
  if (Platform.OS !== "web" || typeof caches === "undefined") return true;

  const cacheName = `${cachePrefix}:${releaseRevision}`;
  if (!(await caches.keys()).includes(cacheName)) return false;

  const cache = await caches.open(cacheName);
  const cached = await cache.match(mediaRequestUrl(media.uri));
  return Boolean(
    cached && (await responseHasExpectedDigest(cached, media.sha256)),
  );
}

/**
 * Cache Storage is intentionally the source of truth for WebP bytes. SQLite
 * only stores the small integrity/state marker, so a full library never
 * inflates a SQL transaction or blocks profile and timer writes.
 */
export async function cacheCatalogMedia(
  media: Pick<CatalogExerciseMedia, "uri" | "sha256" | "fileName">,
  releaseRevision: string,
) {
  if (Platform.OS !== "web" || typeof caches === "undefined") return;
  const url = mediaRequestUrl(media.uri);
  const cache = await caches.open(`${cachePrefix}:${releaseRevision}`);
  const cached = await cache.match(url);
  if (cached && (await responseHasExpectedDigest(cached, media.sha256))) {
    return;
  }

  const response = await fetch(url, { cache: "no-store" });
  if (!response.ok) {
    throw new Error(`Média indisponible (${response.status}).`);
  }
  if (!(await responseHasExpectedDigest(response, media.sha256))) {
    throw new Error(`Empreinte SHA-256 invalide pour ${media.fileName}.`);
  }
  await cache.put(url, response.clone());
}

export async function cacheCatalogMediaSet(
  media: readonly Pick<CatalogExerciseMedia, "uri" | "sha256" | "fileName">[],
  releaseRevision: string,
  options: {
    slug: string;
    onProgress?: (progress: CatalogMediaDownloadProgress) => void;
    signal?: AbortSignal;
    startAt?: number;
    total?: number;
  },
) {
  const total = options.total ?? media.length;
  let completed = options.startAt ?? 0;
  for (const item of media) {
    if (options.signal?.aborted) {
      throw new DOMException("Téléchargement annulé.", "AbortError");
    }
    await cacheCatalogMedia(item, releaseRevision);
    completed += 1;
    options.onProgress?.({ completed, total, slug: options.slug });
  }
}
