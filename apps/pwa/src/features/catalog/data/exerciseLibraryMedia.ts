import type { ImageProps } from "expo-image";

import type { CatalogExercise, CatalogExerciseMedia } from "../types";
import { exerciseLibraryCoreMediaSources } from "./exerciseLibraryCoreAssets";

type ExerciseMediaSource = NonNullable<ImageProps["source"]>;

export type ExerciseLibraryMedia = {
  animationSource: ExerciseMediaSource | null;
  fallbackPosterSource: null;
  labelFr: string;
  posterSource: ExerciseMediaSource;
};

function uriForMedia(media: CatalogExerciseMedia | undefined) {
  if (!media?.uri) return null;
  // `get_active_catalog_index` deliberately omits media. A versioned library
  // path can therefore only have been written by a hydrated detail response.
  // Older v32 installations can still contain `/docs/bibliotheque/...` asset
  // references in SQLite; rendering those on every card would both request
  // stale files and defeat progressive media loading.
  const uri = media.uri.startsWith("/") ? media.uri : `/${media.uri}`;
  return uri.startsWith("/library/") ? uri : null;
}

/**
 * The six core exercises retain bundled media. Every other source is exposed
 * only after its detail RPC has hydrated a versioned, cacheable URL.
 */
export function getExerciseLibraryMedia(
  exercise: Pick<CatalogExercise, "slug" | "name" | "media">,
): ExerciseLibraryMedia | null {
  const core = exerciseLibraryCoreMediaSources[exercise.slug];
  if (core) {
    return {
      animationSource: core.animationSource,
      fallbackPosterSource: null,
      labelFr: exercise.name,
      posterSource: core.posterSource,
    };
  }

  const posterSource = uriForMedia(
    exercise.media.find((media) => media.kind === "poster"),
  );
  if (!posterSource) return null;
  return {
    animationSource: uriForMedia(
      exercise.media.find((media) => media.kind === "animation"),
    ),
    fallbackPosterSource: null,
    labelFr: exercise.name,
    posterSource,
  };
}
