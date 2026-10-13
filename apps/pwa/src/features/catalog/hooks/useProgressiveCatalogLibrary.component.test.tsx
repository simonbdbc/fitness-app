import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { useProgressiveCatalogLibrary } from "./useProgressiveCatalogLibrary";

const {
  checkCatalogReleaseUpdateMock,
  ensureCatalogExerciseDetailsMock,
  getPendingCatalogReleaseUpdateMock,
} = vi.hoisted(() => ({
  checkCatalogReleaseUpdateMock: vi.fn(),
  ensureCatalogExerciseDetailsMock: vi.fn(),
  getPendingCatalogReleaseUpdateMock: vi.fn(),
}));

vi.mock("../services/catalogRepository", () => ({
  acceptPendingCatalogReleaseUpdate: vi.fn(),
  checkCatalogReleaseUpdate: checkCatalogReleaseUpdateMock,
  downloadCompleteCatalogLibrary: vi.fn(),
  ensureCatalogExerciseDetails: ensureCatalogExerciseDetailsMock,
  getPendingCatalogReleaseUpdate: getPendingCatalogReleaseUpdateMock,
}));

vi.mock("@shared/observability/technicalDiagnostics", () => ({
  reportTechnicalDegradationOnce: vi.fn(),
}));

describe("useProgressiveCatalogLibrary", () => {
  beforeEach(() => {
    checkCatalogReleaseUpdateMock.mockReset();
    checkCatalogReleaseUpdateMock.mockResolvedValue(undefined);
    ensureCatalogExerciseDetailsMock.mockReset();
    ensureCatalogExerciseDetailsMock.mockResolvedValue(undefined);
    getPendingCatalogReleaseUpdateMock.mockReset();
    getPendingCatalogReleaseUpdateMock.mockResolvedValue(null);
  });

  it("deduplicates visible posters and hydrates them through bounded batches", async () => {
    const reload = vi.fn();
    const patchExercises = vi.fn().mockResolvedValue(undefined);
    const slugs = Array.from({ length: 26 }, (_, index) => `exercise-${index}`);
    const { result } = renderHook(() =>
      useProgressiveCatalogLibrary({
        reload,
        patchExercises,
        setSelectedExerciseId: vi.fn(),
        status: "success",
      }),
    );

    act(() => {
      result.current.hydrateVisibleExercisePosters([...slugs, slugs[0]]);
      result.current.hydrateVisibleExercisePosters([slugs[1], slugs[25]]);
    });

    await waitFor(() => {
      expect(ensureCatalogExerciseDetailsMock).toHaveBeenCalledTimes(2);
    });

    expect(ensureCatalogExerciseDetailsMock).toHaveBeenNthCalledWith(
      1,
      slugs.slice(0, 25),
      { media: "poster" },
    );
    expect(ensureCatalogExerciseDetailsMock).toHaveBeenNthCalledWith(
      2,
      [slugs[25]],
      { media: "poster" },
    );
    expect(patchExercises).toHaveBeenCalledTimes(2);
    expect(reload).not.toHaveBeenCalled();
  });
});
