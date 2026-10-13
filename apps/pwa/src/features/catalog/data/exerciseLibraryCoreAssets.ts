// The only catalogue media bundled with the PWA: six V4 evaluation movements.
// All other WebP files are fetched from the versioned catalogue endpoint.
import type { ImageSourcePropType } from "react-native";

export type ExerciseLibraryCoreMediaSources = {
  animationSource: ImageSourcePropType;
  posterSource: ImageSourcePropType;
};

export const exerciseLibraryCoreMediaSources: Record<
  string,
  ExerciseLibraryCoreMediaSources
> = {
  "push-up": {
    animationSource: require("../../../../../../docs/bibliotheque/strength/no-equipment/push-up/push-up-animate.webp"),
    posterSource: require("../../../../../../docs/bibliotheque/strength/no-equipment/push-up/push-up-poster.webp"),
  },
  "air-squat": {
    animationSource: require("../../../../../../docs/bibliotheque/strength/no-equipment/air-squat/air-squat-animate.webp"),
    posterSource: require("../../../../../../docs/bibliotheque/strength/no-equipment/air-squat/air-squat-poster.webp"),
  },
  burpee: {
    animationSource: require("../../../../../../docs/bibliotheque/cardio/no-equipment/burpee/burpee-animate.webp"),
    posterSource: require("../../../../../../docs/bibliotheque/cardio/no-equipment/burpee/burpee-poster.webp"),
  },
  "mountain-climber": {
    animationSource: require("../../../../../../docs/bibliotheque/cardio/no-equipment/mountain-climber/mountain-climber-animate.webp"),
    posterSource: require("../../../../../../docs/bibliotheque/cardio/no-equipment/mountain-climber/mountain-climber-poster.webp"),
  },
  "lying-leg-raise": {
    animationSource: require("../../../../../../docs/bibliotheque/proprioception/no-equipment/lying-leg-raise/lying-leg-raise-animate.webp"),
    posterSource: require("../../../../../../docs/bibliotheque/proprioception/no-equipment/lying-leg-raise/lying-leg-raise-poster.webp"),
  },
  "lean-planche": {
    animationSource: require("../../../../../../docs/bibliotheque/proprioception/no-equipment/lean-planche/lean-planche-animate.webp"),
    posterSource: require("../../../../../../docs/bibliotheque/proprioception/no-equipment/lean-planche/lean-planche-poster.webp"),
  },
};
