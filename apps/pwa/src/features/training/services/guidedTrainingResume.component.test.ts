import AsyncStorage from "@react-native-async-storage/async-storage";
import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  readGuidedTrainingResume,
  writeGuidedTrainingResume,
} from "./guidedTrainingResume";
import {
  readGuidedTrainingFeedbackResume,
  writeGuidedTrainingFeedbackResume,
} from "./guidedTrainingFeedbackResume";

describe("guided training AsyncStorage resume", () => {
  const storedValues = new Map<string, string>();

  beforeEach(() => {
    storedValues.clear();
    vi.mocked(AsyncStorage.getItem).mockImplementation(async (key) =>
      storedValues.get(key) ?? null,
    );
    vi.mocked(AsyncStorage.setItem).mockImplementation(async (key, value) => {
      storedValues.set(key, value);
    });
    vi.mocked(AsyncStorage.removeItem).mockImplementation(async (key) => {
      storedValues.delete(key);
    });
  });

  it("restores the current training and session after queued writes", async () => {
    await writeGuidedTrainingResume("user-a", {
      planKey: "week-32",
      sessionIndex: 3,
      trainingCode: "training-cardio",
    });

    expect(await readGuidedTrainingResume("user-a", "week-32")).toMatchObject({
      planKey: "week-32",
      sessionIndex: 3,
      trainingCode: "training-cardio",
      version: 1,
    });
  });

  it("restores feedback drafts through AsyncStorage", async () => {
    await writeGuidedTrainingFeedbackResume("user-a:week-32:training-cardio", {
      drafts: {
        sessionA: {
          appreciationRating: 4,
          effortRating: 3,
          painLevel: "none",
          progressionPreference: "harder",
          qualityRating: 4,
        },
      },
      savedSessionIds: ["sessionA"],
    });

    expect(
      await readGuidedTrainingFeedbackResume("user-a:week-32:training-cardio"),
    ).toMatchObject({
      drafts: { sessionA: { appreciationRating: 4 } },
      savedSessionIds: ["sessionA"],
    });
  });
});
