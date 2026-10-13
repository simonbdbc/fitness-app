import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("react-native", () => ({
  Platform: { OS: "web" },
}));

import { hasCachedCatalogMedia } from "./catalogMediaCache";

const poster = {
  fileName: "heel-to-toe-walk-poster.webp",
  sha256: "706f73746572",
  uri: "/library/heel-to-toe-walk-poster.webp",
};

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("catalog media cache", () => {
  it("does not trust a cache marker when the release cache does not exist", async () => {
    const open = vi.fn();
    vi.stubGlobal("caches", {
      keys: vi.fn(async () => []),
      open,
    });

    await expect(hasCachedCatalogMedia(poster, "catalog-v4")).resolves.toBe(false);
    expect(open).not.toHaveBeenCalled();
  });

  it("accepts only a matching cached payload", async () => {
    vi.stubGlobal("crypto", {
      subtle: {
        digest: vi.fn(async (_algorithm: string, bytes: ArrayBuffer) => bytes),
      },
    });
    vi.stubGlobal("caches", {
      keys: vi.fn(async () => ["acrea-catalog-media:catalog-v4"]),
      open: vi.fn(async () => ({
        match: vi.fn(async () => new Response("poster")),
      })),
    });

    await expect(hasCachedCatalogMedia(poster, "catalog-v4")).resolves.toBe(true);
  });
});
