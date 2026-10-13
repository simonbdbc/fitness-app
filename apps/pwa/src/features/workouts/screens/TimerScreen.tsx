import { useMemo } from "react";
import { Pressable, Text, View } from "react-native";

import { useAuth } from "@features/auth";
import type { CatalogTimerOptions } from "@features/catalog";
import { useThemeTokens } from "@shared/theme";
import {
  ActionButton,
  Badge,
  BodyText,
  Card,
  CardHeader,
  TitleText,
} from "@shared/ui";
import { SessionTimerPanel } from "../components/SessionTimerPanel";
import { useSessionTimerController } from "../hooks/useSessionTimerController";
import { useTimerCatalogOptions } from "../hooks/useTimerCatalogOptions";
import {
  buildSessionTimerPlan,
  type TimerFormatInput,
} from "../services/sessionTimer";

type TimerFormatType = TimerFormatInput["formatType"];

export function TimerScreen() {
  const tokens = useThemeTokens();
  const { user } = useAuth();
  const {
    formatType,
    intervalId,
    loadError,
    options,
    reload,
    repetitionId,
    restId,
    seriesId,
    setIntervalId,
    setFormatType,
    setRepetitionId,
    setRestId,
    setSeriesId,
  } = useTimerCatalogOptions(user?.id);

  const format = useMemo(
    () =>
      buildSelectedTimerFormat({
        formatType,
        intervalId,
        options,
        repetitionId,
        restId,
        seriesId,
      }),
    [formatType, intervalId, options, repetitionId, restId, seriesId],
  );
  const plan = useMemo(
    () =>
      buildSessionTimerPlan({
        format,
        label: format?.label ?? "",
      }),
    [format],
  );
  const timer = useSessionTimerController(
    plan,
    user ? `timer:${user.id}:standalone` : null,
  );
  const selectionsLocked =
    timer.isRestoring ||
    timer.isPreparing ||
    timer.status === "countdown" ||
    timer.status === "running" ||
    timer.status === "paused";

  if (!options) {
    return (
      <View className="w-full max-w-full min-w-0 gap-4">
        <TitleText>Minuteur</TitleText>
        <Card variant={loadError ? "default" : "muted"}>
          <CardHeader
            action={
              <Badge variant={loadError ? "warning" : "info"}>
                {loadError ? "Erreur" : "Catalogue"}
              </Badge>
            }
            description={
              loadError ?? "Chargement des valeurs disponibles en base..."
            }
            title={loadError ? "Catalogue indisponible" : "Préparation"}
          />
          {loadError ? (
            <ActionButton
              onPress={reload}
              variant="secondary"
            >
              Réessayer
            </ActionButton>
          ) : null}
        </Card>
      </View>
    );
  }

  const missingMessage = timerOptionsMissingMessage(options, formatType);

  return (
    <View className="w-full max-w-full min-w-0 gap-4">
      <View className="gap-2">
        <TitleText>Minuteur</TitleText>
        <BodyText>
          Compose un format avec les séries, répétitions, intervalles et repos
          disponibles dans le catalogue local.
        </BodyText>
      </View>

      <Card>
        <CardHeader
          action={<Badge variant="info">SQLite</Badge>}
          description="Toutes les valeurs proposées proviennent de la base locale."
          title="Configurer le format"
        />

        <SelectionChips
          disabled={selectionsLocked}
          label="Type de format"
          onChange={setFormatType}
          options={[
            { label: "Répétitions", value: "repetitions" },
            { label: "Intervalles", value: "intervalles" },
          ]}
          value={formatType}
        />
        <SelectionChips
          disabled={selectionsLocked}
          label="Séries"
          onChange={setSeriesId}
          options={options.series.map((series) => ({
            label: series.label,
            value: series.id,
          }))}
          value={seriesId}
        />
        {formatType === "repetitions" ? (
          <SelectionChips
            disabled={selectionsLocked}
            label="Répétitions"
            onChange={setRepetitionId}
            options={options.repetitions.map((repetition) => ({
              label: repetition.label,
              value: repetition.id,
            }))}
            value={repetitionId}
          />
        ) : (
          <SelectionChips
            disabled={selectionsLocked}
            label="Intervalle d’effort"
            onChange={setIntervalId}
            options={options.intervals.map((interval) => ({
              label: interval.label,
              value: interval.id,
            }))}
            value={intervalId}
          />
        )}
        <SelectionChips
          disabled={selectionsLocked}
          label="Repos"
          onChange={setRestId}
          options={options.rests.map((rest) => ({
            label: rest.label,
            value: rest.id,
          }))}
          value={restId}
        />

        {format ? (
          <View className="gap-1">
            <Text
              className="text-xs font-bold uppercase"
              selectable
              style={{ color: tokens.colors.textMuted }}
            >
              Format préparé
            </Text>
            <BodyText>{format.label}</BodyText>
          </View>
        ) : null}
      </Card>

      {missingMessage ? (
        <Card variant="muted">
          <CardHeader
            action={<Badge variant="warning">Catalogue</Badge>}
            description={missingMessage}
            title="Configuration indisponible"
          />
        </Card>
      ) : timer.isRestoring ? (
        <Card variant="muted">
          <CardHeader
            description="Récupération de la progression enregistrée sur cet appareil."
            title="Restauration du minuteur"
          />
        </Card>
      ) : plan && timer.snapshot ? (
        <SessionTimerPanel
          isPreparing={timer.isPreparing}
          onCompleteEffortPhase={timer.completeEffortPhase}
          onFinish={timer.finish}
          onReset={timer.reset}
          onToggle={timer.toggle}
          plan={plan}
          snapshot={timer.snapshot}
        />
      ) : (
        <Card variant="muted">
          <CardHeader
            description="Choisis une valeur dans chaque catégorie pour préparer le minuteur."
            title="Format incomplet"
          />
        </Card>
      )}
    </View>
  );
}

