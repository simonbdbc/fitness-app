import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { PwaUnavailableProvider, usePwa } from "./PwaProvider";

describe("PwaUnavailableProvider", () => {
  it("degrades optional PWA capabilities without claiming that the API works", () => {
    render(
      <PwaUnavailableProvider>
        <PwaProbe />
      </PwaUnavailableProvider>,
    );

    expect(screen.getByTestId("api-status")).toHaveTextContent("unavailable");
    expect(screen.getByTestId("install-status")).toHaveTextContent(
      "unsupported",
    );
    expect(screen.getByTestId("update-status")).toHaveTextContent("error");
  });
});

function PwaProbe() {
  const value = usePwa();

  return (
    <>
      <span data-testid="api-status">{value.apiStatus}</span>
      <span data-testid="install-status">{value.installStatus}</span>
      <span data-testid="update-status">{value.updateStatus}</span>
    </>
  );
}
