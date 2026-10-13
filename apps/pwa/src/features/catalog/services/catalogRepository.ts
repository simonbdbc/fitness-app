import { withDatabase } from "@shared/db";

import { catalogSeedFromSnapshot } from "../domain/catalogSnapshot";
import {
  queryCatalogAdminSnapshot,
  queryCatalogEquipmentUsage,
  queryCatalogExercises,
  queryCatalogFilterOptions,
  queryCatalogFormats,
  queryCatalogTimerOptions,
} from "../infrastructure/catalogReadRepository";
import type {
  CatalogAdminSnapshot,
  CatalogEquipmentUsage,
  CatalogExercise,
  CatalogFilterOptions,
  CatalogFilters,
  CatalogFormat,
  CatalogSeed,
  CatalogTimerOptions,
} from "../types";
import {
  resolveCatalogLibraryScopeWithDatabase,
  type CatalogLibraryScope,
} from "./catalogLibraryScope";
import { ensureCatalogReady } from "./catalogLifecycle";

export {
  deleteCatalogEquipmentLocal,
  upsertCatalogEquipmentLocal,
} from "./catalogEquipmentRepository";
export {
  deleteCatalogExerciseLocal,
  reviewCatalogReleaseExercisesLocal,
  upsertCatalogExerciseLocal,
  type CatalogExerciseReviewBatch,
} from "./catalogExerciseRepository";
export {
  deleteCatalogFormatLocal,
  deleteCatalogIntervalLocal,
  deleteCatalogRepetitionLocal,
  deleteCatalogRestLocal,
  deleteCatalogSeriesLocal,
  upsertCatalogFormatLocal,
  upsertCatalogIntervalLocal,
  upsertCatalogRepetitionLocal,
  upsertCatalogRestLocal,
  upsertCatalogSeriesLocal,
} from "./catalogFormatRepository";
export {
  downloadCompleteCatalogLibrary,
  acceptPendingCatalogReleaseUpdate,
  ensureCatalogExerciseDetails,
  ensureCatalogLibraryIndex,
  getPendingCatalogReleaseUpdate,
  replaceLocalCatalogCacheFromSnapshot,
  syncCatalogFromRemoteNow,
  checkCatalogReleaseUpdate,
} from "./catalogLifecycle";
export {
  activateCatalogRelease,
  inspectCatalogReleaseActivation,
  listCatalogReleases,
  rollbackCatalogReleaseActivation,
  CatalogReleaseActivationError,
  type CatalogReleaseActivationCheck,
  type CatalogReleaseActivationEvidence,
  type CatalogReleaseActivationIssue,
  type CatalogReleaseRollbackResult,
} from "./catalogReleaseActivation";
export {
  deleteCatalogSessionTemplateLevelLocal,
  deleteCatalogSessionTemplateLocal,
  upsertCatalogSessionTemplateLevelLocal,
  upsertCatalogSessionTemplateLocal,
} from "./catalogSessionRepository";

export async function listCatalogExercises(
  filters: CatalogFilters = {},
): Promise<CatalogExercise[]> {
  await ensureCatalogReady();
  return queryCatalogExercises(filters);
}

export async function listCatalogFilterOptions(): Promise<CatalogFilterOptions> {
  await ensureCatalogReady();
  return queryCatalogFilterOptions();
}

export async function loadCatalogLibrary(
  filters: CatalogFilters = {},
): Promise<{
  exercises: CatalogExercise[];
  filterOptions: CatalogFilterOptions;
  scope: CatalogLibraryScope;
}> {
  await ensureCatalogReady();
  const scope = await withDatabase(resolveCatalogLibraryScopeWithDatabase);
  const [exercises, filterOptions] = await Promise.all([
    queryCatalogExercises(filters, scope.releaseCode),
    queryCatalogFilterOptions(scope.releaseCode),
  ]);

  return { exercises, filterOptions, scope };
}

/** Loads the release-scoped controls without querying the exercise list. */
export async function loadCatalogLibraryFilterOptions(): Promise<{
  filterOptions: CatalogFilterOptions;
  scope: CatalogLibraryScope;
}> {
  await ensureCatalogReady();
  const scope = await withDatabase(resolveCatalogLibraryScopeWithDatabase);
  const filterOptions = await queryCatalogFilterOptions(scope.releaseCode);
  return { filterOptions, scope };
}

export async function listCatalogEquipmentUsage(): Promise<
  CatalogEquipmentUsage[]
> {
  await ensureCatalogReady();
  return queryCatalogEquipmentUsage();
}

export async function getLocalCatalogAdminSnapshot(): Promise<CatalogAdminSnapshot> {
  await ensureCatalogReady();
  return queryCatalogAdminSnapshot();
}

export async function listCatalogTimerOptions(): Promise<CatalogTimerOptions> {
  await ensureCatalogReady();
  return queryCatalogTimerOptions();
}

export async function listCatalogFormats(): Promise<CatalogFormat[]> {
  await ensureCatalogReady();
  return queryCatalogFormats();
}

export async function exportLocalCatalogSeedSnapshot(): Promise<CatalogSeed> {
  const snapshot = await getLocalCatalogAdminSnapshot();
  return catalogSeedFromSnapshot(snapshot);
}
