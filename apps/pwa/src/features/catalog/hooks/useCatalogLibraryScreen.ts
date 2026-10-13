import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type SetStateAction,
} from "react";

import {
  displaySessionStorageKey,
  usePersistentScreenState,
} from "@shared/persistence";

import { resolveSelectedCatalogExercise } from "../domain/catalogSelection";
import { useCatalogFilterPreferences } from "./useCatalogFilterPreferences";
import { useCatalogLibrary } from "./useCatalogLibrary";
import { useProgressiveCatalogLibrary } from "./useProgressiveCatalogLibrary";
import type { CatalogFilters } from "../types";

type CatalogLibraryUiState = {
  filtersVisible: boolean;
  searchQuery: string;
  selectedSlug: string | null;
};

const initialCatalogLibraryUiState: CatalogLibraryUiState = {
  filtersVisible: false,
  searchQuery: "",
  selectedSlug: null,
};

export function useCatalogLibraryScreen(
  userId: string | null | undefined,
) {
  const [selectedExerciseId, setSelectedExerciseId] = useState<number | null>(null);
  const {
    isRestoring: isRestoringUiState,
    setValue: setUiState,
    value: uiState,
  } = usePersistentScreenState({
    initialValue: initialCatalogLibraryUiState,
    parse: parseCatalogLibraryUiState,
    storageKey: userId
      ? displaySessionStorageKey(userId, "route:library")
      : null,
  });
  const { filtersVisible, searchQuery } = uiState;
  const debouncedSearchQuery = useDebouncedValue(searchQuery, 250);
  const bootstrapFilters = useMemo<CatalogFilters>(() => ({}), []);
  const bootstrapLibrary = useCatalogLibrary(
    bootstrapFilters,
    { loadExercises: false },
  );
  const {
    filters,
    isReady: areFilterPreferencesReady,
    setFilters,
  } = useCatalogFilterPreferences(userId, bootstrapLibrary.filterOptions);
  const catalogFilters = useMemo<CatalogFilters>(
    () => ({
      ...(filters ?? bootstrapFilters),
      query: debouncedSearchQuery.trim() || undefined,
    }),
    [bootstrapFilters, debouncedSearchQuery, filters],
  );
  const catalog = useCatalogLibrary(catalogFilters, {
    loadExercises: areFilterPreferencesReady,
  });
  const setSelectedExercise = useCallback(
    (next: SetStateAction<number | null>) => {
      setSelectedExerciseId((current) => {
        const nextId = typeof next === "function" ? next(current) : next;
        const selectedSlug =
          catalog.exercises.find(({ id }) => id === nextId)?.slug ?? null;
        setUiState((ui) => ({ ...ui, selectedSlug }));
        return nextId;
      });
    },
    [catalog.exercises, setUiState],
  );
  const progressive = useProgressiveCatalogLibrary({
    patchExercises: catalog.patchExercises,
    reload: catalog.reload,
    setSelectedExerciseId: setSelectedExercise,
    status: catalog.status,
  });
  const selectedExercise = useMemo(
    () => resolveSelectedCatalogExercise(catalog.exercises, selectedExerciseId),
    [catalog.exercises, selectedExerciseId],
  );
  useEffect(() => {
    if (catalog.status !== "success") return;
    const restoredExercise = uiState.selectedSlug
      ? catalog.exercises.find(({ slug }) => slug === uiState.selectedSlug)
      : null;
    setSelectedExerciseId(restoredExercise?.id ?? null);
  }, [catalog.exercises, catalog.status, uiState.selectedSlug]);

  useEffect(() => {
    if (catalog.status !== "success") return;
    const selectedSlug = selectedExercise?.slug ?? null;
    if (uiState.selectedSlug === selectedSlug) return;
    setUiState((current) => ({ ...current, selectedSlug }));
  }, [catalog.status, selectedExercise?.slug, setUiState, uiState.selectedSlug]);
  const cardioPillarId = useMemo(
    () =>
      catalog.filterOptions.pillars.find(({ code }) => code === "cardio")?.id ??
      catalog.filterOptions.pillars[0]?.id,
    [catalog.filterOptions.pillars],
  );
  const activeFilterCount = useMemo(
    () =>
      [
        filters?.pillarId !== cardioPillarId ? filters?.pillarId : undefined,
        filters?.familyId,
        filters?.equipment,
        filters?.level,
      ].filter((value) => value !== undefined).length,
    [cardioPillarId, filters],
  );
  const hydrateVisibleExercise = useCallback(
    (exercise: { slug: string }) =>
      progressive.hydrateVisibleExercisePosters([exercise.slug]),
    [progressive.hydrateVisibleExercisePosters],
  );
  const setFiltersVisible = useCallback(
    (next: SetStateAction<boolean>) => {
      setUiState((current) => ({
        ...current,
        filtersVisible:
          typeof next === "function" ? next(current.filtersVisible) : next,
      }));
    },
    [setUiState],
  );
  const setSearchQuery = useCallback(
    (next: string) => setUiState((current) => ({ ...current, searchQuery: next })),
    [setUiState],
  );
  return {
    ...catalog,
    ...progressive,
    activeFilterCount,
    areFilterPreferencesReady: areFilterPreferencesReady && !isRestoringUiState,
    cardioPillarId,
    filters,
    filtersVisible,
    hydrateVisibleExercise,
    isLoading:
      catalog.status === "loading" ||
      !areFilterPreferencesReady ||
      isRestoringUiState,
    resetFilters: () => setFilters({ pillarId: cardioPillarId }),
    searchQuery,
    selectedExercise,
    setFilters,
    setFiltersVisible,
    setSearchQuery,
    setSelectedExerciseId: setSelectedExercise,
  };
}

function parseCatalogLibraryUiState(
  value: unknown,
): CatalogLibraryUiState | null {
  if (!value || typeof value !== "object") return null;
  const candidate = value as Partial<CatalogLibraryUiState>;
  if (
    typeof candidate.filtersVisible !== "boolean" ||
    typeof candidate.searchQuery !== "string" ||
    (candidate.selectedSlug !== null &&
      typeof candidate.selectedSlug !== "string")
  ) {
    return null;
  }
  return {
    filtersVisible: candidate.filtersVisible,
    searchQuery: candidate.searchQuery,
    selectedSlug: candidate.selectedSlug,
  };
}

export type CatalogLibraryScreenState = ReturnType<
  typeof useCatalogLibraryScreen
>;

function useDebouncedValue<TValue>(value: TValue, delayMilliseconds: number) {
  const [debouncedValue, setDebouncedValue] = useState(value);

  useEffect(() => {
    const timeout = setTimeout(
      () => setDebouncedValue(value),
      delayMilliseconds,
    );
    return () => clearTimeout(timeout);
  }, [delayMilliseconds, value]);

  return debouncedValue;
}
