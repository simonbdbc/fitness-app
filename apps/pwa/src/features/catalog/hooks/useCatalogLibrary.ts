import { useCallback, useEffect, useState } from "react";

import { reportTechnicalDegradationOnce } from "@shared/observability/technicalDiagnostics";

import { errorMessageFromUnknown } from "../domain/catalogPresentation";
import {
  ensureCatalogLibraryIndex,
  loadCatalogLibrary,
  loadCatalogLibraryFilterOptions,
} from "../services/catalogRepository";
import { loadCatalogLibraryExercisesBySlugs } from "../services/catalogLibraryExercisePatch";
import type { CatalogLibraryScope } from "../services/catalogLibraryScope";
import type {
  CatalogExercise,
  CatalogFilterOptions,
  CatalogFilters,
} from "../types";

export type CatalogLoadStatus = "loading" | "success" | "error";

const emptyFilterOptions: CatalogFilterOptions = {
  equipment: [],
  families: [],
  hasBodyweightOption: false,
  levels: [],
  muscleGroups: [],
  pillars: [],
  types: [],
};

export function useCatalogLibrary(
  filters: CatalogFilters,
  options: { loadExercises?: boolean } = {},
) {
  const loadExercises = options.loadExercises ?? true;
  const [exercises, setExercises] = useState<CatalogExercise[]>([]);
  const [filterOptions, setFilterOptions] =
    useState<CatalogFilterOptions>(emptyFilterOptions);
  const [scope, setScope] = useState<CatalogLibraryScope | null>(null);
  const [status, setStatus] = useState<CatalogLoadStatus>("loading");
  const [errorMessage, setErrorMessage] = useState("");
  const [indexErrorMessage, setIndexErrorMessage] = useState("");
  const [reloadKey, setReloadKey] = useState(0);
  const reload = useCallback(() => {
    setReloadKey((currentKey) => currentKey + 1);
  }, []);
  const patchExercises = useCallback(
    async (slugs: readonly string[]) => {
      if (!scope || slugs.length === 0) return;
      const refreshed = await loadCatalogLibraryExercisesBySlugs(slugs, scope);
      const bySlug = new Map(refreshed.map((exercise) => [exercise.slug, exercise]));
      setExercises((current) =>
        current.map((exercise) => bySlug.get(exercise.slug) ?? exercise),
      );
    },
    [scope],
  );
  const refreshInPlace = useCallback(async () => {
    try {
      const library = loadExercises
        ? await loadCatalogLibrary(filters)
        : await loadCatalogLibraryFilterOptions().then(({ filterOptions, scope }) => ({
            exercises: [] as CatalogExercise[],
            filterOptions,
            scope,
          }));
      setExercises(library.exercises);
      setFilterOptions(library.filterOptions);
      setScope(library.scope);
      setErrorMessage("");
    } catch (error) {
      reportTechnicalDegradationOnce("catalog-library-refresh", error);
    }
  }, [filters, loadExercises]);
  const prepareLibraryIndex = useCallback(async () => {
    try {
      await ensureCatalogLibraryIndex();
      setIndexErrorMessage("");
    } catch (error) {
      reportTechnicalDegradationOnce("catalog-library-index", error);
      setIndexErrorMessage(errorMessageFromUnknown(error));
    }
  }, []);

  useEffect(() => {
    let isActive = true;
    void prepareLibraryIndex().finally(() => {
      if (isActive) reload();
    });
    return () => {
      isActive = false;
    };
  }, [reload, prepareLibraryIndex]);

  useEffect(() => {
    let isActive = true;
    setStatus("loading");
    setErrorMessage("");
    setScope(null);

    void (loadExercises
      ? loadCatalogLibrary(filters)
      : loadCatalogLibraryFilterOptions().then(({ filterOptions, scope }) => ({
          exercises: [] as CatalogExercise[],
          filterOptions,
          scope,
        })))
      .then((library) => {
        if (!isActive) return;
        setExercises(library.exercises);
        setFilterOptions(library.filterOptions);
        setScope(library.scope);
        setStatus("success");
      })
      .catch((error: unknown) => {
        if (!isActive) return;
        setErrorMessage(errorMessageFromUnknown(error));
        setStatus("error");
      });

    return () => {
      isActive = false;
    };
  }, [filters, loadExercises, reloadKey]);

  return {
    errorMessage: errorMessage || indexErrorMessage,
    exercises,
    filterOptions,
    patchExercises,
    refreshInPlace,
    reload,
    scope,
    status,
  };
}
