import { act, render, screen, waitFor } from "@testing-library/react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import type { EffectCallback, ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { ThemeProvider } from "@shared/theme";
import type { CatalogTimerOptions } from "@features/catalog";

const focus = vi.hoisted(() => ({ callback: null as EffectCallback | null }));
const listCatalogTimerOptions = vi.hoisted(() => vi.fn());
const useSessionTimerController = vi.hoisted(() => vi.fn());

vi.mock("@features/auth", () => ({
  useAuth: () => ({ user: { id: "user-a" } }),
}));

vi.mock("../hooks/useTimerScreenFocusEffect", async () => {
  const { useEffect } = await import("react");

  return {
    useTimerScreenFocusEffect(callback: EffectCallback) {
      useEffect(() => {
        focus.callback = callback;
        return callback();
      }, [callback]);
    },
  };
});

vi.mock("@features/catalog", () => ({ listCatalogTimerOptions }));

vi.mock("@shared/ui", async () => {
  const { createElement } = await import("react");

  return {
    ActionButton: ({ children }: { children: ReactNode }) =>
      createElement("button", null, children),
    Badge: ({ children }: { children: ReactNode }) =>
      createElement("span", null, children),
    BodyText: ({ children }: { children: ReactNode }) =>
      createElement("p", null, children),
    Card: ({ children }: { children: ReactNode }) =>
      createElement("section", null, children),
    CardHeader: ({
      description,
      title,
    }: {
      description: string;
      title: string;
    }) => createElement("header", null, title, description),
    TitleText: ({ children }: { children: ReactNode }) =>
      createElement("h1", null, children),
  };
});

vi.mock("../hooks/useSessionTimerController", () => ({
  useSessionTimerController,
}));

const initialOptions: CatalogTimerOptions = {
  intervals: [
    {
      code: "interval-60s",
      effortSeconds: 60,
      id: 1,
      label: "60 secondes",
      updatedAt: "2026-07-16T00:00:00.000Z",
    },
  ],
  repetitions: [
    {
      code: "reps-10",
      id: 1,
      label: "10 répétitions",
      reps: 10,
      updatedAt: "2026-07-16T00:00:00.000Z",
    },
  ],
  rests: [
    {
      code: "rest-60s",
      id: 1,
      label: "60 secondes",
      restSeconds: 60,
      updatedAt: "2026-07-16T00:00:00.000Z",
    },
  ],
  series: [
    {
      code: "series-03",
      id: 1,
      label: "3 séries",
      series: 3,
      updatedAt: "2026-07-16T00:00:00.000Z",
    },
  ],
};

