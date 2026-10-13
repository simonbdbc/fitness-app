import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { ThemeProvider } from "@shared/theme";

import { ProfileSettingsCard } from "./ProfileSettingsCard";

describe("ProfileSettingsCard", () => {
  it("keeps unset values visible and emits explicit choices", () => {
    const draft: Parameters<typeof ProfileSettingsCard>[0]["draft"] = {
      availableEquipment: [],
      equipmentMode: null,
      excludedExerciseCodes: [],
      id: "user-1",
      levelTestCompletedAt: null,
      levelTestStatus: "required",
      levelTestVersion: 0,
      name: "Alex",
      objective: null,
      objectiveCode: null,
      pillarLevels: {
        cardio: null,
        proprioception: null,
        strength: null,
      },
      preferredWeekdays: [],
      restrictions: [],
      sessionMinutesMax: null,
      sessionMinutesMin: null,
      weeklyFrequency: null,
      weeklyNoveltyPercent: null,
    };
    const onChange = vi.fn();

    render(
      <ThemeProvider>
        <ProfileSettingsCard
          draft={draft}
          equipmentOptions={[]}
          hasUnsavedChanges={false}
          isProfileComplete={false}
          onCancel={vi.fn()}
          onChange={onChange}
          onRegenerate={vi.fn()}
          onSave={vi.fn()}
          regenerationMessage=""
          regenerationState={null}
          regenerationStatus="idle"
          saveState="idle"
          syncError={null}
        />
      </ThemeProvider>,
    );

    expect(screen.getAllByText("À renseigner").length).toBeGreaterThan(0);
    fireEvent.click(screen.getByRole("button", { name: "Complet" }));
    expect(onChange).toHaveBeenCalledWith(
      expect.objectContaining({
        objective: "Développer une condition physique équilibrée.",
        objectiveCode: "complete",
      }),
    );
  });
});
