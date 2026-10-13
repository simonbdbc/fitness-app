import { View } from "react-native";

import {
  acreaPillarLabels,
  type ACREAPillarLevelState,
  type ACREAPillarLevels,
} from "@features/programming";
import { StatTile } from "@shared/ui/StatTile";

export function completePillarLevels(
  levels: ACREAPillarLevelState,
): ACREAPillarLevels | null {
  if (
    levels.strength === null ||
    levels.cardio === null ||
    levels.proprioception === null
  ) {
    return null;
  }

  return {
    strength: levels.strength,
    cardio: levels.cardio,
    proprioception: levels.proprioception,
  };
}

export function LevelTiles({ levels }: { levels: ACREAPillarLevels }) {
  return (
    <View className="flex-row flex-wrap gap-3">
      {Object.entries(levels).map(([pillar, level]) => (
        <StatTile
          key={pillar}
          label={acreaPillarLabels[pillar as keyof ACREAPillarLevels]}
          tone="success"
          value={String(level)}
        />
      ))}
    </View>
  );
}
