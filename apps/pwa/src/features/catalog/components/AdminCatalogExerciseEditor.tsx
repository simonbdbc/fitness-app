import type { PropsWithChildren } from "react";
import {
  Modal,
  Platform,
  Pressable,
  ScrollView,
  Switch,
  Text,
  TextInput,
  View,
} from "react-native";
import type { TextInputProps, TextStyle, ViewStyle } from "react-native";
import { useAppDesignTheme, useThemeTokens } from "@shared/theme";
import {
  ActionButton,
  Badge,
  BodyText,
  Card,
  CardHeader,
  SubtleText,
} from "@shared/ui";

import {
  catalogExerciseReviewStatusLabels,
  catalogExerciseReviewStatuses,
  type CatalogExercise,
  type CatalogExerciseReviewStatus,
  type CatalogEquipment,
  type CatalogFamily,
  type CatalogMuscleGroup,
  type CatalogPillar,
  type CatalogType,
} from "../types";
import {
  emptyAdminFilters,
  pillarBadgeVariant,
  replaceEquipmentOption,
  reviewStatusBadgeVariant,
  type AdminCatalogFilters,
  type ExerciseDraft,
} from "../domain/adminCatalogExercise";

const modalDismissStyle: ViewStyle = {
  bottom: 0,
  left: 0,
  position: "absolute",
  right: 0,
  top: 0,
};

const modalContentStyle = {
  maxHeight: "88%",
  maxWidth: 760,
  width: "100%",
} as ViewStyle;

export function AdminStatusFiltersPanel({
  filters,
  onFiltersChange,
}: {
  filters: AdminCatalogFilters;
  onFiltersChange: (filters: AdminCatalogFilters) => void;
}) {
  const activeCount = [
    filters.activity !== "all" ? filters.activity : undefined,
    filters.reviewStatus,
  ].filter((value) => value !== undefined).length;

  return (
    <Card>
      <CardHeader
        title="Filtres admin"
        description="Affiner par publication et état de révision."
        action={
          activeCount > 0 ? (
            <ActionButton
              className="px-3 py-2"
              onPress={() => onFiltersChange(emptyAdminFilters)}
              textClassName="text-xs"
              variant="secondary"
            >
              Réinitialiser
            </ActionButton>
          ) : (
            <Badge variant="muted">Tous</Badge>
          )
        }
      />
      <FilterGroup title="Publication">
        {(
          [
            ["all", "Tous"],
            ["active", "Actifs"],
            ["inactive", "Inactifs"],
          ] as const
        ).map(([activity, label]) => (
          <SelectButton
            active={filters.activity === activity}
            key={activity}
            label={label}
            onPress={() => onFiltersChange({ ...filters, activity })}
          />
        ))}
      </FilterGroup>
      <FilterGroup title="État">
        <SelectButton
          active={!filters.reviewStatus}
          label="Tous"
          onPress={() =>
            onFiltersChange({ ...filters, reviewStatus: undefined })
          }
        />
        {catalogExerciseReviewStatuses.map((reviewStatus) => (
          <SelectButton
            active={filters.reviewStatus === reviewStatus}
            key={reviewStatus}
            label={catalogExerciseReviewStatusLabels[reviewStatus]}
            onPress={() => onFiltersChange({ ...filters, reviewStatus })}
          />
        ))}
      </FilterGroup>
    </Card>
  );
}

