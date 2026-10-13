import { Image, type ImageProps } from "expo-image";
import { useEffect, useState } from "react";
import { AccessibilityInfo, ActivityIndicator, Pressable, Text, View } from "react-native";

import { useAppDesignTheme, useThemeTokens } from "@shared/theme";
import { VideoPlayIcon } from "@shared/ui";

export type ExerciseMediaSource = NonNullable<ImageProps["source"]>;

export type ExerciseMediaSources = {
  animationSource: ExerciseMediaSource | null;
  fallbackPosterSource: ExerciseMediaSource | null;
  posterSource: ExerciseMediaSource;
};

type ExerciseMediaProps = {
  exerciseName: string;
  media: ExerciseMediaSources;
};

export function ExerciseCardPoster({
  exerciseName,
  media,
}: ExerciseMediaProps) {
  return (
    <ExercisePosterImage
      exerciseName={exerciseName}
      media={media}
      presentation="card"
    />
  );
}

/**
 * The stable detail frame always starts with its poster.  The animation is an
 * explicit, local transition: no modal remount, no list reload and no media
 * request before the user asks for it.
 */
export function ExerciseDetailAnimation({
  exerciseName,
  isAnimationLoading = false,
  media,
  onRequestAnimation,
}: ExerciseMediaProps & {
  isAnimationLoading?: boolean;
  onRequestAnimation?: () => Promise<void> | void;
}) {
  const tokens = useThemeTokens();
  const designTheme = useAppDesignTheme();
  const prefersReducedMotion = useReducedMotionPreference();
  const [playbackRequested, setPlaybackRequested] = useState(false);
  const [animationFailed, setAnimationFailed] = useState(false);

  useEffect(() => {
    setAnimationFailed(false);
  }, [media.animationSource]);

  useEffect(() => {
    setAnimationFailed(false);
    setPlaybackRequested(false);
  }, [exerciseName]);

  const animationIsVisible =
    playbackRequested && !animationFailed && Boolean(media.animationSource);

  const togglePlayback = async () => {
    if (animationIsVisible) {
      setPlaybackRequested(false);
      return;
    }

    setAnimationFailed(false);
    setPlaybackRequested(true);
    if (media.animationSource) return;

    if (!onRequestAnimation) {
      setPlaybackRequested(false);
      return;
    }

    try {
      await onRequestAnimation();
    } catch {
      setPlaybackRequested(false);
    }
  };
  const showPlayOverlay =
    !animationIsVisible && !isAnimationLoading && !playbackRequested;

  return (
    <View className="w-full gap-3">
      <Pressable
        accessibilityHint={
          animationIsVisible
            ? "Revient à l’aperçu statique sans fermer la fiche."
            : media.animationSource
              ? "Lance la démonstration animée sans recharger la fiche."
              : "Télécharge puis lance la démonstration animée du mouvement."
        }
        accessibilityLabel={
          animationIsVisible
            ? `Afficher l’aperçu de ${exerciseName}`
            : isAnimationLoading || playbackRequested
              ? `Chargement de l’animation de ${exerciseName}`
              : `Lire l’animation de ${exerciseName}`
        }
        accessibilityRole="button"
        disabled={isAnimationLoading}
        onPress={() => void togglePlayback()}
        style={{ opacity: isAnimationLoading ? 0.72 : 1 }}
      >
        <View
          style={{
            aspectRatio: 1,
            backgroundColor: tokens.colors.surfaceMuted,
            borderRadius: designTheme.radii.panel,
            overflow: "hidden",
            width: "100%",
          }}
        >
          {animationIsVisible && media.animationSource ? (
            <Image
              accessibilityLabel={`Animation de ${exerciseName}`}
              accessibilityRole="image"
              alt={`Animation de ${exerciseName}`}
              autoplay
              cachePolicy="memory-disk"
              contentFit="contain"
              loading="eager"
              onError={() => {
                setAnimationFailed(true);
                setPlaybackRequested(false);
              }}
              placeholder={media.posterSource}
              placeholderContentFit="contain"
              priority="high"
              recyclingKey={`exercise-animation-${exerciseName}`}
              source={media.animationSource}
              style={{ height: "100%", width: "100%" }}
              transition={0}
              useAppleWebpCodec={false}
            />
          ) : (
            <ExercisePosterImage
              exerciseName={exerciseName}
              media={media}
              presentation="detail"
            />
          )}
          {showPlayOverlay ? (
            <View
              style={{
                alignItems: "center",
                aspectRatio: 1,
                backgroundColor: tokens.colors.overlay,
                borderRadius: 9999,
                justifyContent: "center",
                left: "33.333333%",
                pointerEvents: "none",
                position: "absolute",
                top: "33.333333%",
                width: "33.333333%",
              }}
              testID="exercise-play-overlay"
            >
              <View style={{ aspectRatio: 1, width: "62%" }}>
                <VideoPlayIcon color={tokens.colors.accent} />
              </View>
            </View>
          ) : null}
          {isAnimationLoading ? (
            <View className="absolute inset-0 items-center justify-center" pointerEvents="none">
              <ActivityIndicator color={tokens.colors.accent} />
            </View>
          ) : null}
        </View>
      </Pressable>
      {animationFailed ? (
        <Pressable
          accessibilityLabel={`Réessayer le chargement de ${exerciseName}`}
          accessibilityRole="button"
          className="items-center border px-4 py-3"
          onPress={() => void togglePlayback()}
          style={{
            borderColor: tokens.colors.border,
            borderRadius: designTheme.radii.control,
          }}
        >
          <Text style={{ color: tokens.colors.accent, fontWeight: "700" }}>
            Réessayer le chargement
          </Text>
        </Pressable>
      ) : (
        <Text style={{ color: tokens.colors.textMuted, textAlign: "center" }}>
          {isAnimationLoading || playbackRequested
            ? "Chargement de l’animation…"
            : animationIsVisible
              ? "Touchez l’animation pour revenir à l’aperçu."
              : prefersReducedMotion
                ? "Animation disponible au toucher."
                : "Touchez l’aperçu pour lancer l’animation."}
        </Text>
      )}
    </View>
  );
}

