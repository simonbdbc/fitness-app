import { Text, View } from "react-native";

import { useThemeTokens } from "@shared/theme";
import { ActionButton, Badge } from "@shared/ui";
import {
  formatTimerDuration,
  type SessionTimerPlan,
  type SessionTimerSnapshot,
} from "../services/sessionTimer";

export function SessionTimerPanel({
  allowEarlyFinish = true,
  isPreparing,
  onCompleteEffortPhase,
  onFinish,
  onReset,
  onToggle,
  plan,
  snapshot,
}: {
  allowEarlyFinish?: boolean;
  isPreparing: boolean;
  onCompleteEffortPhase: () => void;
  onFinish: () => void;
  onReset: () => void;
  onToggle: () => void;
  plan: SessionTimerPlan;
  snapshot: SessionTimerSnapshot;
}) {
  const tokens = useThemeTokens();
  const phaseLabel = snapshot.phase?.label ?? "Fin";
  const isRunningManualEffort =
    snapshot.status === "running" &&
    snapshot.mode === "series" &&
    snapshot.phase?.kind === "effort" &&
    snapshot.isManualPhase;
  const toggleLabel = resolveTimerPrimaryActionLabel({
    isPreparing,
    isRunningManualEffort,
    snapshot,
  });
  const globalTimerLabel =
    snapshot.status === "countdown"
      ? "Départ dans"
      : snapshot.mode === "series"
        ? "Temps écoulé"
        : "Temps restant";
  const globalTimerValue =
    snapshot.status === "countdown"
      ? String(snapshot.countdownRemainingSeconds ?? 0)
      : formatTimerDuration(
          snapshot.mode === "series"
            ? snapshot.sessionElapsedSeconds
            : snapshot.totalRemainingSeconds,
        );
  const primaryMetricValue =
    snapshot.isManualPhase && snapshot.series
      ? snapshot.series.targetRepetitions === null
        ? "Maximum"
        : `${snapshot.series.targetRepetitions} reps`
      : formatTimerDuration(snapshot.phaseRemainingSeconds);
  const progressMetric = seriesProgressMetric(snapshot);
  const formatLabel =
    snapshot.mode === "series" ? "Répétitions" : "Intervalles";

  return (
    <View
      className="w-full max-w-full min-w-0 gap-3 border p-3"
      style={{
        backgroundColor: tokens.colors.surfaceMuted,
        borderColor: tokens.colors.border,
        borderRadius: 8,
      }}
    >
      <View className="w-full max-w-full min-w-0 flex-row flex-wrap items-center justify-between gap-2">
        <View className="min-w-0 flex-1 gap-1">
          <Text
            className="text-xs font-bold uppercase"
            selectable
            style={{ color: tokens.colors.textMuted }}
          >
            {globalTimerLabel}
          </Text>
          <Text
            className="text-4xl font-extrabold"
            selectable
            style={{
              color: tokens.colors.textPrimary,
              fontVariant: ["tabular-nums"],
            }}
          >
            {globalTimerValue}
          </Text>
        </View>
        <Badge variant={timerEventVariant(snapshot.eventKind)}>
          {timerEventLabel(snapshot.eventKind)}
        </Badge>
      </View>

      <ProgressBar progressPercent={snapshot.globalProgressPercent} />

      <View className="w-full max-w-full min-w-0 flex-row flex-wrap gap-3">
        <TimerMetric label={phaseLabel} value={primaryMetricValue} />
        <TimerMetric
          label={progressMetric.label}
          value={progressMetric.value}
        />
        <TimerMetric label="Format" value={formatLabel} />
      </View>

      <ProgressBar
        progressPercent={snapshot.phaseProgressPercent}
        tone={snapshot.phase?.kind === "repos" ? "info" : "default"}
      />

      <View className="flex-row flex-wrap gap-1">
        {plan.phases.map((phase) => (
          <View
            className="h-2 min-w-[18px] flex-1"
            key={phase.id}
            style={{
              backgroundColor:
                phase.index < snapshot.phaseIndex || snapshot.isComplete
                  ? tokens.colors.actionBackground
                  : phase.kind === "repos"
                    ? tokens.colors.infoSurface
                    : tokens.colors.border,
              borderRadius: 999,
            }}
          />
        ))}
      </View>

      <View className="flex-row flex-wrap gap-2">
        <ActionButton
          className="min-w-[112px] flex-1"
          disabled={snapshot.isComplete || isPreparing}
          onPress={
            isRunningManualEffort ? onCompleteEffortPhase : onToggle
          }
          variant="primary"
        >
          {toggleLabel}
        </ActionButton>
        {isRunningManualEffort ? (
          <ActionButton
            className="min-w-[112px] flex-1"
            onPress={onToggle}
            variant="secondary"
          >
            Pause
          </ActionButton>
        ) : null}
        <ActionButton
          className="min-w-[112px] flex-1"
          onPress={onReset}
          variant="secondary"
        >
          Reset
        </ActionButton>
        {allowEarlyFinish ? (
          <ActionButton
            className="min-w-[112px] flex-1"
            disabled={snapshot.isComplete}
            onPress={onFinish}
            variant="secondary"
          >
            Terminer
          </ActionButton>
        ) : null}
      </View>
    </View>
  );
}

