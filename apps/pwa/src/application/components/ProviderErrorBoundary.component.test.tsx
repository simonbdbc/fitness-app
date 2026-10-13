import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { ProviderErrorBoundary } from "./ProviderErrorBoundary";

describe("ProviderErrorBoundary", () => {
  it("contains a provider failure and renders the scoped fallback", () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);

    render(
      <ProviderErrorBoundary fallback={<span>mode dégradé</span>} scope="test">
        <FailingChild />
      </ProviderErrorBoundary>,
    );

    expect(screen.getByText("mode dégradé")).toBeInTheDocument();
  });
});

function FailingChild(): never {
  throw new Error("provider failure");
}
