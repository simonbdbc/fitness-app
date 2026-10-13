import AsyncStorage from "@react-native-async-storage/async-storage";
import { useEffect, useMemo, useRef, useState } from "react";

import {
  displaySessionStorageKey,
  enqueueAsyncStorageOperation,
  waitForAsyncStorageOperation,
} from "@shared/persistence";

import type {
  CatalogEquipmentFilter,
  CatalogFilterOptions,
  CatalogFilters,
} from "../types";

const storageVersion = 1;

type StoredCatalogFilterPreferences = {
  version: typeof storageVersion;
  pillarCode: string | null;
  familyCode: string | null;
  equipment: CatalogEquipmentFilter | null;
  level: number | null;
};

export function useCatalogFilterPreferences(
  userId: string | null | undefined,
  filterOptions: CatalogFilterOptions,
) {
  const [filters, setFilters] = useState<CatalogFilters | null>(null);
  const restoredScopeRef = useRef<string | null>(null);
  const storageKey = userId
    ? displaySessionStorageKey(userId, "route:library:filters")
    : null;
  const optionScope = useMemo(
    () =>
      JSON.stringify({
        equipment: filterOptions.equipment.map(({ code }) => code),
        families: filterOptions.families.map(({ code }) => code),
        levels: filterOptions.levels,
        pillars: filterOptions.pillars.map(({ code }) => code),
      }),
    [filterOptions],
  );

  useEffect(() => {
    if (!storageKey || filterOptions.pillars.length === 0) {
      setFilters(null);
      return;
    }

    const restorationScope = `${storageKey}:${optionScope}`;
    if (restoredScopeRef.current === restorationScope) return;
    let active = true;
    restoredScopeRef.current = restorationScope;

    void waitForAsyncStorageOperation(storageKey)
      .then(() => AsyncStorage.getItem(storageKey))
      .then((stored) => {
        const preferences = parseStoredCatalogFilterPreferences(stored);
        const nextFilters = resolveCatalogFilterPreferences(
          preferences,
          filterOptions,
        );
        if (active) setFilters(nextFilters);
      })
      .catch(() => {
        if (active) {
          setFilters(resolveCatalogFilterPreferences(null, filterOptions));
        }
      });

    return () => {
      active = false;
    };
  }, [filterOptions, optionScope, storageKey]);

  useEffect(() => {
    if (!storageKey || !filters) return;
    void enqueueAsyncStorageOperation(
      storageKey,
      () =>
        AsyncStorage.setItem(
          storageKey,
          JSON.stringify(serializeCatalogFilterPreferences(filters, filterOptions)),
        ),
      "catalog-filter-preferences-persist",
      { storageKey },
    );
  }, [filterOptions, filters, storageKey]);

  return {
    filters,
    isReady: filters !== null,
    setFilters,
  };
}

export function resolveCatalogFilterPreferences(
  preferences: StoredCatalogFilterPreferences | null,
  filterOptions: CatalogFilterOptions,
): CatalogFilters {
  const fallbackPillar =
    filterOptions.pillars.find(({ code }) => code === "cardio") ??
    filterOptions.pillars[0];
  const pillar =
    filterOptions.pillars.find(
      ({ code }) => code === preferences?.pillarCode,
    ) ?? fallbackPillar;
  const family = filterOptions.families.find(
    ({ code }) => code === preferences?.familyCode,
  );
  const storedEquipment = preferences?.equipment ?? undefined;
  const equipment = isValidEquipmentFilter(storedEquipment, filterOptions)
    ? storedEquipment
    : undefined;
  const storedLevel = preferences?.level ?? undefined;
  const level = filterOptions.levels.includes(storedLevel ?? Number.NaN)
    ? storedLevel
    : undefined;

  return {
    equipment,
    familyId: family?.id,
    level,
    pillarId: pillar?.id,
  };
}

export function serializeCatalogFilterPreferences(
  filters: CatalogFilters,
  filterOptions: CatalogFilterOptions,
): StoredCatalogFilterPreferences {
  return {
    equipment: filters.equipment ?? null,
    familyCode:
      filterOptions.families.find(({ id }) => id === filters.familyId)?.code ??
      null,
    level: filters.level ?? null,
    pillarCode:
      filterOptions.pillars.find(({ id }) => id === filters.pillarId)?.code ??
      null,
    version: storageVersion,
  };
}

function parseStoredCatalogFilterPreferences(
  value: string | null,
): StoredCatalogFilterPreferences | null {
  if (!value) return null;

  try {
    const parsed: unknown = JSON.parse(value);
    if (!isStoredCatalogFilterPreferences(parsed)) return null;
    return parsed;
  } catch {
    return null;
  }
}

function isStoredCatalogFilterPreferences(
  value: unknown,
): value is StoredCatalogFilterPreferences {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Partial<StoredCatalogFilterPreferences>;
  return (
    candidate.version === storageVersion &&
    (candidate.pillarCode === null || typeof candidate.pillarCode === "string") &&
    (candidate.familyCode === null || typeof candidate.familyCode === "string") &&
    (candidate.level === null || typeof candidate.level === "number") &&
    (candidate.equipment === null || isStoredEquipmentFilter(candidate.equipment))
  );
}

function isStoredEquipmentFilter(value: unknown): value is CatalogEquipmentFilter {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Partial<CatalogEquipmentFilter>;
  return (
    candidate.kind === "bodyweight" ||
    (candidate.kind === "equipment" && typeof candidate.equipmentCode === "string")
  );
}

function isValidEquipmentFilter(
  equipment: CatalogEquipmentFilter | undefined,
  filterOptions: CatalogFilterOptions,
) {
  if (!equipment) return false;
  if (equipment.kind === "bodyweight") return filterOptions.hasBodyweightOption;
  return filterOptions.equipment.some(
    ({ code }) => code === equipment.equipmentCode,
  );
}
