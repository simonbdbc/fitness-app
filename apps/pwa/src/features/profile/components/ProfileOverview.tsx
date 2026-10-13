import { View } from "react-native";

import {
  acreaPillarLabels,
  type ACREAPillar,
  type ACREAProfileState,
} from "@features/programming";
import {
  Badge,
  BodyText,
  Card,
  CardHeader,
  StatTile,
  TitleText,
} from "@shared/ui";

import { restrictionLabel } from "../domain/profilePreferences";

export function ProfileSummaryCard({
  profile,
}: {
  profile: ACREAProfileState;
}) {
  return (
    <Card>
      <CardHeader
        action={
          <Badge variant={profile.objective ? "success" : "warning"}>
            {profile.objective ? "actif" : "à compléter"}
          </Badge>
        }
        description={profile.objective ?? "Objectif à renseigner."}
        title={profile.name}
      />
      <View className="flex-row flex-wrap gap-3">
        <StatTile
          label="renforcement"
          tone="success"
          value={levelLabel(profile.pillarLevels.strength)}
        />
        <StatTile
          label="cardio"
          value={levelLabel(profile.pillarLevels.cardio)}
        />
        <StatTile
          label="proprioception"
          value={levelLabel(profile.pillarLevels.proprioception)}
        />
        <StatTile
          label="sessions"
          tone="info"
          value={valueLabel(profile.weeklyFrequency)}
        />
        <StatTile
          label="durée"
          tone="warning"
          value={durationLabel(profile)}
        />
      </View>
    </Card>
  );
}

export function ProfileLimitsOverview({
  profile,
}: {
  profile: ACREAProfileState;
}) {
  return (
    <>
      <View className="gap-2">
        <TitleText className="text-lg leading-6">Niveaux par pilier</TitleText>
        <View className="flex-row flex-wrap gap-3">
          {Object.entries(profile.pillarLevels).map(([pillar, level]) => (
            <Card className="min-w-[148px] flex-1 py-3" key={pillar}>
              <StatTile
                label={acreaPillarLabels[pillar as ACREAPillar]}
                value={levelLabel(level)}
              />
            </Card>
          ))}
        </View>
      </View>

      <Card variant="info">
        <CardHeader
          action={<Badge>{profile.equipmentMode ?? "à renseigner"}</Badge>}
          title="Matériel et limites"
        />
        <BodyText>Matériel disponible : {equipmentLabel(profile)}.</BodyText>
        <BodyText>
          Jours préférés :{" "}
          {profile.preferredWeekdays.join(", ") || "à renseigner"}.
        </BodyText>
        <BodyText>
          Restrictions :{" "}
          {profile.restrictions.map(restrictionLabel).join(", ") || "aucune"}.
        </BodyText>
      </Card>
    </>
  );
}

function levelLabel(level: number | null) {
  return level === null ? "À évaluer" : `Niveau ${level}`;
}

function valueLabel(value: number | null) {
  return value === null ? "À renseigner" : `${value}`;
}

function durationLabel(profile: ACREAProfileState) {
  if (
    profile.sessionMinutesMin === null ||
    profile.sessionMinutesMax === null
  ) {
    return "À renseigner";
  }
  return `${profile.sessionMinutesMin}-${profile.sessionMinutesMax} min`;
}

function equipmentLabel(profile: ACREAProfileState) {
  if (profile.equipmentMode === null) return "à renseigner";
  if (profile.equipmentMode === "aucun") return "aucun nécessaire";
  return profile.availableEquipment.join(", ") || "à sélectionner";
}
