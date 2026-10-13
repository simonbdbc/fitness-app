import { describe, expect, it } from "vitest";

import type { CatalogExercise } from "../types";
import { resolveSelectedCatalogExercise } from "../domain/catalogSelection";

describe("catalog detail selection", () => {
  it("uses the current active snapshot row instead of a stale exercise object", () => {
    const previous = { id: 42, name: "Ancienne fiche" } as CatalogExercise;
    const current = { id: 42, name: "Fiche active" } as CatalogExercise;

    expect(resolveSelectedCatalogExercise([current], previous.id)).toBe(
      current,
    );
  });

  it("closes the detail when rollback removes the selected exercise", () => {
    expect(resolveSelectedCatalogExercise([], 42)).toBeNull();
    expect(resolveSelectedCatalogExercise([], null)).toBeNull();
  });
});
