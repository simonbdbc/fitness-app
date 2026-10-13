import { describe, expect, it } from "vitest";

import { shouldShowMenuInstallButton } from "./menuInstallPolicy";

describe("menu install policy", () => {
  it("keeps the entry available for an installable browser tab", () => {
    expect(
      shouldShowMenuInstallButton({
        displayMode: "browser",
        installStatus: "available",
      }),
    ).toBe(true);
  });

  it("hides the entry once the app is installed", () => {
    expect(
      shouldShowMenuInstallButton({
        displayMode: "browser",
        installStatus: "installed",
      }),
    ).toBe(false);
    expect(
      shouldShowMenuInstallButton({
        displayMode: "standalone",
        installStatus: "manual",
      }),
    ).toBe(false);
  });

  it("hides the entry when installation has been dismissed", () => {
    expect(
      shouldShowMenuInstallButton({
        displayMode: "browser",
        installStatus: "dismissed",
      }),
    ).toBe(false);
  });
});
