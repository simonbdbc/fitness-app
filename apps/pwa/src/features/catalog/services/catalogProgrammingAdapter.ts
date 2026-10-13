import type { CatalogProgrammingPort } from "../contracts/programmingCatalog";
import { getLocalCatalogAdminSnapshot } from "./catalogRepository";

export const localCatalogProgrammingPort: CatalogProgrammingPort = {
  loadSnapshot: getLocalCatalogAdminSnapshot,
};