export function AdminExerciseModal({
  draft,
  equipment,
  exercise,
  families,
  isSaving,
  muscleGroups,
  onClose,
  onDelete,
  onDraftChange,
  onSave,
  pillars,
  types,
}: {
  draft: ExerciseDraft | null;
  equipment: CatalogEquipment[];
  exercise: CatalogExercise | null;
  families: CatalogFamily[];
  isSaving: boolean;
  muscleGroups: CatalogMuscleGroup[];
  onClose: () => void;
  onDelete: () => void;
  onDraftChange: (draft: ExerciseDraft) => void;
  onSave: () => void;
  pillars: CatalogPillar[];
  types: CatalogType[];
}) {
  const tokens = useThemeTokens();
  const designTheme = useAppDesignTheme();
  const selectedPillar = draft
    ? (pillars.find((pillar) => pillar.id === draft.pillarId) ?? null)
    : null;
  const availableFamilies = families;
  const panelShadowStyle =
    Platform.OS === "web"
      ? ({
          boxShadow: `0 -20px 48px ${tokens.colors.shadow}`,
        } as unknown as ViewStyle)
      : undefined;

  return (
    <Modal
      animationType="fade"
      onRequestClose={onClose}
      transparent
      visible={exercise !== null && draft !== null}
    >
      {exercise && draft ? (
        <View
          className="flex-1 items-center justify-end"
          style={{ backgroundColor: tokens.colors.overlay }}
        >
          <Pressable
            accessibilityLabel="Fermer la fiche catalogue"
            accessibilityRole="button"
            onPress={onClose}
            style={modalDismissStyle}
          />

          <View
            className="box-border w-full max-w-full min-w-0 border px-4 pt-4"
            style={[
              modalContentStyle,
              {
                backgroundColor: tokens.colors.surface,
                borderColor: tokens.colors.border,
                borderTopLeftRadius: designTheme.radii.panel,
                borderTopRightRadius: designTheme.radii.panel,
              },
              panelShadowStyle,
            ]}
          >
            <View className="w-full max-w-full min-w-0 flex-row items-start justify-between gap-3 pb-3">
              <View className="min-w-0 flex-1 gap-2">
                <AdminTextInput
                  accessibilityLabel="Nom de l'exercice"
                  onChangeText={(name) => onDraftChange({ ...draft, name })}
                  style={{ fontSize: 20, fontWeight: "800", minHeight: 44 }}
                  value={draft.name}
                />
                <View className="flex-row flex-wrap gap-2">
                  <Badge
                    variant={pillarBadgeVariant(selectedPillar?.code ?? "")}
                  >
                    {selectedPillar?.label ?? "Pilier"}
                  </Badge>
                  <Badge variant="muted">
                    {draft.familyIds.length} famille
                  </Badge>
                  <Badge variant={draft.isActive ? "success" : "muted"}>
                    {draft.isActive ? "Actif" : "Inactif"}
                  </Badge>
                  <Badge variant={reviewStatusBadgeVariant(draft.reviewStatus)}>
                    {catalogExerciseReviewStatusLabels[draft.reviewStatus]}
                  </Badge>
                </View>
              </View>
              <ActionButton
                className="shrink-0 px-3 py-2"
                onPress={onClose}
                textClassName="text-xs"
                variant="secondary"
              >
                Fermer
              </ActionButton>
            </View>

            <ScrollView
              contentContainerStyle={{ paddingBottom: 20 }}
              contentInsetAdjustmentBehavior="automatic"
            >
              <View className="w-full max-w-full min-w-0 gap-4">
                <AdminDetailSection title="Description">
                  <AdminTextInput
                    multiline
                    onChangeText={(description) =>
                      onDraftChange({ ...draft, description })
                    }
                    value={draft.description}
                  />
                </AdminDetailSection>

                <AdminDetailSection title="Informations">
                  <FormGrid>
                    <Field label="Pilier">
                      <OptionButtonGroup
                        options={pillars.map((pillar) => ({
                          label: pillar.label,
                          value: pillar.id,
                        }))}
                        selectedValues={
                          draft.pillarId !== null ? [draft.pillarId] : []
                        }
                        onToggle={(pillarId) => {
                          const nextPillarId =
                            draft.pillarId === pillarId ? null : pillarId;

                          onDraftChange({
                            ...draft,
                            pillarId: nextPillarId,
                          });
                        }}
                      />
                    </Field>
                    <Field label="Famille">
                      <OptionButtonGroup
                        options={availableFamilies.map((family) => ({
                          label: family.label,
                          value: family.id,
                        }))}
                        selectedValues={draft.familyIds}
                        onToggle={(familyId) =>
                          onDraftChange({
                            ...draft,
                            familyIds: draft.familyIds.includes(familyId)
                              ? []
                              : [familyId],
                          })
                        }
                      />
                    </Field>
                    <Field label="Type">
                      <OptionButtonGroup
                        options={types.map((type) => ({
                          label: type.label,
                          value: type.id,
                        }))}
                        selectedValues={
                          draft.typeId !== null ? [draft.typeId] : []
                        }
                        onToggle={(typeId) =>
                          onDraftChange({
                            ...draft,
                            typeId: draft.typeId === typeId ? null : typeId,
                          })
                        }
                      />
                    </Field>
                    <Field label="Groupes musculaires">
                      <OptionButtonGroup
                        multiple
                        options={muscleGroups.map((group) => ({
                          label: group.label,
                          value: group.id,
                        }))}
                        selectedValues={draft.muscleGroupIds}
                        onToggle={(muscleGroupId) =>
                          onDraftChange({
                            ...draft,
                            muscleGroupIds: draft.muscleGroupIds.includes(
                              muscleGroupId,
                            )
                              ? draft.muscleGroupIds.filter(
                                  (selectedMuscleGroupId) =>
                                    selectedMuscleGroupId !== muscleGroupId,
                                )
                              : [...draft.muscleGroupIds, muscleGroupId],
                          })
                        }
                      />
                    </Field>
                    <View className="w-full max-w-full min-w-0 flex-row flex-wrap gap-3">
                      <Field
                        className="min-w-[120px] flex-1"
                        label="Niveau min"
                      >
                        <AdminTextInput
                          keyboardType="numeric"
                          onChangeText={(levelMin) =>
                            onDraftChange({ ...draft, levelMin })
                          }
                          value={draft.levelMin}
                        />
                      </Field>
                      <Field
                        className="min-w-[120px] flex-1"
                        label="Niveau max"
                      >
                        <AdminTextInput
                          keyboardType="numeric"
                          onChangeText={(levelMax) =>
                            onDraftChange({ ...draft, levelMax })
                          }
                          value={draft.levelMax}
                        />
                      </Field>
                    </View>
                    <Field label="Impact">
                      <AdminTextInput
                        onChangeText={(impact) =>
                          onDraftChange({ ...draft, impact })
                        }
                        value={draft.impact}
                      />
                    </Field>
                  </FormGrid>
                </AdminDetailSection>

                <AdminDetailSection title="Options d'équipement">
                  <View className="gap-3">
                    {draft.equipmentOptions.map((option, optionIndex) => (
                      <View
                        className="gap-3 border p-3"
                        key={`${optionIndex}-${option.kind}`}
                        style={{
                          borderColor: tokens.colors.border,
                          borderRadius: designTheme.radii.control,
                        }}
                      >
                        <View className="flex-row flex-wrap items-center justify-between gap-2">
                          <Badge variant="muted">
                            Option {optionIndex + 1}
                          </Badge>
                          {draft.equipmentOptions.length > 1 ? (
                            <ActionButton
                              className="px-3 py-2"
                              onPress={() =>
                                onDraftChange({
                                  ...draft,
                                  equipmentOptions:
                                    draft.equipmentOptions.filter(
                                      (_, index) => index !== optionIndex,
                                    ),
                                })
                              }
                              textClassName="text-xs"
                              variant="danger"
                            >
                              Supprimer
                            </ActionButton>
                          ) : null}
                        </View>
                        <View className="flex-row flex-wrap gap-2">
                          <SelectButton
                            active={option.kind === "bodyweight"}
                            label="Sans matériel"
                            onPress={() =>
                              onDraftChange({
                                ...draft,
                                equipmentOptions: replaceEquipmentOption(
                                  draft.equipmentOptions,
                                  optionIndex,
                                  { kind: "bodyweight", equipmentCodes: [] },
                                ),
                              })
                            }
                          />
                          <SelectButton
                            active={option.kind === "equipment"}
                            label="Avec équipement"
                            onPress={() =>
                              onDraftChange({
                                ...draft,
                                equipmentOptions: replaceEquipmentOption(
                                  draft.equipmentOptions,
                                  optionIndex,
                                  option.kind === "equipment"
                                    ? option
                                    : { kind: "equipment", equipmentCodes: [] },
                                ),
                              })
                            }
                          />
                        </View>
                        {option.kind === "equipment" ? (
                          <View className="gap-3">
                            {(["maison", "sport"] as const).map((category) => {
                              const categoryEquipment = equipment.filter(
                                (item) => item.category === category,
                              );
                              return (
                                <Field
                                  key={category}
                                  label={
                                    category === "maison"
                                      ? "Matériel de maison"
                                      : "Matériel de sport"
                                  }
                                >
                                  <OptionButtonGroup
                                    multiple
                                    onToggle={(equipmentCode) =>
                                      onDraftChange({
                                        ...draft,
                                        equipmentOptions:
                                          replaceEquipmentOption(
                                            draft.equipmentOptions,
                                            optionIndex,
                                            {
                                              kind: "equipment",
                                              equipmentCodes:
                                                option.equipmentCodes.includes(
                                                  equipmentCode,
                                                )
                                                  ? option.equipmentCodes.filter(
                                                      (code) =>
                                                        code !== equipmentCode,
                                                    )
                                                  : [
                                                      ...option.equipmentCodes,
                                                      equipmentCode,
                                                    ],
                                            },
                                          ),
                                      })
                                    }
                                    options={categoryEquipment.map((item) => ({
                                      label: item.label,
                                      value: item.code,
                                    }))}
                                    selectedValues={option.equipmentCodes}
                                  />
                                </Field>
                              );
                            })}
                          </View>
                        ) : null}
                      </View>
                    ))}
                    <ActionButton
                      onPress={() =>
                        onDraftChange({
                          ...draft,
                          equipmentOptions: [
                            ...draft.equipmentOptions,
                            { kind: "equipment", equipmentCodes: [] },
                          ],
                        })
                      }
                      variant="secondary"
                    >
                      Ajouter une option
                    </ActionButton>
                  </View>
                </AdminDetailSection>

                <AdminDetailSection title="Position de départ">
                  <AdminTextInput
                    multiline
                    onChangeText={(startPositionStepsText) =>
                      onDraftChange({ ...draft, startPositionStepsText })
                    }
                    value={draft.startPositionStepsText}
                  />
                </AdminDetailSection>

                <AdminDetailSection title="Exécution aller">
                  <AdminTextInput
                    multiline
                    onChangeText={(outboundExecutionStepsText) =>
                      onDraftChange({ ...draft, outboundExecutionStepsText })
                    }
                    value={draft.outboundExecutionStepsText}
                  />
                </AdminDetailSection>

                <AdminDetailSection title="Retour au départ">
                  <AdminTextInput
                    multiline
                    onChangeText={(returnExecutionStepsText) =>
                      onDraftChange({ ...draft, returnExecutionStepsText })
                    }
                    value={draft.returnExecutionStepsText}
                  />
                </AdminDetailSection>

                <AdminDetailSection title="Progression">
                  <FormGrid>
                    <Field label="Régression">
                      <AdminTextInput
                        multiline
                        onChangeText={(regression) =>
                          onDraftChange({ ...draft, regression })
                        }
                        value={draft.regression}
                      />
                    </Field>
                    <Field label="Progression">
                      <AdminTextInput
                        multiline
                        onChangeText={(progression) =>
                          onDraftChange({ ...draft, progression })
                        }
                        value={draft.progression}
                      />
                    </Field>
                  </FormGrid>
                </AdminDetailSection>

                <AdminDetailSection title="Erreurs fréquentes">
                  <AdminTextInput
                    multiline
                    onChangeText={(commonErrorsText) =>
                      onDraftChange({ ...draft, commonErrorsText })
                    }
                    value={draft.commonErrorsText}
                  />
                </AdminDetailSection>

                <AdminDetailSection title="Conseils">
                  <AdminTextInput
                    multiline
                    onChangeText={(tips) => onDraftChange({ ...draft, tips })}
                    value={draft.tips}
                  />
                </AdminDetailSection>

                <AdminDetailSection title="Publication">
                  <View className="w-full max-w-full min-w-0 gap-4">
                    <View className="w-full max-w-full min-w-0 flex-row flex-wrap items-center justify-between gap-3">
                      <View className="min-w-0 flex-1 gap-1">
                        <BodyText className="font-bold">
                          {draft.isActive ? "Actif" : "Inactif"}
                        </BodyText>
                        <SubtleText>
                          Visible dans la Bibliothèque uniquement si actif.
                        </SubtleText>
                      </View>
                      <Switch
                        onValueChange={(isActive) =>
                          onDraftChange({ ...draft, isActive })
                        }
                        value={draft.isActive}
                      />
                    </View>
                    <ReviewStatusSelect
                      onChange={(reviewStatus) =>
                        onDraftChange({ ...draft, reviewStatus })
                      }
                      value={draft.reviewStatus}
                    />
                  </View>
                </AdminDetailSection>

                <View className="w-full max-w-full min-w-0 flex-row flex-wrap justify-end gap-2 pb-2">
                  <ActionButton
                    disabled={isSaving}
                    onPress={onSave}
                    variant="primary"
                  >
                    {isSaving ? "Enregistrement..." : "Enregistrer"}
                  </ActionButton>
                  <ActionButton
                    disabled={isSaving}
                    onPress={onDelete}
                    variant="secondary"
                  >
                    Supprimer
                  </ActionButton>
                </View>
              </View>
            </ScrollView>
          </View>
        </View>
      ) : null}
    </Modal>
  );
}

