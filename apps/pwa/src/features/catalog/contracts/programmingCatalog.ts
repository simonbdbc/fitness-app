import type { CatalogAdminSnapshot } from "../types";

export type CatalogProgrammingSnapshot = Pick<
  CatalogAdminSnapshot,
  "exercises" | "formats" | "sessionTemplates"
>;

export type CatalogProgrammingPort = {
  loadSnapshot: () => Promise<CatalogProgrammingSnapshot>;
};
