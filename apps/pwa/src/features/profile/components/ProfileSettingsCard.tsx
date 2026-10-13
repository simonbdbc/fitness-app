import { View } from "react-native";

import {
  type ACREAEquipmentOption,
  type ACREAImpact,
  type ACREAProfileState,
  type WeeklyProgramRegenerationState,
} from "@features/programming";
import { ActionButton } from "@shared/ui/Button";
import { Card, CardHeader } from "@shared/ui/Card";
import { BodyText } from "@shared/ui/Typography";

import { OptionGroup, Stepper } from "./ProfileControls";
import {
  impactLimit,
  muscleGroupOptions,
  objectiveOptions,
  setImpactLimit,
  setTemporaryPain,
  temporaryPain,
  toggleValue,
  weekdayOptions,
} from "../domain/profilePreferences";

type ProfileSaveState = "idle" | "saving" | "saved" | "error";
type ProfileRegenerationStatus =
  | "idle"
  | "loading"
  | "regenerating"
  | "success"
  | "error";

export function ProfileSettingsCard({
  draft,
  equipmentOptions,
  hasUnsavedChanges,
  isProfileComplete,
  onChange,
  onCancel,
  onRegenerate,
  onSave,
  regenerationMessage,
  regenerationState,
  regenerationStatus,
  saveState,
  syncError,
}: {
  draft: ACREAProfileState;
  equipmentOptions: ACREAEquipmentOption[];
  hasUnsavedChanges: boolean;
  isProfileComplete: boolean;
  onChange: (profile: ACREAProfileState) => void;
  onCancel: () => void;
  onRegenerate: () => void;
  onSave: () => void;
  regenerationMessage: string;
  regenerationState: WeeklyProgramRegenerationState | null;
  regenerationStatus: ProfileRegenerationStatus;
  saveState: ProfileSaveState;
  syncError: string | null;
}) {
  return (
    <Card>
      <CardHeader title="Réglages du programme" />
      <OptionGroup label="Objectif">
        {objectiveOptions.map(([code, label, objective]) => (
          <ActionButton
            key={code}
            onPress={() => onChange({ ...draft, objectiveCode: code, objective })}
            variant={draft.objectiveCode === code ? "primary" : "secondary"}
          >
            {label}
          </ActionButton>
        ))}
      </OptionGroup>

      <View className="flex-row flex-wrap gap-3">
        <Stepper
          initialValue={3}
          label="Sessions par semaine"
          maximum={7}
          minimum={1}
          onChange={(weeklyFrequency) => onChange({ ...draft, weeklyFrequency })}
          value={draft.weeklyFrequency}
        />
        <Stepper
          initialValue={30}
          label="Durée minimum"
          maximum={
            draft.sessionMinutesMax === null
              ? 175
              : draft.sessionMinutesMax - 5
          }
          minimum={20}
          onChange={(sessionMinutesMin) =>
            onChange({ ...draft, sessionMinutesMin })
          }
          step={5}
          value={draft.sessionMinutesMin}
        />
        <Stepper
          initialValue={45}
          label="Durée maximum"
          maximum={180}
          minimum={(draft.sessionMinutesMin ?? 20) + 5}
          onChange={(sessionMinutesMax) =>
            onChange({ ...draft, sessionMinutesMax })
          }
          step={5}
          value={draft.sessionMinutesMax}
        />
        <Stepper
          initialValue={50}
          label="Nouveauté hebdomadaire (%)"
          maximum={100}
          minimum={0}
          onChange={(weeklyNoveltyPercent) =>
            onChange({ ...draft, weeklyNoveltyPercent })
          }
          step={10}
          value={draft.weeklyNoveltyPercent}
        />
      </View>

      <OptionGroup label="Mode matériel">
        {(["aucun", "mixte"] as const).map((mode) => (
          <ActionButton
            key={mode}
            onPress={() =>
              onChange({
                ...draft,
                equipmentMode: mode,
                availableEquipment:
                  mode === "aucun" ? [] : draft.availableEquipment,
              })
            }
            variant={draft.equipmentMode === mode ? "primary" : "secondary"}
          >
            {mode === "aucun" ? "Aucun" : "Mixte"}
          </ActionButton>
        ))}
      </OptionGroup>

      {draft.excludedExerciseCodes.length > 0 ? (
        <OptionGroup label="Exercices exclus - appuyer pour restaurer">
          {draft.excludedExerciseCodes.map((exerciseCode) => (
            <ActionButton
              key={exerciseCode}
              onPress={() =>
                onChange({
                  ...draft,
                  excludedExerciseCodes: draft.excludedExerciseCodes.filter(
                    (code) => code !== exerciseCode,
                  ),
                })
              }
              variant="secondary"
            >
              {exerciseCode}
            </ActionButton>
          ))}
        </OptionGroup>
      ) : null}

      {draft.equipmentMode === "mixte"
        ? (["maison", "sport"] as const).map((category) => (
            <OptionGroup
              key={category}
              label={
                category === "maison"
                  ? "Matériel de maison"
                  : "Matériel de sport"
              }
            >
              {equipmentOptions
                .filter((option) => option.category === category)
                .map((option) => (
                  <ActionButton
                    key={option.code}
                    onPress={() =>
                      onChange({
                        ...draft,
                        availableEquipment: toggleValue(
                          draft.availableEquipment,
                          option.code,
                        ),
                      })
                    }
                    variant={
                      draft.availableEquipment.includes(option.code)
                        ? "primary"
                        : "secondary"
                    }
                  >
                    {option.label}
                  </ActionButton>
                ))}
            </OptionGroup>
          ))
        : null}

      <OptionGroup label="Jours préférés">
        {weekdayOptions.map(([weekday, label]) => (
          <ActionButton
            key={weekday}
            onPress={() =>
              onChange({
                ...draft,
                preferredWeekdays: toggleValue(
                  draft.preferredWeekdays,
                  weekday,
                ).sort(),
              })
            }
            variant={
              draft.preferredWeekdays.includes(weekday)
                ? "primary"
                : "secondary"
            }
          >
            {label}
          </ActionButton>
        ))}
      </OptionGroup>

      <OptionGroup label="Impact maximal">
        {(["faible", "modere", "eleve"] as ACREAImpact[]).map((impact) => (
          <ActionButton
            key={impact}
            onPress={() => onChange(setImpactLimit(draft, impact))}
            variant={impactLimit(draft) === impact ? "primary" : "secondary"}
          >
            {impact === "faible"
              ? "Faible"
              : impact === "modere"
                ? "Modéré"
                : "Élevé"}
          </ActionButton>
        ))}
      </OptionGroup>

      <OptionGroup label="Douleur temporaire">
        {muscleGroupOptions.map(([code, label]) => {
          const active = temporaryPain(draft).includes(code);
          return (
            <ActionButton
              key={code}
              onPress={() => onChange(setTemporaryPain(draft, code))}
              variant={active ? "primary" : "secondary"}
            >
              {label}
            </ActionButton>
          );
        })}
      </OptionGroup>

      <ActionButton
        disabled={saveState === "saving"}
        onPress={onSave}
        variant="primary"
      >
        {saveState === "saving" ? "Enregistrement..." : "Enregistrer le profil"}
      </ActionButton>
      {hasUnsavedChanges ? (
        <ActionButton
          disabled={saveState === "saving"}
          onPress={onCancel}
          variant="secondary"
        >
          Annuler les modifications
        </ActionButton>
      ) : null}
      <ActionButton
        disabled={
          hasUnsavedChanges ||
          regenerationStatus === "loading" ||
          regenerationStatus === "regenerating" ||
          !isProfileComplete ||
          !regenerationState?.canRegenerate
        }
        onPress={onRegenerate}
        variant="secondary"
      >
        {regenerationStatus === "regenerating"
          ? "Régénération..."
          : "Régénérer le programme"}
      </ActionButton>
      {saveState === "saved" ? <BodyText>Profil enregistré.</BodyText> : null}
      {saveState === "error" ? (
        <BodyText>
          {syncError ??
            "Le profil reste enregistré localement et sera resynchronisé."}
        </BodyText>
      ) : null}
      {saveState !== "error" && syncError ? (
        <BodyText>{syncError}</BodyText>
      ) : null}
      {hasUnsavedChanges ? (
        <BodyText>Enregistre le profil avant de régénérer.</BodyText>
      ) : !isProfileComplete ? (
        <BodyText>
          Renseigne les réglages, choisis au moins un jour et termine
          l’évaluation pour activer le programme.
        </BodyText>
      ) : regenerationState?.reason === "profile-unchanged" ? (
        <BodyText>Le programme utilise déjà ces réglages.</BodyText>
      ) : regenerationState?.reason === "no-preferred-day" ? (
        <BodyText>Sélectionne au moins un jour préféré.</BodyText>
      ) : null}
      {regenerationMessage ? <BodyText>{regenerationMessage}</BodyText> : null}
    </Card>
  );
}