function ReviewStatusSelect({
  onChange,
  value,
}: {
  onChange: (value: CatalogExerciseReviewStatus) => void;
  value: CatalogExerciseReviewStatus;
}) {
  return (
    <View className="w-full max-w-full min-w-0 gap-2">
      <SubtleText className="font-bold uppercase tracking-[0.8px]">
        État de révision
      </SubtleText>
      <View className="flex-row flex-wrap gap-2">
        {catalogExerciseReviewStatuses.map((reviewStatus) => (
          <SelectButton
            active={value === reviewStatus}
            key={reviewStatus}
            label={catalogExerciseReviewStatusLabels[reviewStatus]}
            onPress={() => onChange(reviewStatus)}
          />
        ))}
      </View>
    </View>
  );
}

function AdminDetailSection({
  children,
  title,
}: PropsWithChildren<{ title: string }>) {
  const tokens = useThemeTokens();

  return (
    <View
      className="w-full max-w-full min-w-0 gap-2 border-t pt-3"
      style={{ borderColor: tokens.colors.borderSoft }}
    >
      <SubtleText className="font-bold uppercase tracking-[0.8px]">
        {title}
      </SubtleText>
      {children}
    </View>
  );
}

function FormGrid({ children }: PropsWithChildren) {
  return <View className="w-full max-w-full min-w-0 gap-3">{children}</View>;
}

