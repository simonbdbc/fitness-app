import { queryCatalogExercises } from "../infrastructure/catalogReadRepository";
import type { CatalogExercise } from "../types";
import { ensureCatalogReady } from "./catalogLifecycle";
import type { CatalogLibraryScope } from "./catalogLibraryScope";

/** Reads only rows changed by progressive detail or media hydration. */
export async function loadCatalogLibraryExercisesBySlugs(
  slugs: readonly string[],
  scope: CatalogLibraryScope,
): Promise<CatalogExercise[]> {
  await ensureCatalogReady();
  return queryCatalogExercises({}, scope.releaseCode, slugs);
}
