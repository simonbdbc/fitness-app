import {
  displaySessionStorageKey,
  usePersistentScreenState,
} from "@shared/persistence";

import type {
  AdminCatalogStructureSection,
  CatalogItemDraft,
  FormatDraft,
  PillarFilter,
  SessionDraft,
} from "../domain/adminCatalogStructure";

export function useAdminCatalogStructureUiState(
  userId: string | null | undefined,
  section: AdminCatalogStructureSection,
) {
  const { setValue, value } = usePersistentScreenState({
    initialValue: {
      catalogItemDraft: null as CatalogItemDraft | null,
      formatDraft: null as FormatDraft | null,
      pillarFilter: "all" as PillarFilter,
      sessionDraft: null as SessionDraft | null,
    },
    parse: parseStructureUiState,
    storageKey: userId
      ? displaySessionStorageKey(userId, `route:admin-structure:${section}`)
      : null,
  });

  return {
    ...value,
    setCatalogItemDraft: (next: CatalogItemDraft | null) =>
      setValue((current) => ({ ...current, catalogItemDraft: next })),
    setFormatDraft: (next: FormatDraft | null) =>
      setValue((current) => ({ ...current, formatDraft: next })),
    setPillarFilter: (next: PillarFilter) =>
      setValue((current) => ({ ...current, pillarFilter: next })),
    setSessionDraft: (next: SessionDraft | null) =>
      setValue((current) => ({ ...current, sessionDraft: next })),
  };
}

function parseStructureUiState(value: unknown) {
  if (!value || typeof value !== "object") return null;
  const candidate = value as Partial<{
    catalogItemDraft: CatalogItemDraft | null;
    formatDraft: FormatDraft | null;
    pillarFilter: PillarFilter;
    sessionDraft: SessionDraft | null;
  }>;
  if (
    typeof candidate.pillarFilter !== "string" ||
    !isNullableObject(candidate.sessionDraft) ||
    !isNullableObject(candidate.formatDraft) ||
    !isNullableObject(candidate.catalogItemDraft)
  ) {
    return null;
  }
  return {
    catalogItemDraft: candidate.catalogItemDraft as CatalogItemDraft | null,
    formatDraft: candidate.formatDraft as FormatDraft | null,
    pillarFilter: candidate.pillarFilter,
    sessionDraft: candidate.sessionDraft as SessionDraft | null,
  };
}

function isNullableObject(value: unknown) {
  return value === null || (typeof value === "object" && value !== undefined);
}
