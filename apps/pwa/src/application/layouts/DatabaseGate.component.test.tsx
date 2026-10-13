import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { ThemeProvider } from "@shared/theme";
import { DatabaseGate } from "./DatabaseGate";

const { initializeDatabaseMock } = vi.hoisted(() => ({
  initializeDatabaseMock: vi.fn(),
}));

vi.mock("@shared/db", () => ({
  getLocalDatabaseErrorCode: (error: { code?: string }) => error.code ?? null,
  initializeDatabase: initializeDatabaseMock,
}));

describe("DatabaseGate", () => {
  beforeEach(() => {
    initializeDatabaseMock.mockReset();
  });

  it("uses the shared loading screen without legacy copy", () => {
    initializeDatabaseMock.mockReturnValue(new Promise(() => undefined));

    renderGate();

    expect(screen.getByTestId("app-loading-icon")).toBeInTheDocument();
    expect(
      screen.getByRole("progressbar", {
        name: "Initialisation de la base locale",
      }),
    ).toBeInTheDocument();
    expect(screen.queryByText("Initialisation locale")).toBeNull();
    expect(screen.queryByText("Base locale SQLite")).toBeNull();
  });

  it("shows one retry action when another instance holds the database", async () => {
    initializeDatabaseMock
      .mockRejectedValueOnce(
        databaseError(
          "LOCAL_DATABASE_BLOCKED",
          "ACREA Fitness est déjà ouvert dans une autre fenêtre ou instance. Ferme l'autre instance puis réessaie.",
        ),
      )
      .mockResolvedValueOnce(undefined);

    renderGate();

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "ACREA Fitness est déjà ouvert",
    );
    const button = screen.getByRole("button", { name: "Réessayer" });
    expect(screen.getAllByRole("button")).toHaveLength(1);
    expect(screen.queryByText("Recharger")).toBeNull();
    expect(screen.queryByText("Mettre à jour")).toBeNull();
    expect(
      screen.queryByText(
        "Les données locales ne sont pas modifiées automatiquement.",
      ),
    ).toBeNull();

    fireEvent.click(button);

    await waitFor(() => {
      expect(initializeDatabaseMock).toHaveBeenCalledTimes(2);
    });
    expect(await screen.findByText("Application prête")).toBeInTheDocument();
  });

  it("shows one reload action when SQLite is unavailable on the web", async () => {
    initializeDatabaseMock.mockRejectedValueOnce(
      databaseError(
        "LOCAL_DATABASE_UNAVAILABLE",
        "La base SQLite locale n'a pas pu être initialisée. Recharge l'application pour réessayer.",
      ),
    );

    renderGate();

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Recharge l'application pour réessayer.",
    );
    expect(screen.getByRole("button", { name: "Recharger" })).toBeInTheDocument();
    expect(screen.getAllByRole("button")).toHaveLength(1);
    expect(screen.queryByText("Réessayer")).toBeNull();
    expect(screen.queryByText("Mettre à jour")).toBeNull();
  });

  it("uses the same single reload action for a generic web error", async () => {
    initializeDatabaseMock.mockRejectedValueOnce(
      new Error("La base locale a rencontré une erreur inattendue."),
    );

    renderGate();

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "La base locale a rencontré une erreur inattendue.",
    );
    expect(screen.getByRole("button", { name: "Recharger" })).toBeInTheDocument();
    expect(screen.getAllByRole("button")).toHaveLength(1);
  });
});

function renderGate() {
  return render(
    <SafeAreaProvider>
      <ThemeProvider>
        <DatabaseGate>
          <span>Application prête</span>
        </DatabaseGate>
      </ThemeProvider>
    </SafeAreaProvider>,
  );
}

function databaseError(code: string, message: string) {
  return Object.assign(new Error(message), { code });
}
