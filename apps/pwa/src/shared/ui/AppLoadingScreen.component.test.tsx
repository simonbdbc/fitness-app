import { render, screen } from "@testing-library/react";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { describe, expect, it } from "vitest";

import { ThemeProvider } from "@shared/theme";
import { AppLoadingScreen } from "./AppLoadingScreen";

describe("AppLoadingScreen", () => {
  it("centers the app icon and exposes only an accessible loader", () => {
    const { container } = render(
      <SafeAreaProvider>
        <ThemeProvider>
          <AppLoadingScreen accessibilityLabel="Chargement du profil" />
        </ThemeProvider>
      </SafeAreaProvider>,
    );

    expect(screen.getByTestId("app-loading-icon")).toHaveStyle({
      height: "112px",
      width: "112px",
    });
    expect(
      screen.getByRole("progressbar", { name: "Chargement du profil" }),
    ).toBeInTheDocument();
    expect(screen.getAllByRole("progressbar")).toHaveLength(1);
    expect(container.textContent).toBe("");
    expect(screen.queryByText("Profil ACREA")).toBeNull();
    expect(
      screen.queryByText("Préparation de votre programme personnalisé."),
    ).toBeNull();
    expect(screen.queryByText("Chargement du profil...")).toBeNull();
  });
});
