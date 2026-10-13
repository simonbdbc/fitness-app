import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { AccessibilityInfo } from "react-native";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { ThemeProvider } from "@shared/theme";

import {
  ExerciseCardPoster,
  ExerciseDetailAnimation,
  shouldPlayExerciseAnimation,
} from "./ExerciseMedia";

vi.mock("expo-image", () => ({
  Image: ({
    accessibilityLabel,
    autoplay,
    cachePolicy,
    loading,
    onError,
    source,
  }: {
    accessibilityLabel?: string;
    autoplay?: boolean;
    cachePolicy?: string;
    loading?: string;
    onError?: () => void;
    source?: string;
  }) => (
    <img
      aria-label={accessibilityLabel}
      data-autoplay={String(autoplay)}
      data-cache-policy={cachePolicy}
      data-source={source}
      loading={loading as "eager" | "lazy" | undefined}
      onError={onError}
    />
  ),
}));

const media = {
  animationSource: "animation.webp",
  fallbackPosterSource: "fallback-150x150.webp",
  posterSource: "poster-150x150.webp",
} as const;

describe("exercise media", () => {
  beforeEach(() => {
    vi.spyOn(AccessibilityInfo, "isReduceMotionEnabled").mockResolvedValue(
      false,
    );
    vi.spyOn(AccessibilityInfo, "addEventListener").mockReturnValue({
      remove: vi.fn(),
    } as never);
  });

  it("keeps catalog cards static and lazy-loaded", () => {
    renderWithTheme(
      <ExerciseCardPoster exerciseName="Squat" media={media} />,
    );

    const poster = screen.getByRole("img", { name: "Aperçu de Squat" });
    expect(poster).toHaveAttribute("data-source", media.posterSource);
    expect(poster).toHaveAttribute("data-autoplay", "false");
    expect(poster).toHaveAttribute("data-cache-policy", "memory-disk");
    expect(poster).toHaveAttribute("loading", "lazy");
  });

  it("uses the canonical fallback poster, then an asset-free placeholder", () => {
    renderWithTheme(
      <ExerciseCardPoster exerciseName="Squat" media={media} />,
    );

    fireEvent.error(screen.getByRole("img", { name: "Aperçu de Squat" }));
    expect(screen.getByRole("img", { name: "Aperçu de Squat" })).toHaveAttribute(
      "data-source",
      media.fallbackPosterSource,
    );

    fireEvent.error(screen.getByRole("img", { name: "Aperçu de Squat" }));
    expect(
      screen.getByLabelText("Aperçu indisponible pour Squat"),
    ).toHaveTextContent("Image indisponible");
    expect(
      screen.queryByRole("img", { name: "Aperçu de Squat" }),
    ).not.toBeInTheDocument();
  });

  it("keeps the detail poster stable until an explicit click starts its animation", async () => {
    renderWithTheme(
      <ExerciseDetailAnimation exerciseName="Squat" media={media} />,
    );

    expect(screen.getByTestId("exercise-play-overlay")).toHaveStyle({
      aspectRatio: 1,
      width: "33.333333%",
    });
    expect(
      screen.getByRole("img", { name: "Aperçu de Squat" }),
    ).toHaveAttribute("data-source", media.posterSource);
    const mediaButton = screen.getByRole("button", {
      name: "Lire l’animation de Squat",
    });
    fireEvent.click(mediaButton);
    expect(
      await screen.findByRole("img", { name: "Animation de Squat" }),
    ).toHaveAttribute("data-source", media.animationSource);
    expect(
      screen.getByRole("button", { name: "Afficher l’aperçu de Squat" }),
    ).toBe(mediaButton);
    expect(
      screen.queryByTestId("exercise-play-overlay"),
    ).not.toBeInTheDocument();

    fireEvent.click(
      screen.getByRole("button", { name: "Afficher l’aperçu de Squat" }),
    );
    expect(
      await screen.findByRole("img", { name: "Aperçu de Squat" }),
    ).toHaveAttribute("data-source", media.posterSource);
    expect(
      screen.getByRole("button", { name: "Lire l’animation de Squat" }),
    ).toBe(mediaButton);
    expect(screen.getByTestId("exercise-play-overlay")).toBeInTheDocument();
  });

  it("plays after a single click when the animation must first be downloaded", async () => {
    const onRequestAnimation = vi.fn().mockResolvedValue(undefined);
    const mediaWithoutAnimation = { ...media, animationSource: null };
    const view = renderWithTheme(
      <ExerciseDetailAnimation
        exerciseName="Squat"
        media={mediaWithoutAnimation}
        onRequestAnimation={onRequestAnimation}
      />,
    );

    fireEvent.click(
      screen.getByRole("button", { name: "Lire l’animation de Squat" }),
    );
    expect(onRequestAnimation).toHaveBeenCalledTimes(1);
    expect(
      screen.queryByTestId("exercise-play-overlay"),
    ).not.toBeInTheDocument();

    view.rerender(
      <ThemeProvider>
        <ExerciseDetailAnimation exerciseName="Squat" media={media} />
      </ThemeProvider>,
    );
    expect(
      await screen.findByRole("img", { name: "Animation de Squat" }),
    ).toHaveAttribute("data-source", media.animationSource);
  });

  it("keeps the poster with reduced motion until the user explicitly asks to play", async () => {
    vi.mocked(AccessibilityInfo.isReduceMotionEnabled).mockResolvedValue(true);

    renderWithTheme(
      <ExerciseDetailAnimation exerciseName="Squat" media={media} />,
    );

    await waitFor(() => {
      expect(
        screen.getByRole("img", { name: "Aperçu de Squat" }),
      ).toHaveAttribute("data-source", media.posterSource);
    });
    expect(
      screen.queryByRole("img", { name: "Animation de Squat" }),
    ).not.toBeInTheDocument();

    fireEvent.click(
      screen.getByRole("button", { name: "Lire l’animation de Squat" }),
    );
    expect(
      await screen.findByRole("img", { name: "Animation de Squat" }),
    ).toBeInTheDocument();
  });

  it("plays when an animation is usable and motion is allowed", () => {
    expect(
      shouldPlayExerciseAnimation({
        animationFailed: false,
        hasAnimation: true,
        isAppActive: true,
        prefersReducedMotion: false,
      }),
    ).toBe(true);

    for (const blockedState of [
      { animationFailed: true },
      { hasAnimation: false },
      { isAppActive: false },
      { prefersReducedMotion: true },
    ]) {
      expect(
        shouldPlayExerciseAnimation({
          animationFailed: false,
          hasAnimation: true,
          isAppActive: true,
          prefersReducedMotion: false,
          ...blockedState,
        }),
      ).toBe(false);
    }
  });

  it("falls back to the poster when the animated WebP cannot load", async () => {
    renderWithTheme(
      <ExerciseDetailAnimation exerciseName="Squat" media={media} />,
    );

    fireEvent.click(
      screen.getByRole("button", { name: "Lire l’animation de Squat" }),
    );
    const animation = await screen.findByRole("img", { name: "Animation de Squat" });
    fireEvent.error(animation);

    expect(
      screen.getByRole("img", { name: "Aperçu de Squat" }),
    ).toHaveAttribute("data-source", media.posterSource);
    expect(screen.getByTestId("exercise-play-overlay")).toBeInTheDocument();
    fireEvent.click(
      screen.getByRole("button", { name: "Réessayer le chargement de Squat" }),
    );
    expect(
      await screen.findByRole("img", { name: "Animation de Squat" }),
    ).toHaveAttribute("data-source", media.animationSource);
  });
});

function renderWithTheme(component: ReactNode) {
  return render(<ThemeProvider>{component}</ThemeProvider>);
}
