import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { ThemeProvider } from "@shared/theme";

import { LevelEvaluationFeedbackPanel } from "./LevelEvaluationFeedbackPanel";

describe("LevelEvaluationFeedbackPanel", () => {
  it("collects only technical validation, appreciation and the strict maximum", () => {
    const onChange = vi.fn();
    render(
      <ThemeProvider>
        <LevelEvaluationFeedbackPanel
          draft={{
            appreciationRating: null,
            maximumRepetitions: "",
            technicalValid: null,
          }}
          isMaximumPhase
          onChange={onChange}
        />
      </ThemeProvider>,
    );

    fireEvent.click(screen.getByRole("button", { name: "Technique validée" }));
    fireEvent.click(screen.getByRole("button", { name: "4" }));
    fireEvent.change(screen.getByLabelText("Maximum de répétitions strictes"), {
      target: { value: "12" },
    });

    expect(onChange).toHaveBeenCalledWith({ technicalValid: true });
    expect(onChange).toHaveBeenCalledWith({ appreciationRating: 4 });
    expect(onChange).toHaveBeenCalledWith({ maximumRepetitions: "12" });
    expect(screen.queryByText("Douleur")).toBeNull();
    expect(screen.queryByText("Progression")).toBeNull();
    expect(screen.queryByText("Note perso")).toBeNull();
  });
});
