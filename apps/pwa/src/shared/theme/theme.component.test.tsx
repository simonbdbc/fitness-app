import AsyncStorage from "@react-native-async-storage/async-storage";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { ThemeProvider, useTheme } from "./theme";

describe("ThemeProvider", () => {
  beforeEach(() => {
    vi.mocked(AsyncStorage.getItem).mockResolvedValue(null);
    vi.mocked(AsyncStorage.setItem).mockResolvedValue();
  });

  it("starts with the dark default and keeps the switch semantics explicit", async () => {
    render(
      <ThemeProvider>
        <ThemeProbe />
      </ThemeProvider>,
    );

    expect(screen.getByTestId("theme-name")).toHaveTextContent("pulse-dark");
    fireEvent.click(screen.getByRole("button", { name: "toggle-theme" }));
    expect(screen.getByTestId("theme-name")).toHaveTextContent("pulse-light");

    await waitFor(() => {
      expect(AsyncStorage.setItem).toHaveBeenLastCalledWith(
        "acrea-fitness.theme",
        "pulse-light",
      );
    });
  });

  it("restores the legacy light value without overriding a user action", async () => {
    let resolveStoredTheme: (value: string | null) => void = () => undefined;
    vi.mocked(AsyncStorage.getItem).mockReturnValue(
      new Promise((resolve) => {
        resolveStoredTheme = resolve;
      }),
    );

    render(
      <ThemeProvider>
        <ThemeProbe />
      </ThemeProvider>,
    );
    fireEvent.click(screen.getByRole("button", { name: "toggle-theme" }));
    await act(async () => {
      resolveStoredTheme("dark");
    });

    expect(screen.getByTestId("theme-name")).toHaveTextContent("pulse-light");
  });
});

function ThemeProbe() {
  const { themeName, toggleTheme } = useTheme();

  return (
    <>
      <span data-testid="theme-name">{themeName}</span>
      <button aria-label="toggle-theme" onClick={toggleTheme} type="button">
        toggle
      </button>
    </>
  );
}
