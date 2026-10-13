import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { Icon } from "./Icon";

describe("Icon", () => {
  it("renders the menu icon with configurable SVG presentation", () => {
    const { container } = render(
      <Icon color="#22d3ee" name="menu" size={20} strokeWidth={1.5} />,
    );

    const svg = container.querySelector("svg");
    const paths = container.querySelectorAll("path");

    expect(svg).toHaveAttribute("aria-hidden", "true");
    expect(svg).toHaveAttribute("height", "20");
    expect(svg).toHaveAttribute("viewBox", "0 0 24 24");
    expect(svg).toHaveAttribute("width", "20");
    expect(paths).toHaveLength(3);
    expect(paths[0]).toHaveAttribute("stroke", "#22d3ee");
    expect(paths[0]).toHaveAttribute("stroke-width", "1.5");
  });

  it("renders a distinct close icon from the central catalog", () => {
    const { container } = render(<Icon color="#ffffff" name="close" />);

    const paths = container.querySelectorAll("path");

    expect(paths).toHaveLength(2);
    expect(paths[0]).toHaveAttribute("d", "M6 6 18 18");
    expect(paths[1]).toHaveAttribute("d", "M18 6 6 18");
  });
});
