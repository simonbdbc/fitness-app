import { describe, expect, it } from "vitest";

import {
  resolveCatalogFilterPreferences,
  serializeCatalogFilterPreferences,
} from "./useCatalogFilterPreferences";
import type { CatalogFilterOptions } from "../types";

const filterOptions: CatalogFilterOptions = {
  equipment: [
    { category: "maison", code: "haltères", id: 7, label: "Haltères" },
  ],
  families: [
    { code: "endurance", id: 3, label: "Endurance" },
    { code: "mobilite", id: 4, label: "Mobilité" },
  ],
  hasBodyweightOption: true,
  levels: [1, 2, 3],
  muscleGroups: [],
  pillars: [
    { code: "strength", id: 1, label: "Renforcement" },
    { code: "cardio", id: 2, label: "Cardio" },
  ],
  types: [],
};

describe("catalog filter preferences", () => {
  it("defaults to cardio and never falls back to an unfiltered pillar", () => {
    expect(resolveCatalogFilterPreferences(null, filterOptions)).toEqual({
      equipment: undefined,
      familyId: undefined,
      level: undefined,
      pillarId: 2,
    });
  });

  it("stores codes and drops only stale choices after an index update", () => {
    const stored = serializeCatalogFilterPreferences(
      {
        equipment: { equipmentCode: "haltères", kind: "equipment" },
        familyId: 3,
        level: 2,
        pillarId: 2,
      },
      filterOptions,
    );
    expect(stored).toMatchObject({
      familyCode: "endurance",
      pillarCode: "cardio",
      version: 1,
    });

    expect(
      resolveCatalogFilterPreferences(
        { ...stored, familyCode: "supprime", level: 42 },
        filterOptions,
      ),
    ).toEqual({
      equipment: { equipmentCode: "haltères", kind: "equipment" },
      familyId: undefined,
      level: undefined,
      pillarId: 2,
    });
  });
});