/** Kept pure for component tests and to document the no-autoplay policy. */
export function shouldPlayExerciseAnimation({
  animationFailed,
  hasAnimation,
  isAppActive,
  prefersReducedMotion,
}: {
  animationFailed: boolean;
  hasAnimation: boolean;
  isAppActive: boolean;
  prefersReducedMotion: boolean;
}) {
  return hasAnimation && isAppActive && !animationFailed && !prefersReducedMotion;
}

export function useReducedMotionPreference() {
  const [prefersReducedMotion, setPrefersReducedMotion] = useState<boolean | null>(null);

  useEffect(() => {
    let isMounted = true;
    const subscription = AccessibilityInfo.addEventListener(
      "reduceMotionChanged",
      setPrefersReducedMotion,
    );

    void AccessibilityInfo.isReduceMotionEnabled()
      .then((isEnabled) => {
        if (isMounted) setPrefersReducedMotion(isEnabled);
      })
      .catch(() => {
        if (isMounted) setPrefersReducedMotion(false);
      });

    return () => {
      isMounted = false;
      subscription.remove();
    };
  }, []);

  return prefersReducedMotion ?? true;
}

function ExercisePosterImage({
  exerciseName,
  media,
  presentation,
}: ExerciseMediaProps & {
  presentation: "card" | "detail";
}) {
  const tokens = useThemeTokens();
  const designTheme = useAppDesignTheme();
  const [posterFailureCount, setPosterFailureCount] = useState(0);

  useEffect(() => {
    setPosterFailureCount(0);
  }, [media.fallbackPosterSource, media.posterSource]);

  const isCard = presentation === "card";
  const activePosterSource =
    posterFailureCount === 0
      ? media.posterSource
      : posterFailureCount === 1
        ? media.fallbackPosterSource
        : null;

  if (!activePosterSource) {
    return (
      <View
        accessibilityLabel={`Aperçu indisponible pour ${exerciseName}`}
        accessibilityRole="image"
        accessible
        style={{
          alignItems: "center",
          aspectRatio: 1,
          backgroundColor: tokens.colors.surfaceMuted,
          borderRadius: designTheme.radii.panel,
          flexShrink: 0,
          justifyContent: "center",
          width: isCard ? 96 : "100%",
        }}
      >
        <Text
          accessible={false}
          style={{
            color: tokens.colors.textMuted,
            fontSize: isCard ? 11 : 14,
            fontWeight: "600",
            textAlign: "center",
          }}
        >
          Image indisponible
        </Text>
      </View>
    );
  }

  return (
    <Image
      accessibilityLabel={`Aperçu de ${exerciseName}`}
      accessibilityRole="image"
      alt={`Aperçu de ${exerciseName}`}
      autoplay={false}
      cachePolicy="memory-disk"
      contentFit="contain"
      loading={isCard ? "lazy" : "eager"}
      onError={() => setPosterFailureCount((count) => count + 1)}
      priority={isCard ? "low" : "normal"}
      recyclingKey={`exercise-poster-${exerciseName}`}
      source={activePosterSource}
      style={{
        aspectRatio: 1,
        backgroundColor: tokens.colors.surfaceMuted,
        borderRadius: designTheme.radii.panel,
        flexShrink: 0,
        height: isCard ? undefined : "100%",
        width: isCard ? 96 : "100%",
      }}
      useAppleWebpCodec={false}
    />
  );
}
