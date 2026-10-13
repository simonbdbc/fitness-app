import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { ThemeProvider } from "@shared/theme";
import type { SessionFeedbackDraft } from "../domain/trainingPresentation";
import { SessionFeedbackPanel } from "./SessionFeedbackPanel";

const draft: SessionFeedbackDraft = {
  appreciationRating: 4,
  effortRating: 1,
  painLevel: "none",
  progressionPreference: "same",
  qualityRating: 5,
};

describe("SessionFeedbackPanel", () => {
  it("emits only the selected feedback field", () => {
    const onChange = vi.fn();

    render(
      <ThemeProvider>
        <SessionFeedbackPanel
          draft={draft}
          onChange={onChange}
          progressionContext="Pompes + 3x8"
        />
      </ThemeProvider>,
    );

    fireEvent.click(screen.getByRole("button", { name: "Douleur" }));
    expect(onChange).toHaveBeenCalledWith({ painLevel: "pain" });

    fireEvent.click(screen.getByRole("button", { name: "Plus difficile" }));
    expect(onChange).toHaveBeenCalledWith({
      progressionPreference: "harder",
    });
    expect(screen.queryByText("Note perso")).toBeNull();
  });
});
