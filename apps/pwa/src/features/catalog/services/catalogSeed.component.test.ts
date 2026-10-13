// @vitest-environment node

import { describe, expect, it } from "vitest";

import {
  exerciseLibraryExerciseCount,
  exerciseLibrarySessionTemplateLevelSeeds,
  exerciseLibrarySessionTemplateSeeds,
} from "../data/exerciseLibrarySeed";
import { getLocalCatalogSeed } from "./catalogSeed";

describe("progressive local catalog seed", () => {
  it("ships only the offline evaluation core", () => {
    const seed = getLocalCatalogSeed();
    const exerciseCodes = new Set(seed.exercises.map((exercise) => exercise.code));
    const templateCodes = new Set(seed.sessionTemplates.map((template) => template.code));

    expect(exerciseLibraryExerciseCount).toBe(6);
    expect(seed.exercises).toHaveLength(6);
    expect(seed.sessionTemplates).toEqual([]);
    expect(seed.sessionTemplateLevels).toEqual([]);
    expect(exerciseLibrarySessionTemplateSeeds).toEqual([]);
    expect(exerciseLibrarySessionTemplateLevelSeeds).toEqual([]);
    expect(
      seed.sessionTemplates.every((template) => exerciseCodes.has(template.exerciseCode)),
    ).toBe(true);
    expect(
      seed.sessionTemplateLevels.every((level) =>
        templateCodes.has(level.sessionTemplateCode),
      ),
    ).toBe(true);
  });
});
