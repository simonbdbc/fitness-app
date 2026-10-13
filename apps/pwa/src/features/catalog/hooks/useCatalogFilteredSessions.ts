import { useMemo } from "react";

import type { PillarFilter } from "../domain/adminCatalogStructure";
import type { CatalogAdminSnapshot } from "../services/catalogRemote";

export function useCatalogFilteredSessions(
  snapshot: CatalogAdminSnapshot | null,
  pillarFilter: PillarFilter,
) {
  return useMemo(() => {
    if (!snapshot) return [];
    return snapshot.sessionTemplates.filter(
      (session) => pillarFilter === "all" || session.pillarId === pillarFilter,
    );
  }, [pillarFilter, snapshot]);
}
