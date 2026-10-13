import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { ThemeProvider } from "@shared/theme";

import { TrainingWeekSummary } from "./TrainingWeekSummary";

const profile: Parameters<typeof TrainingWeekSummary>[0]["profile"] = {
  availableEquipment: [],
  equipmentMode: "aucun",
  excludedExerciseCodes: [],
  id: "user-1",
  levelTestCompletedAt: "2026-07-19T10:00:00Z",
  levelTestStatus: "completed",
  levelTestVersion: 3,
  name: "Alex",
  objective: "Développer une condition physique équilibrée.",
  objectiveCode: "complete",
  pillarLevels: { cardio: 3, proprioception: 4, strength: 2 },
  preferredWeekdays: [1, 3],
  restrictions: [],
  sessionMinutesMax: 45,
  sessionMinutesMin: 30,
  weeklyFrequency: 2,
  weeklyNoveltyPercent: 40,
};

const weekPlan: Parameters<typeof TrainingWeekSummary>[0]["weekPlan"] = {
  catalogVersion: "test",
  generatedBy: "test",
  isoWeekNumber: 30,
  isoWeekYear: 2026,
  role: "Membre",
  schemaVersion: 3,
  trainings: [
    training("T1", "terminee"),
    training("T2", "a faire"),
  ],
  validationFocus: "Technique contrôlée",
};

describe("TrainingWeekSummary", () => {
  it("renders progress and full pillar levels", () => {
    render(
      <ThemeProvider>
        <TrainingWeekSummary profile={profile} weekPlan={weekPlan} />
      </ThemeProvider>,
    );

    expect(screen.getByText("1/2")).toBeTruthy();
    expect(screen.getByText("Niveau 2")).toBeTruthy();
    expect(screen.getByText("Niveau 3")).toBeTruthy();
    expect(screen.getByText("Niveau 4")).toBeTruthy();
  });
});

function training(
  code: "T1" | "T2",
  status: "a faire" | "terminee",
): Parameters<
  typeof TrainingWeekSummary
>[0]["weekPlan"]["trainings"][number] {
  return {
    code,
    day: code === "T1" ? "Lundi" : "Mercredi",
    dominantPillar: code === "T1" ? "strength" : "cardio",
    durationMinutes: 35,
    scheduledDate: code === "T1" ? "2026-07-20" : "2026-07-22",
    seances: [],
    status,
    title: `Séance ${code}`,
  };
}
