import { describe, expect, it } from "vitest";

import type { CatalogExerciseMedia } from "../types";

import { getExerciseLibraryMedia } from "./exerciseLibraryMedia";

function media(uri: string): CatalogExerciseMedia {
  return {
    fileName: "back-and-forth-step-poster.webp",
    frameCount: 1,
    height: 150,
    id: 1,
    kind: "poster",
    loopCount: null,
    mimeType: "image/webp",
    sha256: "digest",
    status: "ready",
    updatedAt: "2026-08-13T00:00:00.000Z",
    uri,
    width: 150,
    exerciseId: 1,
  };
}

describe("progressive exercise media", () => {
  it("does not expose legacy media from an unhydrated library card", () => {
    expect(
      getExerciseLibraryMedia({
        slug: "back-and-forth-step",
        name: "Back and Forth Step",
        media: [media("docs/bibliotheque/warm-up/no-equipment/back-and-forth-step/back-and-forth-step-poster.webp")],
      }),
    ).toBeNull();
  });

  it("exposes media only after a detail response writes a versioned release path", () => {
    expect(
      getExerciseLibraryMedia({
        slug: "back-and-forth-step",
        name: "Back and Forth Step",
        media: [media("library/revision-42/warm-up/no-equipment/back-and-forth-step/back-and-forth-step-poster.webp")],
      }),
    ).toMatchObject({
      posterSource:
        "/library/revision-42/warm-up/no-equipment/back-and-forth-step/back-and-forth-step-poster.webp",
    });
  });
});
