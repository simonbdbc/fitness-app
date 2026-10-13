import { Text, View } from "react-native";

import { useThemeTokens } from "@shared/theme";
import { Badge } from "@shared/ui/Badge";
import { ActionButton } from "@shared/ui/Button";
import { BodyText } from "@shared/ui/Typography";

import type { SessionFeedbackDraft } from "../domain/trainingPresentation";

export function SessionFeedbackPanel({
  draft,
  onChange,
  progressionContext,
  saveError,
  saveMessage,
}: {
  draft: SessionFeedbackDraft;
  onChange: (updates: Partial<SessionFeedbackDraft>) => void;
  progressionContext: string;
  saveError?: string;
  saveMessage?: string;
}) {
  const tokens = useThemeTokens();
  return (
    <View
      className="w-full max-w-full min-w-0 gap-3 border p-3"
      style={{
        backgroundColor: tokens.colors.surface,
        borderColor: tokens.colors.borderSoft,
        borderRadius: 8,
      }}
    >
      <View className="w-full max-w-full min-w-0 flex-row flex-wrap items-center justify-between gap-2">
        <Text
          className="text-xs font-bold uppercase"
          style={{ color: tokens.colors.textMuted }}
        >
          Feedback de session
        </Text>
        {saveMessage ? <Badge variant="success">{saveMessage}</Badge> : null}
      </View>

      <View className="w-full max-w-full min-w-0 flex-row flex-wrap gap-2">
        <RatingControl
          label="Effort"
          onChange={(effortRating) => onChange({ effortRating })}
          value={draft.effortRating}
        />
        <RatingControl
          label="Qualité"
          onChange={(qualityRating) => onChange({ qualityRating })}
          values={[5, 4, 3, 2, 1]}
          value={draft.qualityRating}
        />
      </View>
      <RatingControl
        label="Appréciation obligatoire"
        onChange={(appreciationRating) => onChange({ appreciationRating })}
        value={draft.appreciationRating}
      />
      <BodyText>
        Effort et qualité sont à prendre en compte sur la dernière série ou
        intervalle. Pour la douleur, prends en compte toute la session.
      </BodyText>

      <View className="gap-2">
        <BodyText>Douleur</BodyText>
        <View className="flex-row flex-wrap gap-2">
          <SegmentButton
            active={draft.painLevel === "none"}
            label="Aucune"
            onPress={() => onChange({ painLevel: "none" })}
          />
          <SegmentButton
            active={draft.painLevel === "mild"}
            label="Gêne légère"
            minWidthClassName="min-w-[112px]"
            onPress={() => onChange({ painLevel: "mild" })}
          />
          <SegmentButton
            active={draft.painLevel === "pain"}
            label="Douleur"
            onPress={() => onChange({ painLevel: "pain" })}
          />
        </View>
      </View>

      <View className="gap-2">
        <BodyText>Progression</BodyText>
        <BodyText>
          Préférence de progression pour la prochaine session :{" "}
          {progressionContext}.
        </BodyText>
        <View className="flex-row flex-wrap gap-2">
          <SegmentButton
            active={draft.progressionPreference === "easier"}
            label="Plus facile"
            minWidthClassName="min-w-[112px]"
            onPress={() => onChange({ progressionPreference: "easier" })}
          />
          <SegmentButton
            active={draft.progressionPreference === "same"}
            label="Identique"
            minWidthClassName="min-w-[112px]"
            onPress={() => onChange({ progressionPreference: "same" })}
          />
          <SegmentButton
            active={draft.progressionPreference === "harder"}
            label="Plus difficile"
            minWidthClassName="min-w-[112px]"
            onPress={() => onChange({ progressionPreference: "harder" })}
          />
        </View>
      </View>

      {saveError ? (
        <BodyText style={{ color: tokens.colors.dangerText }}>
          {saveError}
        </BodyText>
      ) : null}
    </View>
  );
}

function RatingControl({
  label,
  onChange,
  value,
  values = [1, 2, 3, 4, 5],
}: {
  label: string;
  onChange: (value: number) => void;
  value: number | null;
  values?: number[];
}) {
  return (
    <View className="min-w-[160px] flex-1 gap-1">
      <BodyText>{label}</BodyText>
      <View className="flex-row flex-wrap gap-1">
        {values.map((rating) => (
          <SegmentButton
            active={value === rating}
            key={`${label}-${rating}`}
            label={String(rating)}
            minWidthClassName="min-w-[34px]"
            onPress={() => onChange(rating)}
          />
        ))}
      </View>
    </View>
  );
}

function SegmentButton({
  active,
  label,
  minWidthClassName = "min-w-[92px]",
  onPress,
}: {
  active: boolean;
  label: string;
  minWidthClassName?: string;
  onPress: () => void;
}) {
  return (
    <ActionButton
      className={`${minWidthClassName} flex-1`}
      onPress={onPress}
      textClassName="text-xs"
      variant={active ? "primary" : "secondary"}
    >
      {label}
    </ActionButton>
  );
}
