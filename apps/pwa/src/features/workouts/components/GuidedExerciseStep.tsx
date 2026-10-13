import type { ReactNode } from "react";
import { Text, View } from "react-native";

import { useThemeTokens } from "@shared/theme";
import {
  Badge,
  BodyText,
  Card,
  CardHeader,
  SubtleText,
  TitleText,
} from "@shared/ui";

export type GuidedStepSection = {
  title: string;
  items: string[];
  tone?: "default" | "warning" | "success";
};

export type GuidedExerciseStepData = {
  id: string;
  eyebrow: string;
  title: string;
  subtitle?: string;
  badgeLabel?: string;
  timerLabel?: string;
  timerSeconds?: number;
  sections: GuidedStepSection[];
  note?: string;
  warning?: string;
};

type GuidedExerciseStepProps = {
  children?: ReactNode;
  currentIndex: number;
  footer?: ReactNode;
  step: GuidedExerciseStepData;
  totalCount: number;
};

export function GuidedExerciseStep({
  children,
  currentIndex,
  footer,
  step,
  totalCount,
}: GuidedExerciseStepProps) {
  const tokens = useThemeTokens();
  const progressPercent = Math.round((currentIndex / totalCount) * 100);

  return (
    <View className="w-full max-w-full min-w-0 gap-4">
      <View className="gap-2">
        <View className="flex-row flex-wrap items-center gap-2">
          <Badge variant="dark">{step.eyebrow}</Badge>
          <SubtleText>
            Étape {currentIndex}/{totalCount}
          </SubtleText>
        </View>
        <TitleText>{step.title}</TitleText>
        {step.subtitle ? <BodyText>{step.subtitle}</BodyText> : null}
        <View
          className="h-2 w-full overflow-hidden"
          style={{
            backgroundColor: tokens.colors.surfaceMuted,
            borderRadius: 999,
          }}
        >
          <View
            className="h-full"
            style={{
              backgroundColor: tokens.colors.actionBackground,
              borderRadius: 999,
              width: `${progressPercent}%`,
            }}
          />
        </View>
      </View>

      <Card className="gap-4">
        <CardHeader
          title={step.badgeLabel ?? "Consignes"}
          description={step.timerLabel}
          action={
            step.timerSeconds ? (
              <Badge variant="info">{formatDuration(step.timerSeconds)}</Badge>
            ) : null
          }
        />

        <View className="gap-3">
          {step.sections.map((section) => (
            <InstructionSection key={section.title} section={section} />
          ))}
        </View>

        {step.warning ? (
          <View
            className="w-full max-w-full min-w-0 gap-1 border p-3"
            style={{
              backgroundColor: tokens.colors.warningSurface,
              borderColor: tokens.colors.warningText,
              borderRadius: 8,
            }}
          >
            <Text
              className="text-xs font-bold uppercase tracking-[0.8px]"
              style={{ color: tokens.colors.warningText }}
            >
              Point de contrôle
            </Text>
            <BodyText style={{ color: tokens.colors.warningText }}>
              {step.warning}
            </BodyText>
          </View>
        ) : null}

        {children}

        {step.note ? <BodyText>{step.note}</BodyText> : null}
      </Card>

      {footer ? (
        <View className="w-full max-w-full min-w-0 gap-2">{footer}</View>
      ) : null}
    </View>
  );
}

function InstructionSection({ section }: { section: GuidedStepSection }) {
  const tokens = useThemeTokens();
  const titleColor =
    section.tone === "warning"
      ? tokens.colors.warningText
      : section.tone === "success"
        ? tokens.colors.successText
        : tokens.colors.textMuted;

  return (
    <View className="w-full max-w-full min-w-0 gap-2">
      <Text
        className="max-w-full min-w-0 text-xs font-bold uppercase tracking-[0.8px]"
        style={{ color: titleColor }}
      >
        {section.title}
      </Text>
      <View className="gap-2">
        {section.items.map((item) => (
          <View
            className="w-full max-w-full min-w-0 flex-row gap-2"
            key={`${section.title}-${item}`}
          >
            <Text
              className="w-3 text-sm font-bold"
              style={{ color: titleColor }}
            >
              -
            </Text>
            <BodyText className="min-w-0 flex-1">{item}</BodyText>
          </View>
        ))}
      </View>
    </View>
  );
}

function formatDuration(totalSeconds: number) {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;

  return `${minutes}:${String(seconds).padStart(2, "0")}`;
}
