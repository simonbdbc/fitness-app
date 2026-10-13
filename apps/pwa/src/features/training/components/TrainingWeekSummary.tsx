import { View } from "react-native";

import {
  type ACREAProfile,
  type ACREAWeekPlan,
} from "@features/programming";
import { Badge } from "@shared/ui/Badge";
import { Card, CardHeader } from "@shared/ui/Card";
import { StatTile } from "@shared/ui/StatTile";

export function TrainingWeekSummary({
  profile,
  weekPlan,
}: {
  profile: ACREAProfile;
  weekPlan: ACREAWeekPlan;
}) {
  const completedCount = weekPlan.trainings.filter(
    (training) => training.status === "terminee",
  ).length;

  return (
    <Card>
      <CardHeader
        action={<Badge variant="info">IA locale</Badge>}
        description={weekPlan.validationFocus}
        title={`Semaine ${weekPlan.isoWeekNumber} - ${weekPlan.role}`}
      />
      <View className="flex-row flex-wrap gap-3">
        <StatTile
          label="terminées"
          tone="success"
          value={`${completedCount}/${weekPlan.trainings.length}`}
        />
        <StatTile
          label="renforcement"
          value={`Niveau ${profile.pillarLevels.strength}`}
        />
        <StatTile
          label="cardio"
          value={`Niveau ${profile.pillarLevels.cardio}`}
        />
        <StatTile
          label="proprioception"
          value={`Niveau ${profile.pillarLevels.proprioception}`}
        />
        <StatTile
          label="mode"
          tone="info"
          value={profile.equipmentMode}
        />
      </View>
    </Card>
  );
}
