import type { CatalogSeed } from "../types";
export const maxDetailsPerRequest = 6;
export async function fetchActiveCatalogIndex(): Promise<CatalogSeed> {
  throw new Error("La démonstration utilise uniquement les six exercices locaux.");
}
export async function fetchActiveCatalogDetails(_slugs: readonly string[]): Promise<CatalogSeed> {
  throw new Error("La démonstration utilise uniquement les six exercices locaux.");
}