function Field({
  children,
  className,
  label,
}: PropsWithChildren<{ className?: string; label: string }>) {
  return (
    <View className={`w-full max-w-full min-w-0 gap-1.5 ${className ?? ""}`}>
      <SubtleText className="font-bold uppercase tracking-[0.8px]">
        {label}
      </SubtleText>
      {children}
    </View>
  );
}

function FilterGroup({
  children,
  title,
}: PropsWithChildren<{ title: string }>) {
  return (
    <View className="w-full max-w-full min-w-0 gap-2">
      <SubtleText className="font-bold uppercase tracking-[0.8px]">
        {title}
      </SubtleText>
      <View className="flex-row flex-wrap gap-2">{children}</View>
    </View>
  );
}

function OptionButtonGroup<T extends string | number>({
  multiple = false,
  onToggle,
  options,
  selectedValues,
}: {
  multiple?: boolean;
  onToggle: (value: T) => void;
  options: { label: string; value: T }[];
  selectedValues: T[];
}) {
  if (options.length === 0) {
    return null;
  }

  return (
    <View className="flex-row flex-wrap gap-2">
      {options.map((option) => (
        <SelectButton
          active={selectedValues.includes(option.value)}
          key={option.value}
          label={option.label}
          onPress={() => {
            if (!multiple && selectedValues.includes(option.value)) {
              return;
            }

            onToggle(option.value);
          }}
        />
      ))}
    </View>
  );
}

