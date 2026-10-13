import { describe, expect, it } from "vitest";

import {
  createEmptyACREAProfile,
  isACREAProfileComplete,
  type ACREAProfileState,
} from "./acreaSeed";

describe("ACREA profile initialization", () => {
  it("creates the user profile without inventing preferences or levels", () => {
    const profile = createEmptyACREAProfile({
      id: "user-1",
      name: "Simon",
    });

    expect(profile).toMatchObject({
      id: "user-1",
      name: "Simon",
      objective: null,
      objectiveCode: null,
      equipmentMode: null,
      weeklyFrequency: null,
      sessionMinutesMin: null,
      sessionMinutesMax: null,
      weeklyNoveltyPercent: null,
      pillarLevels: {
        strength: null,
        cardio: null,
        proprioception: null,
      },
      availableEquipment: [],
      preferredWeekdays: [],
      restrictions: [],
    });
    expect(isACREAProfileComplete(profile)).toBe(false);
  });

  it("accepts a profile only after explicit settings and evaluated levels", () => {
    const profile: ACREAProfileState = {
      ...createEmptyACREAProfile({ id: "user-2", name: "Alex" }),
      objective: "Développer une condition physique équilibrée.",
      objectiveCode: "complete",
      equipmentMode: "aucun",
      weeklyFrequency: 3,
      sessionMinutesMin: 30,
      sessionMinutesMax: 45,
      weeklyNoveltyPercent: 50,
      pillarLevels: {
        strength: 3,
        cardio: 2,
        proprioception: 4,
      },
      preferredWeekdays: [1, 3, 5],
    };

    expect(isACREAProfileComplete(profile)).toBe(true);
  });
});
