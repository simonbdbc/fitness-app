import { render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";

import { ThemeProvider } from "@shared/theme";
import { buildSessionTimerPlan } from "../domain/sessionTimerPlan";
import { createSessionTimerSnapshot } from "../domain/sessionTimerSnapshot";
import { SessionTimerPanel } from "./SessionTimerPanel";

vi.mock("@shared/ui", async () => {
  const { createElement } = await import("react");

  return {
    ActionButton: ({ children }: { children: ReactNode }) =>
      createElement("button", null, children),
    Badge: ({ children }: { children: ReactNode }) =>
      createElement("span", null, children),
  };
});

describe("SessionTimerPanel", () => {
  it("shows series progress for repetition and interval formats", () => {
    const repetitionPlan = requirePlan("repetitions");
    const repetitionSnapshot = createSessionTimerSnapshot({
      elapsedSeconds: 5,
      plan: repetitionPlan,
      seriesState: {
        currentSeriesIndex: 1,
        phaseKind: "effort",
        restElapsedSeconds: 0,
      },
      sessionElapsedSeconds: 15,
      status: "running",
    });
    const callbacks = {
      onCompleteEffortPhase: vi.fn(),
      onFinish: vi.fn(),
      onReset: vi.fn(),
      onToggle: vi.fn(),
    };
    const { rerender } = render(
      <ThemeProvider>
        <SessionTimerPanel
          {...callbacks}
          isPreparing={false}
          plan={repetitionPlan}
          snapshot={repetitionSnapshot}
        />
      </ThemeProvider>,
    );

    expect(screen.getByText("Séries")).toBeInTheDocument();
    expect(screen.getByText("2/3")).toBeInTheDocument();
    expect(screen.queryByText("Phases")).toBeNull();

    const intervalPlan = requirePlan("intervalles");
    const intervalSnapshot = createSessionTimerSnapshot({
      elapsedSeconds: 15,
      plan: intervalPlan,
      sessionElapsedSeconds: 15,
      status: "running",
    });

    rerender(
      <ThemeProvider>
        <SessionTimerPanel
          {...callbacks}
          isPreparing={false}
          plan={intervalPlan}
          snapshot={intervalSnapshot}
        />
      </ThemeProvider>,
    );

    expect(screen.getByText("Séries")).toBeInTheDocument();
    expect(screen.getByText("2/3")).toBeInTheDocument();
    expect(screen.queryByText("Phases")).toBeNull();
  });
});

function requirePlan(formatType: "repetitions" | "intervalles") {
  const plan = buildSessionTimerPlan({
    format:
      formatType === "repetitions"
        ? {
            code: "panel-repetitions",
            formatType,
            label: "3 séries de 10 répétitions",
            repetitions: 10,
            restSeconds: 5,
            seriesCount: 3,
          }
        : {
            code: "panel-intervalles",
            formatType,
            intervalSeconds: 10,
            label: "3 séries de 10 secondes",
            restSeconds: 5,
            seriesCount: 3,
          },
    label: "Test panneau",
  });

  if (!plan) throw new Error("Le plan de test doit être valide.");
  return plan;
}