function resolveTimerPrimaryActionLabel({
  isPreparing,
  isRunningManualEffort,
  snapshot,
}: {
  isPreparing: boolean;
  isRunningManualEffort: boolean;
  snapshot: SessionTimerSnapshot;
}) {
  if (isPreparing) {
    return "Préparation...";
  }

  if (snapshot.status === "running") {
    return isRunningManualEffort ? "Série terminée" : "Pause";
  }

  if (snapshot.status === "countdown") {
    return "Annuler";
  }

  if (snapshot.status === "paused") {
    return "Reprendre";
  }

  return "Démarrer";
}

function seriesProgressMetric(snapshot: SessionTimerSnapshot) {
  const totalSeries = Math.max(1, snapshot.totalSeries ?? 1);
  const currentSeries = snapshot.isComplete
    ? totalSeries
    : snapshot.series?.currentSeriesNumber ??
      Math.min(totalSeries, (snapshot.phase?.seriesIndex ?? 0) + 1);

  return {
    label: "Séries",
    value: `${currentSeries}/${totalSeries}`,
  };
}

function TimerMetric({ label, value }: { label: string; value: string }) {
  const tokens = useThemeTokens();

  return (
    <View className="min-w-[96px] flex-1 gap-1">
      <Text
        className="text-xs font-bold uppercase"
        selectable
        style={{ color: tokens.colors.textMuted }}
      >
        {label}
      </Text>
      <Text
        className="text-lg font-extrabold"
        selectable
        style={{
          color: tokens.colors.textPrimary,
          fontVariant: ["tabular-nums"],
        }}
      >
        {value}
      </Text>
    </View>
  );
}

function ProgressBar({
  progressPercent,
  tone = "default",
}: {
  progressPercent: number;
  tone?: "default" | "info";
}) {
  const tokens = useThemeTokens();

  return (
    <View
      className="h-2 w-full overflow-hidden"
      style={{
        backgroundColor: tokens.colors.borderSoft,
        borderRadius: 999,
      }}
    >
      <View
        className="h-full"
        style={{
          backgroundColor:
            tone === "info"
              ? tokens.colors.infoText
              : tokens.colors.actionBackground,
          borderRadius: 999,
          width: `${progressPercent}%`,
        }}
      />
    </View>
  );
}

function timerEventLabel(eventKind: SessionTimerSnapshot["eventKind"]) {
  if (eventKind === "preparation") return "Préparation";
  if (eventKind === "decompte") return "Décompte";
  if (eventKind === "repos") return "Repos";
  if (eventKind === "fin") return "Fin";
  return "Effort";
}

function timerEventVariant(eventKind: SessionTimerSnapshot["eventKind"]) {
  if (eventKind === "fin") return "success";
  if (eventKind === "repos") return "info";
  if (eventKind === "decompte") return "warning";
  return "dark";
}
