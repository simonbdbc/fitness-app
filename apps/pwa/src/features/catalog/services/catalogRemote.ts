import type { CatalogAdminSnapshot, CatalogExerciseResponse } from "../types";
export type { CatalogAdminSnapshot } from "../types";
// Shared domain adapter: this public demonstration has no remote catalogue.
export async function fetchCatalogAdminSnapshot(): Promise<CatalogAdminSnapshot> {
  throw new Error("Le catalogue de démonstration est local et limité à six exercices.");
}
export async function fetchCatalogExercises(): Promise<CatalogExerciseResponse> {
  throw new Error("Le catalogue de démonstration est local et limité à six exercices.");
}
