import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type Dispatch,
  type SetStateAction,
} from "react";

import type { CatalogLoadStatus } from "./useCatalogLibrary";
import {
  acceptPendingCatalogReleaseUpdate,
  checkCatalogReleaseUpdate,
  downloadCompleteCatalogLibrary,
  ensureCatalogExerciseDetails,
  getPendingCatalogReleaseUpdate,
} from "../services/catalogRepository";
import { reportTechnicalDegradationOnce } from "@shared/observability/technicalDiagnostics";
import type { CatalogExercise } from "../types";

export type CatalogDownloadProgress = {
  completed: number;
  total: number;
};

export type PendingCatalogRelease = {
  sourceRevision: string;
};

type UseProgressiveCatalogLibraryOptions = {
  patchExercises: (slugs: readonly string[]) => Promise<void>;
  reload: () => void;
  setSelectedExerciseId: Dispatch<SetStateAction<number | null>>;
  status: CatalogLoadStatus;
};

export function useProgressiveCatalogLibrary({
  patchExercises,
  reload,
  setSelectedExerciseId,
  status,
}: UseProgressiveCatalogLibraryOptions) {
  const [hydratingSlug, setHydratingSlug] = useState<string | null>(null);
  const [hydratingAnimationSlug, setHydratingAnimationSlug] = useState<
    string | null
  >(null);
  const [detailError, setDetailError] = useState("");
  const [downloadProgress, setDownloadProgress] =
    useState<CatalogDownloadProgress | null>(null);
  const [pendingRelease, setPendingRelease] =
    useState<PendingCatalogRelease | null>(null);
  const [isAcceptingRelease, setIsAcceptingRelease] = useState(false);
  const downloadAbortController = useRef<AbortController | null>(null);
  const posterHydrationQueue = useRef<string[]>([]);
  const queuedPosterSlugs = useRef(new Set<string>());
  const visiblePosterSlugs = useRef(new Set<string>());
  const isHydratingPosters = useRef(false);

  useEffect(() => {
    void checkCatalogReleaseUpdate()
      .then(getPendingCatalogReleaseUpdate)
      .then((update) =>
        setPendingRelease(
          update ? { sourceRevision: update.sourceRevision } : null,
        ),
      )
      .catch(() => {
        // The catalogue itself remains usable if the release probe is offline.
      });
  }, [status]);

  useEffect(
    () => () => {
      downloadAbortController.current?.abort();
    },
    [],
  );

  const openExercise = useCallback(
    (exercise: CatalogExercise) => {
      setSelectedExerciseId(exercise.id);
      setDetailError("");
      setHydratingSlug(exercise.slug);
      void ensureCatalogExerciseDetails([exercise.slug], { media: "poster" })
        .then(() => patchExercises([exercise.slug]))
        .catch((error: unknown) => {
          setDetailError(
            error instanceof Error
              ? error.message
              : "Fiche indisponible hors ligne.",
          );
        })
        .finally(() => setHydratingSlug(null));
    },
    [patchExercises, setSelectedExerciseId],
  );

  const loadExerciseAnimation = useCallback(
    async (exercise: CatalogExercise) => {
      setDetailError("");
      setHydratingAnimationSlug(exercise.slug);
      try {
        await ensureCatalogExerciseDetails([exercise.slug], {
          media: "animation",
        });
        await patchExercises([exercise.slug]);
      } catch (error: unknown) {
        setDetailError(
          error instanceof Error
            ? error.message
            : "Animation indisponible hors ligne.",
        );
        throw error;
      } finally {
        setHydratingAnimationSlug(null);
      }
    },
    [patchExercises],
  );

  const hydrateVisibleExercisePosters = useCallback(
    (slugs: readonly string[]) => {
      for (const slug of slugs) {
        visiblePosterSlugs.current.add(slug);
        if (!slug || queuedPosterSlugs.current.has(slug)) continue;
        queuedPosterSlugs.current.add(slug);
        posterHydrationQueue.current.push(slug);
      }
      if (isHydratingPosters.current || posterHydrationQueue.current.length === 0) {
        return;
      }

      isHydratingPosters.current = true;
      void (async () => {
        let activeBatch: string[] = [];
        try {
          while (posterHydrationQueue.current.length > 0) {
            activeBatch = posterHydrationQueue.current.splice(0, 25);
            await ensureCatalogExerciseDetails(activeBatch, { media: "poster" });
            await patchExercises(activeBatch);
            for (const slug of activeBatch) {
              queuedPosterSlugs.current.delete(slug);
            }
            activeBatch = [];
          }
        } catch (error) {
          for (const slug of [
            ...activeBatch,
            ...posterHydrationQueue.current,
          ]) {
            queuedPosterSlugs.current.delete(slug);
          }
          posterHydrationQueue.current = [];
          reportTechnicalDegradationOnce("catalog-visible-poster-hydration", error);
        } finally {
          isHydratingPosters.current = false;
        }
      })();
    },
    [patchExercises],
  );

  const retryVisibleExercisePosters = useCallback(() => {
    if (visiblePosterSlugs.current.size > 0) {
      hydrateVisibleExercisePosters([...visiblePosterSlugs.current]);
    }
  }, [hydrateVisibleExercisePosters]);

  const toggleCompleteDownload = useCallback(() => {
    if (downloadAbortController.current) {
      downloadAbortController.current.abort();
      return;
    }

    const controller = new AbortController();
    downloadAbortController.current = controller;
    setDownloadProgress({ completed: 0, total: 0 });
    void downloadCompleteCatalogLibrary({
      signal: controller.signal,
      onProgress: ({ completed, total }) =>
        setDownloadProgress({ completed, total }),
    })
      .then(reload)
      .catch((error: unknown) => {
        if (!(error instanceof Error && error.name === "AbortError")) {
          setDetailError(
            error instanceof Error ? error.message : "Téléchargement interrompu.",
          );
        }
      })
      .finally(() => {
        downloadAbortController.current = null;
        setDownloadProgress(null);
      });
  }, [reload]);

  const acceptPendingRelease = useCallback(() => {
    setIsAcceptingRelease(true);
    void acceptPendingCatalogReleaseUpdate()
      .then(() => {
        setPendingRelease(null);
        reload();
      })
      .catch((error: unknown) => {
        setDetailError(
          error instanceof Error ? error.message : "Mise à jour impossible.",
        );
      })
      .finally(() => setIsAcceptingRelease(false));
  }, [reload]);

  return {
    acceptPendingRelease,
    detailError,
    downloadProgress,
    hydratingAnimationSlug,
    hydratingSlug,
    isAcceptingRelease,
    hydrateVisibleExercisePosters,
    loadExerciseAnimation,
    openExercise,
    pendingRelease,
    retryVisibleExercisePosters,
    toggleCompleteDownload,
  };
}