function SelectButton({
  active,
  label,
  onPress,
}: {
  active: boolean;
  label: string;
  onPress: () => void;
}) {
  const tokens = useThemeTokens();
  const designTheme = useAppDesignTheme();

  return (
    <Pressable
      accessibilityRole="button"
      className="max-w-full min-w-0 border px-3 py-2"
      onPress={onPress}
      style={{
        backgroundColor: active
          ? tokens.colors.actionBackground
          : tokens.colors.surfaceElevated,
        borderColor: active
          ? tokens.colors.actionBackground
          : tokens.colors.border,
        borderRadius: designTheme.radii.control,
      }}
    >
      <Text
        className="max-w-full min-w-0 text-xs font-bold"
        numberOfLines={2}
        style={{
          color: active ? tokens.colors.actionText : tokens.colors.textPrimary,
        }}
      >
        {label}
      </Text>
    </Pressable>
  );
}

function AdminTextInput({ style, ...props }: TextInputProps) {
  const tokens = useThemeTokens();
  const designTheme = useAppDesignTheme();
  const inputStyle: TextStyle = {
    backgroundColor: tokens.colors.surfaceElevated,
    borderColor: tokens.colors.border,
    borderRadius: designTheme.radii.control,
    color: tokens.colors.textPrimary,
    minHeight: props.multiline ? 92 : undefined,
    textAlignVertical: props.multiline ? "top" : "center",
  };

  return (
    <TextInput
      {...props}
      className="box-border w-full max-w-full min-w-0 border px-3 py-2.5 text-sm"
      placeholderTextColor={tokens.colors.textMuted}
      style={[inputStyle, style]}
    />
  );
}
