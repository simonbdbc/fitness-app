import { type SetStateAction } from "react";

import {
  displaySessionStorageKey,
  usePersistentScreenState,
} from "@shared/persistence";

export type EquipmentDraft = {
  id: number | null;
  code: string;
  label: string;
  category: "maison" | "sport";
};

export const emptyEquipmentDraft: EquipmentDraft = {
  id: null,
  code: "",
  label: "",
  category: "sport",
};

export const stableEquipmentCodePattern = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export function useAdminCatalogEquipmentUiState(
  userId: string | null | undefined,
) {
  const { setValue, value } = usePersistentScreenState({
    initialValue: { draft: null as EquipmentDraft | null, search: "" },
    parse: parseEquipmentUiState,
    storageKey: userId
      ? displaySessionStorageKey(userId, "route:admin-equipment")
      : null,
  });

  return {
    ...value,
    setDraft: (next: SetStateAction<EquipmentDraft | null>) =>
      setValue((current) => ({
        ...current,
        draft: typeof next === "function" ? next(current.draft) : next,
      })),
    setSearch: (next: string) =>
      setValue((current) => ({ ...current, search: next })),
  };
}

function parseEquipmentUiState(value: unknown) {
  if (!value || typeof value !== "object") return null;
  const candidate = value as Partial<{
    draft: EquipmentDraft | null;
    search: string;
  }>;
  if (typeof candidate.search !== "string") return null;
  if (candidate.draft === null) return { draft: null, search: candidate.search };
  if (!candidate.draft || typeof candidate.draft !== "object") return null;
  const draft = candidate.draft as Partial<EquipmentDraft>;
  if (
    (draft.id !== null && typeof draft.id !== "number") ||
    typeof draft.code !== "string" ||
    typeof draft.label !== "string" ||
    (draft.category !== "maison" && draft.category !== "sport")
  ) {
    return null;
  }
  return {
    draft: {
      category: draft.category,
      code: draft.code,
      id: draft.id,
      label: draft.label,
    },
    search: candidate.search,
  };
}