describe("TimerScreen", () => {
  beforeEach(() => {
    focus.callback = null;
    listCatalogTimerOptions.mockReset();
    useSessionTimerController.mockReset();
    useSessionTimerController.mockReturnValue({
      completeEffortPhase: vi.fn(),
      finish: vi.fn(),
      isPreparing: false,
      isRestoring: false,
      reset: vi.fn(),
      snapshot: null,
      status: "idle",
      toggle: vi.fn(),
    });
    vi.mocked(AsyncStorage.getItem).mockResolvedValue(null);
    vi.mocked(AsyncStorage.setItem).mockResolvedValue(undefined);
  });

  it("reloads SQLite options when the screen regains focus", async () => {
    const { TimerScreen } = await import("./TimerScreen");

    listCatalogTimerOptions
      .mockResolvedValueOnce(initialOptions)
      .mockResolvedValueOnce({
        ...initialOptions,
        rests: [
          ...initialOptions.rests,
          {
            code: "rest-90s",
            id: 2,
            label: "90 secondes",
            restSeconds: 90,
            updatedAt: "2026-07-16T00:01:00.000Z",
          },
        ],
      });

    render(
      <ThemeProvider>
        <TimerScreen />
      </ThemeProvider>,
    );

    await screen.findByRole("button", { name: "60 secondes" });
    expect(screen.queryByRole("button", { name: "90 secondes" })).toBeNull();

    await act(async () => {
      focus.callback?.();
    });

    await waitFor(() =>
      expect(
        screen.getByRole("button", { name: "90 secondes" }),
      ).toBeInTheDocument(),
    );
    expect(listCatalogTimerOptions).toHaveBeenCalledTimes(2);
  });

  it("restores the user's last catalog configuration before building the timer", async () => {
    const restoredOptions: CatalogTimerOptions = {
      intervals: [
        ...initialOptions.intervals,
        {
          code: "interval-30s",
          effortSeconds: 30,
          id: 2,
          label: "30 secondes d’effort",
          updatedAt: "2026-07-16T00:01:00.000Z",
        },
      ],
      repetitions: [
        ...initialOptions.repetitions,
        {
          code: "reps-05",
          id: 2,
          label: "5 répétitions",
          reps: 5,
          updatedAt: "2026-07-16T00:01:00.000Z",
        },
      ],
      rests: [
        ...initialOptions.rests,
        {
          code: "rest-30s",
          id: 2,
          label: "30 secondes de repos",
          restSeconds: 30,
          updatedAt: "2026-07-16T00:01:00.000Z",
        },
      ],
      series: [
        ...initialOptions.series,
        {
          code: "series-01",
          id: 2,
          label: "1 série",
          series: 1,
          updatedAt: "2026-07-16T00:01:00.000Z",
        },
      ],
    };
    listCatalogTimerOptions.mockResolvedValue(restoredOptions);
    vi.mocked(AsyncStorage.getItem).mockImplementation(async (key) =>
      key === "acrea-fitness.timer-screen.v1:user-a"
        ? JSON.stringify({
            formatType: "intervalles",
            intervalCode: "interval-30s",
            repetitionCode: "reps-05",
            restCode: "rest-30s",
            seriesCode: "series-01",
            updatedAt: "2026-07-16T00:02:00.000Z",
            version: 1,
          })
        : null,
    );
    const { TimerScreen } = await import("./TimerScreen");

    render(
      <ThemeProvider>
        <TimerScreen />
      </ThemeProvider>,
    );

    await screen.findByText(
      "1 série · 30 secondes d’effort · 30 secondes de repos",
    );
    await waitFor(() =>
      expect(useSessionTimerController).toHaveBeenLastCalledWith(
        expect.objectContaining({
          id: "timer-series-01-interval-30s-rest-30s",
          mode: "intervals",
        }),
        "timer:user-a:standalone",
      ),
    );
    expect(AsyncStorage.setItem).toHaveBeenCalledWith(
      "acrea-fitness.timer-screen.v1:user-a",
      expect.stringContaining('"formatType":"intervalles"'),
    );
  });

  it("falls back to available catalog values when saved codes disappeared", async () => {
    listCatalogTimerOptions.mockResolvedValue(initialOptions);
    vi.mocked(AsyncStorage.getItem).mockResolvedValue(
      JSON.stringify({
        formatType: "intervalles",
        intervalCode: "interval-deleted",
        repetitionCode: "repetition-deleted",
        restCode: "rest-deleted",
        seriesCode: "series-deleted",
        updatedAt: "2026-07-16T00:02:00.000Z",
        version: 1,
      }),
    );
    const { TimerScreen } = await import("./TimerScreen");

    render(
      <ThemeProvider>
        <TimerScreen />
      </ThemeProvider>,
    );

    await screen.findByText("3 séries · 60 secondes · 60 secondes");
    await waitFor(() =>
      expect(useSessionTimerController).toHaveBeenLastCalledWith(
        expect.objectContaining({
          id: "timer-series-03-interval-60s-rest-60s",
        }),
        "timer:user-a:standalone",
      ),
    );
  });

  it("shows a restoration state while the saved progression is loading", async () => {
    listCatalogTimerOptions.mockResolvedValue(initialOptions);
    useSessionTimerController.mockReturnValue({
      completeEffortPhase: vi.fn(),
      finish: vi.fn(),
      isPreparing: false,
      isRestoring: true,
      reset: vi.fn(),
      snapshot: null,
      status: "idle",
      toggle: vi.fn(),
    });
    const { TimerScreen } = await import("./TimerScreen");

    render(
      <ThemeProvider>
        <TimerScreen />
      </ThemeProvider>,
    );

    expect(
      await screen.findByText(/Restauration du minuteur/),
    ).toBeInTheDocument();
  });
});