function SelectionChips<TValue extends string | number>({
  disabled,
  label,
  onChange,
  options,
  value,
}: {
  disabled: boolean;
  label: string;
  onChange: (value: TValue) => void;
  options: Array<{ label: string; value: TValue }>;
  value: TValue | null;
}) {
  const tokens = useThemeTokens();

  return (
    <View className="gap-2">
      <Text
        className="text-sm font-bold"
        selectable
        style={{ color: tokens.colors.textPrimary }}
      >
        {label}
      </Text>
      <View className="flex-row flex-wrap gap-2">
        {options.map((option) => {
          const selected = value === option.value;

          return (
            <Pressable
              accessibilityRole="button"
              accessibilityState={{ disabled, selected }}
              disabled={disabled}
              key={String(option.value)}
              onPress={() => onChange(option.value)}
              style={{ opacity: disabled ? 0.55 : 1 }}
            >
              <Badge variant={selected ? "dark" : "muted"}>
                {option.label}
              </Badge>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

function buildSelectedTimerFormat({
  formatType,
  intervalId,
  options,
  repetitionId,
  restId,
  seriesId,
}: {
  formatType: TimerFormatType;
  intervalId: number | null;
  options: CatalogTimerOptions | null;
  repetitionId: number | null;
  restId: number | null;
  seriesId: number | null;
}): TimerFormatInput | null {
  if (!options) return null;

  const series = options.series.find((item) => item.id === seriesId);
  const rest = options.rests.find((item) => item.id === restId);

  if (!series || !rest) return null;

  if (formatType === "repetitions") {
    const repetition = options.repetitions.find(
      (item) => item.id === repetitionId,
    );
    if (!repetition) return null;

    return {
      code: `timer-${series.code}-${repetition.code}-${rest.code}`,
      formatType,
      label: `${series.label} · ${repetition.label} · ${rest.label}`,
      repetitions: repetition.reps,
      restSeconds: rest.restSeconds,
      seriesCount: series.series,
    };
  }

  const interval = options.intervals.find((item) => item.id === intervalId);
  if (!interval) return null;

  return {
    code: `timer-${series.code}-${interval.code}-${rest.code}`,
    formatType,
    intervalSeconds: interval.effortSeconds,
    label: `${series.label} · ${interval.label} · ${rest.label}`,
    restSeconds: rest.restSeconds,
    seriesCount: series.series,
  };
}

function timerOptionsMissingMessage(
  options: CatalogTimerOptions,
  formatType: TimerFormatType,
) {
  if (options.series.length === 0) return "Aucune série n’est disponible en base.";
  if (options.rests.length === 0) return "Aucun repos n’est disponible en base.";
  if (formatType === "repetitions" && options.repetitions.length === 0) {
    return "Aucune répétition n’est disponible en base.";
  }
  if (formatType === "intervalles" && options.intervals.length === 0) {
    return "Aucun intervalle n’est disponible en base.";
  }
  return null;
}
