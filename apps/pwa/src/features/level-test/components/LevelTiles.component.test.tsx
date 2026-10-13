import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { ThemeProvider } from "@shared/theme";

vi.mock("@features/programming", () => ({
  acreaPillarLabels: {
    cardio: "Cardio",
    proprioception: "Proprioception",
    strength: "Renforcement",
  },
}));

describe("LevelTiles", () => {
  it("renders complete pillar names and levels", async () => {
    const { completePillarLevels, LevelTiles } = await import("./LevelTiles");
    const levels = { cardio: 3, proprioception: 4, strength: 2 } as const;

    render(
      <ThemeProvider>
        <LevelTiles levels={levels} />
      </ThemeProvider>,
    );

    expect(screen.getByText("Renforcement")).toBeTruthy();
    expect(screen.getByText("Cardio")).toBeTruthy();
    expect(screen.getByText("Proprioception")).toBeTruthy();
    expect(completePillarLevels(levels)).toEqual(levels);
    expect(
      completePillarLevels({ ...levels, cardio: null }),
    ).toBeNull();
  });
});
