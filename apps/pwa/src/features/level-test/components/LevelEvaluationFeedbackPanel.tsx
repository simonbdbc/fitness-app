import { View } from "react-native";

import { useThemeTokens } from "@shared/theme";
import { ActionButton } from "@shared/ui/Button";
import { BodyText } from "@shared/ui/Typography";

import type { LevelEvaluationFeedbackDraft } from "../services/levelEvaluationResume";
import { LevelEvaluationMaximumInput } from "./LevelEvaluationMaximumInput";

export function LevelEvaluationFeedbackPanel({
  draft,
  isMaximumPhase,
  onChange,
}: {
  draft: LevelEvaluationFeedbackDraft;
  isMaximumPhase: boolean;
  onChange: (updates: Partial<LevelEvaluationFeedbackDraft>) => void;
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
      <BodyText className="font-bold">Feedback d’évaluation</BodyText>

      <View className="gap-2">
        <BodyText className="min-w-0 flex-1">
          Validation technique obligatoire
        </BodyText>
        <View className="flex-row flex-wrap gap-2">
          <ActionButton
            className="min-w-[132px] flex-1"
            onPress={() => onChange({ technicalValid: true })}
            variant={draft.technicalValid === true ? "primary" : "secondary"}
          >
            Technique validée
          </ActionButton>
          <ActionButton
            className="min-w-[132px] flex-1"
            onPress={() => onChange({ technicalValid: false })}
            variant={draft.technicalValid === false ? "primary" : "secondary"}
          >
            Technique non validée
          </ActionButton>
        </View>
      </View>

      <View className="gap-2">
        <BodyText>Appréciation obligatoire</BodyText>
        <View className="flex-row flex-wrap gap-2">
          {[1, 2, 3, 4, 5].map((rating) => (
            <ActionButton
              className="min-w-[42px] flex-1"
              key={rating}
              onPress={() => onChange({ appreciationRating: rating })}
              variant={
                draft.appreciationRating === rating ? "primary" : "secondary"
              }
            >
              {rating}
            </ActionButton>
          ))}
        </View>
      </View>

      {isMaximumPhase ? (
        <View className="gap-2">
          <BodyText>Maximum de répétitions strictes</BodyText>
          <LevelEvaluationMaximumInput
            colors={{
              background: tokens.colors.inputBackground,
              border: tokens.colors.border,
              text: tokens.colors.textPrimary,
            }}
            onChangeText={(value) =>
              onChange({
                maximumRepetitions: value.replace(/[^0-9]/g, "") || "0",
              })
            }
            value={draft.maximumRepetitions}
          />
        </View>
      ) : null}
    </View>
  );
}
