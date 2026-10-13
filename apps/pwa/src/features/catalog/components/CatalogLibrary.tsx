import { memo, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import {
  ActivityIndicator,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
  type ViewStyle,
} from "react-native";

import { useAppDesignTheme, useThemeTokens } from "@shared/theme";
import {
  ActionButton,
  Badge,
  BodyText,
  Card,
  CardHeader,
  SubtleText,
  TitleText,
} from "@shared/ui";

import {
  exerciseLevelLabel,
  groupExercises,
  impactBadgeVariant,
  impactLabel,
  pillarBadgeVariant,
  type CatalogFamilyGroup,
  type CatalogPillarGroup,
} from "../domain/catalogPresentation";
import { getExerciseLibraryMedia } from "../data/exerciseLibraryMedia";
import {
  ExerciseCardPoster,
  ExerciseDetailAnimation,
  useReducedMotionPreference,
} from "./ExerciseMedia";
import type {
  CatalogExercise,
  CatalogEquipmentFilter,
  CatalogFamily,
  CatalogFilterOptions,
  CatalogFilters,
} from "../types";

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
const exercisesPerFamilyPage = 20;

export function LoadingState() {
  const tokens = useThemeTokens();

  return (
    <Card>
      <View className="flex-row items-center gap-3">
        <ActivityIndicator
          accessibilityLabel="Chargement de la bibliothèque"
          color={tokens.colors.accent}
        />
        <BodyText>Chargement de la bibliothèque...</BodyText>
      </View>
    </Card>
  );
}

export function ErrorState({
  message,
  onRetry,
}: {
  message: string;
  onRetry: () => void;
}) {
  return (
    <Card variant="danger">
      <CardHeader
        title="Bibliothèque indisponible"
        description="La base locale SQLite n'a pas pu être chargée."
      />
      <BodyText selectable>{message}</BodyText>
      <ActionButton onPress={onRetry} variant="secondary">
        Réessayer
      </ActionButton>
    </Card>
  );
}

export function EmptyState({ hasFilters }: { hasFilters: boolean }) {
  return (
    <Card variant="muted">
      <CardHeader
        title="Aucun exercice"
        description={
          hasFilters
            ? "Aucun exercice ne correspond à ces filtres."
            : "La base locale ne contient pas encore d'exercice."
        }
      />
    </Card>
  );
}

export function CatalogSearchField({
  onChangeText,
  value,
}: {
  onChangeText: (value: string) => void;
  value: string;
}) {
  const tokens = useThemeTokens();
  const designTheme = useAppDesignTheme();

  return (
    <View className="w-full max-w-full min-w-0 gap-2">
      <SubtleText className="font-bold uppercase tracking-[0.8px]">
        Rechercher
      </SubtleText>
      <View className="w-full max-w-full min-w-0 flex-row items-center gap-2">
        <TextInput
          accessibilityLabel="Rechercher un exercice"
          autoCapitalize="none"
          autoCorrect={false}
          className="box-border min-h-11 min-w-0 flex-1 border px-3 py-2.5"
          clearButtonMode="while-editing"
          onChangeText={onChangeText}
          placeholder="Ex. squat, épaules, mobilité..."
          placeholderTextColor={tokens.colors.textMuted}
          returnKeyType="search"
          style={{
            backgroundColor: tokens.colors.surfaceElevated,
            borderColor: tokens.colors.border,
            borderRadius: designTheme.radii.control,
            color: tokens.colors.textPrimary,
          }}
          value={value}
        />
        {value ? (
          <ActionButton
            className="shrink-0 px-3 py-2.5"
            onPress={() => onChangeText("")}
            textClassName="text-xs"
            variant="secondary"
          >
            Effacer
          </ActionButton>
        ) : null}
      </View>
    </View>
  );
}

export function CatalogExerciseList({
  exercises,
  onExerciseVisible,
  onExercisePress,
  renderExerciseBadges,
  selectedFamilyId,
}: {
  exercises: CatalogExercise[];
  onExerciseVisible?: (exercise: CatalogExercise) => void;
  onExercisePress: (exercise: CatalogExercise) => void;
  renderExerciseBadges?: (exercise: CatalogExercise) => ReactNode;
  selectedFamilyId?: number;
}) {
  const tokens = useThemeTokens();
  const groups = useMemo(
    () => groupExercises(exercises, selectedFamilyId),
    [exercises, selectedFamilyId],
  );

  return (
    <View
      className="w-full max-w-full min-w-0 gap-5 border-t pt-4"
      style={{ borderColor: tokens.colors.borderSoft }}
    >
      {groups.map((group) => (
        <PillarSection
          group={group}
          key={group.pillarId}
          onExerciseVisible={onExerciseVisible}
          onExercisePress={onExercisePress}
          renderExerciseBadges={renderExerciseBadges}
        />
      ))}
    </View>
  );
}

export function CatalogFiltersPanel({
  activeFilterCount,
  availableFamilies,
  filterOptions,
  filters,
  onFiltersChange,
  onReset,
  onSearchChange,
  pillarRequired = false,
  searchQuery,
}: {
  activeFilterCount: number;
  availableFamilies: CatalogFamily[];
  filterOptions: CatalogFilterOptions;
  filters: CatalogFilters;
  onFiltersChange: (filters: CatalogFilters) => void;
  onReset?: () => void;
  onSearchChange?: (query: string) => void;
  pillarRequired?: boolean;
  searchQuery?: string;
}) {
  function updatePillar(pillarId: number | undefined) {
    if (
      (pillarId === undefined && pillarRequired) ||
      filters.pillarId === pillarId
    ) {
      return;
    }

    onFiltersChange({
      ...filters,
      familyId: undefined,
      pillarId,
    });
  }

  function updateFamily(familyId: number | undefined) {
    onFiltersChange({
      ...filters,
      familyId: filters.familyId === familyId ? undefined : familyId,
    });
  }

  function updateEquipment(equipment: CatalogEquipmentFilter | undefined) {
    onFiltersChange({
      ...filters,
      equipment: equipmentFiltersAreEqual(filters.equipment, equipment)
        ? undefined
        : equipment,
    });
  }

  function updateLevel(level: number | undefined) {
    onFiltersChange({
      ...filters,
      level: filters.level === level ? undefined : level,
    });
  }

  return (
    <Card>
      <CardHeader
        title="Filtres"
        description="Affiner par pilier, famille, équipement et niveau."
        action={
          activeFilterCount > 0 ? (
            <ActionButton
              className="px-3 py-2"
              onPress={() => onReset?.() ?? onFiltersChange({})}
              textClassName="text-xs"
              variant="secondary"
            >
              Réinitialiser
            </ActionButton>
          ) : (
            <Badge variant="muted">Réglages</Badge>
          )
        }
      />
      {onSearchChange ? (
        <CatalogSearchField
          onChangeText={onSearchChange}
          value={searchQuery ?? ""}
        />
      ) : null}
      <FilterGroup title="Pilier">
        {!pillarRequired ? (
          <FilterChip
            active={!filters.pillarId}
            label="Tous"
            onPress={() => updatePillar(undefined)}
          />
        ) : null}
        {filterOptions.pillars.map((pillar) => (
          <FilterChip
            active={filters.pillarId === pillar.id}
            key={pillar.id}
            label={pillar.label}
            onPress={() => updatePillar(pillar.id)}
          />
        ))}
      </FilterGroup>
      <FilterGroup title="Famille">
        <FilterChip
          active={!filters.familyId}
          label="Toutes"
          onPress={() => updateFamily(undefined)}
        />
        {availableFamilies.map((family) => (
          <FilterChip
            active={filters.familyId === family.id}
            key={family.id}
            label={family.label}
            onPress={() => updateFamily(family.id)}
          />
        ))}
      </FilterGroup>
      <FilterGroup title="Équipement">
        <FilterChip
          active={!filters.equipment}
          label="Tous"
          onPress={() => updateEquipment(undefined)}
        />
        {filterOptions.hasBodyweightOption ? (
          <FilterChip
            active={filters.equipment?.kind === "bodyweight"}
            label="Aucun équipement"
            onPress={() => updateEquipment({ kind: "bodyweight" })}
          />
        ) : null}
        {filterOptions.equipment.map((equipment) => (
          <FilterChip
            active={
              filters.equipment?.kind === "equipment" &&
              filters.equipment.equipmentCode === equipment.code
            }
            key={equipment.code}
            label={equipment.label}
            onPress={() =>
              updateEquipment({
                kind: "equipment",
                equipmentCode: equipment.code,
              })
            }
          />
        ))}
      </FilterGroup>
      <FilterGroup title="Niveau">
        <FilterChip
          active={typeof filters.level !== "number"}
          label="Tous"
          onPress={() => updateLevel(undefined)}
        />
        {filterOptions.levels.map((level) => (
          <FilterChip
            active={filters.level === level}
            key={level}
            label={`${level}`}
            onPress={() => updateLevel(level)}
          />
        ))}
      </FilterGroup>
    </Card>
  );
}

function equipmentFiltersAreEqual(
  current: CatalogEquipmentFilter | undefined,
  next: CatalogEquipmentFilter | undefined,
): boolean {
  if (!current || !next) {
    return current === next;
  }

  return (
    current.kind === next.kind &&
    (current.kind === "bodyweight" ||
      (next.kind === "equipment" &&
        current.equipmentCode === next.equipmentCode))
  );
}

function FilterGroup({
  children,
  title,
}: {
  children: ReactNode;
  title: string;
}) {
  return (
    <View className="w-full max-w-full min-w-0 gap-2">
      <SubtleText className="font-bold uppercase tracking-[0.8px]">
        {title}
      </SubtleText>
      <View className="flex-row flex-wrap gap-2">{children}</View>
    </View>
  );
}

function FilterChip({
  active,
  label,
  onPress,
}: {
  active: boolean;
  label: string;
  onPress: () => void;
}) {
  return (
    <Pressable accessibilityRole="button" onPress={onPress}>
      <Badge variant={active ? "dark" : "muted"}>{label}</Badge>
    </Pressable>
  );
}

function PillarSection({
  group,
  onExerciseVisible,
  onExercisePress,
  renderExerciseBadges,
}: {
  group: CatalogPillarGroup;
  onExerciseVisible?: (exercise: CatalogExercise) => void;
  onExercisePress: (exercise: CatalogExercise) => void;
  renderExerciseBadges?: (exercise: CatalogExercise) => ReactNode;
}) {
  return (
    <View className="w-full max-w-full min-w-0 gap-3">
      <View className="w-full max-w-full min-w-0 flex-row flex-wrap items-start justify-between gap-2">
        <View className="min-w-0 flex-1 gap-1">
          <TitleText className="text-xl leading-7">
            {group.pillarLabel}
          </TitleText>
          <BodyText>{group.totalCount} exercices disponibles</BodyText>
        </View>
        <Badge variant="muted">{group.families.length} familles</Badge>
      </View>

      {group.families.map((familyGroup) => (
        <FamilySection
          familyGroup={familyGroup}
          key={`${group.pillarId}-${familyGroup.family.id}`}
          onExerciseVisible={onExerciseVisible}
          onExercisePress={onExercisePress}
          renderExerciseBadges={renderExerciseBadges}
        />
      ))}
    </View>
  );
}

function FamilySection({
  familyGroup,
  onExerciseVisible,
  onExercisePress,
  renderExerciseBadges,
}: {
  familyGroup: CatalogFamilyGroup;
  onExerciseVisible?: (exercise: CatalogExercise) => void;
  onExercisePress: (exercise: CatalogExercise) => void;
  renderExerciseBadges?: (exercise: CatalogExercise) => ReactNode;
}) {
  const tokens = useThemeTokens();
  const [visibleCount, setVisibleCount] = useState(exercisesPerFamilyPage);
  const visibleExercises = familyGroup.exercises.slice(0, visibleCount);
  const remainingCount =
    familyGroup.exercises.length - visibleExercises.length;

  useEffect(() => {
    setVisibleCount(exercisesPerFamilyPage);
  }, [familyGroup.family.id, familyGroup.exercises.length]);

  return (
    <View className="w-full max-w-full min-w-0 gap-2">
      <View
        className="w-full max-w-full min-w-0 flex-row flex-wrap items-center gap-2 border-t pt-3"
        style={{ borderColor: tokens.colors.borderSoft }}
      >
        <Text
          className="min-w-0 flex-1 text-base font-extrabold"
          style={{ color: tokens.colors.textPrimary }}
        >
          {familyGroup.family.label}
        </Text>
        <Badge variant="muted">{familyGroup.exercises.length}</Badge>
      </View>

      <View className="w-full max-w-full min-w-0 gap-2">
        {visibleExercises.map((exercise) => (
          <ExerciseCard
            exercise={exercise}
            key={exercise.id}
            onVisible={onExerciseVisible}
            onExercisePress={onExercisePress}
            renderExerciseBadges={renderExerciseBadges}
          />
        ))}
        {remainingCount > 0 ? (
          <ActionButton
            onPress={() =>
              setVisibleCount((current) => current + exercisesPerFamilyPage)
            }
            variant="secondary"
          >
            Afficher encore {Math.min(remainingCount, exercisesPerFamilyPage)}{" "}
            exercices
          </ActionButton>
        ) : null}
      </View>
    </View>
  );
}

const ExerciseCard = memo(function ExerciseCard({
  exercise,
  onExercisePress,
  onVisible,
  renderExerciseBadges,
}: {
  exercise: CatalogExercise;
  onExercisePress: (exercise: CatalogExercise) => void;
  onVisible?: (exercise: CatalogExercise) => void;
  renderExerciseBadges?: (exercise: CatalogExercise) => ReactNode;
}) {
  const cardRef = useExerciseCardVisibility(exercise, onVisible);
  const primaryFamilyLabel =
    exercise.families[0]?.label ?? "Famille non classee";
  const reference = getExerciseLibraryMedia(exercise);
  const needsEditorialReview = exercise.reviewStatus !== "valide";
  const isLibraryOnly = exercise.programmingStatus !== "eligible";

  return (
    <Pressable
      accessibilityLabel={`Voir le détail de ${exercise.name}`}
      accessibilityRole="button"
      onPress={() => onExercisePress(exercise)}
    >
      <View ref={cardRef}>
        <Card className="py-3">
          <View className="w-full max-w-full min-w-0 flex-row items-start gap-3">
            {reference ? (
              <ExerciseCardPoster
                exerciseName={exercise.name}
                media={reference}
              />
            ) : (
              <ExercisePosterPlaceholder exerciseName={exercise.name} />
            )}
            <View className="min-w-0 flex-1 gap-3">
              <View className="w-full max-w-full min-w-0 flex-row flex-wrap items-start justify-between gap-2">
                <View className="min-w-0 flex-1 gap-1">
                  <TitleText className="text-lg leading-6">
                    {exercise.name}
                  </TitleText>
                  <BodyText numberOfLines={2}>{exercise.description}</BodyText>
                </View>
                {needsEditorialReview ? (
                  <Badge variant="warning">Traduction à vérifier</Badge>
                ) : exercise.impact ? (
                  <Badge variant={impactBadgeVariant(exercise.impact)}>
                    {impactLabel(exercise.impact)}
                  </Badge>
                ) : null}
              </View>

              <View className="flex-row flex-wrap gap-2">
                <Badge variant="dark">
                  {isLibraryOnly
                    ? "Niveau à valider"
                    : exerciseLevelLabel(exercise)}
                </Badge>
                <Badge variant="info">{exercise.equipment}</Badge>
                <Badge variant="muted">{primaryFamilyLabel}</Badge>
                {renderExerciseBadges?.(exercise)}
              </View>
            </View>
          </View>
        </Card>
      </View>
    </Pressable>
  );
});

function useExerciseCardVisibility(
  exercise: CatalogExercise,
  onVisible: ((exercise: CatalogExercise) => void) | undefined,
) {
  const cardRef = useRef<View>(null);
  const wasVisibleRef = useRef(false);

  useEffect(() => {
    if (!onVisible || wasVisibleRef.current) return;
    const node = cardRef.current as unknown as Element | null;
    if (
      Platform.OS !== "web" ||
      !node ||
      typeof IntersectionObserver === "undefined"
    ) {
      wasVisibleRef.current = true;
      onVisible(exercise);
      return;
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry?.isIntersecting || entry.intersectionRatio < 0.5) return;
        wasVisibleRef.current = true;
        observer.disconnect();
        onVisible(exercise);
      },
      { threshold: [0.5] },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [exercise, onVisible]);

  return cardRef;
}

function ExercisePosterPlaceholder({ exerciseName }: { exerciseName: string }) {
  const tokens = useThemeTokens();
  const designTheme = useAppDesignTheme();

  return (
    <View
      accessibilityLabel={`Chargement de l’aperçu de ${exerciseName}`}
      accessibilityRole="image"
      style={{
        alignItems: "center",
        aspectRatio: 1,
        backgroundColor: tokens.colors.surfaceMuted,
        borderRadius: designTheme.radii.panel,
        flexShrink: 0,
        justifyContent: "center",
        width: 96,
      }}
    >
      <ActivityIndicator />
    </View>
  );
}

export function ExerciseDetailModal({
  exercise,
  isHydrating = false,
  isHydratingAnimation = false,
  loadError = "",
  onClose,
  onRequestAnimation,
  onRetry,
}: {
  exercise: CatalogExercise | null;
  isHydrating?: boolean;
  isHydratingAnimation?: boolean;
  loadError?: string;
  onClose: () => void;
  onRequestAnimation?: () => Promise<void> | void;
  onRetry?: () => void;
}) {
  const tokens = useThemeTokens();
  const designTheme = useAppDesignTheme();
  const prefersReducedMotion = useReducedMotionPreference();
  const panelShadowStyle =
    Platform.OS === "web"
      ? ({
          boxShadow: `0 -20px 48px ${tokens.colors.shadow}`,
        } as unknown as ViewStyle)
      : undefined;
  const primaryFamilyLabel =
    exercise?.families[0]?.label ?? "Famille non classee";
  const reference = exercise ? getExerciseLibraryMedia(exercise) : null;
  const needsEditorialReview = exercise?.reviewStatus !== "valide";
  const isLibraryOnly = exercise?.programmingStatus !== "eligible";

  return (
    <Modal
      animationType={prefersReducedMotion ? "none" : "fade"}
      onRequestClose={onClose}
      transparent
      visible={exercise !== null}
    >
      {exercise ? (
        <View
          className="flex-1 items-center justify-end"
          style={{ backgroundColor: tokens.colors.overlay }}
        >
          <Pressable
            accessibilityLabel="Fermer le détail de l'exercice"
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
                <TitleText className="text-xl leading-7" selectable>
                  {exercise.name}
                </TitleText>
                <View className="flex-row flex-wrap gap-2">
                  <Badge variant={pillarBadgeVariant(exercise.pillarCode)}>
                    {exercise.pillarLabel}
                  </Badge>
                  <Badge variant="muted">{primaryFamilyLabel}</Badge>
                  {needsEditorialReview ? (
                    <Badge variant="warning">Traduction à vérifier</Badge>
                  ) : exercise.impact ? (
                    <Badge variant={impactBadgeVariant(exercise.impact)}>
                      {impactLabel(exercise.impact)}
                    </Badge>
                  ) : null}
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
                {isHydrating ? (
                  <View className="flex-row items-center gap-2">
                    <ActivityIndicator />
                    <BodyText>Chargement de la fiche et de son aperçu…</BodyText>
                  </View>
                ) : null}
                {loadError ? (
                  <Card variant="muted">
                    <BodyText>{loadError}</BodyText>
                    {onRetry ? (
                      <ActionButton onPress={onRetry} variant="secondary">
                        Réessayer le chargement
                      </ActionButton>
                    ) : null}
                  </Card>
                ) : null}
                {reference ? (
                  <ExerciseDetailAnimation
                    exerciseName={exercise.name}
                    isAnimationLoading={isHydratingAnimation}
                    media={reference}
                    onRequestAnimation={onRequestAnimation}
                  />
                ) : null}
                {reference ? (
                  <Card variant="muted">
                    <Badge variant="warning">
                      {needsEditorialReview
                        ? "Fiche à vérifier"
                        : "Référence hors programmation"}
                    </Badge>
                    <BodyText>
                      {needsEditorialReview
                        ? "Cette fiche de la bibliothèque doit encore être relue avant son éligibilité à la programmation."
                        : "Cette fiche est disponible dans la bibliothèque, mais reste exclue des programmes tant que son éligibilité n'est pas validée."}
                    </BodyText>
                  </Card>
                ) : null}

                <DetailSection title="Description">
                  <BodyText
                    selectable
                    style={{ color: tokens.colors.textPrimary }}
                  >
                    {exercise.description}
                  </BodyText>
                </DetailSection>

                <DetailSection title="Informations">
                  <View className="w-full max-w-full min-w-0 gap-0">
                    <DetailRow label="Pilier" value={exercise.pillarLabel} />
                    <DetailRow
                      label="Familles"
                      value={exercise.families
                        .map((family) => family.label)
                        .join(", ")}
                    />
                    <DetailRow
                      label="Niveaux"
                      value={
                        isLibraryOnly
                          ? "À valider"
                          : exerciseLevelLabel(exercise)
                      }
                    />
                    <DetailRow
                      label="Équipement"
                      value={exercise.equipment}
                    />
                    <DetailRow label="Type" value={exercise.type.label} />
                    {exercise.muscleGroups.length > 0 ? (
                      <DetailRow
                        label="Groupes musculaires"
                        value={exercise.muscleGroups
                          .map((group) => group.label)
                          .join(", ")}
                      />
                    ) : null}
                    {exercise.impact ? (
                      <DetailRow
                        label="Impact"
                        value={impactLabel(exercise.impact)}
                      />
                    ) : null}
                  </View>
                </DetailSection>

                <OptionalDetailList
                  items={
                    exercise.startPositionSteps.length > 0
                      ? exercise.startPositionSteps
                      : exercise.positionSteps
                  }
                  title="Position de départ"
                />
                <OptionalDetailList
                  items={
                    exercise.outboundExecutionSteps.length > 0
                      ? exercise.outboundExecutionSteps
                      : exercise.executionSteps
                  }
                  title="Exécution aller"
                />
                <OptionalDetailList
                  items={exercise.returnExecutionSteps}
                  title="Retour au départ"
                />

                <OptionalDetailList
                  items={splitDetailLines(exercise.tips)}
                  title="Bénéfices"
                />
                <OptionalDetailList
                  items={splitDetailLines(exercise.adaptedVersion)}
                  title="Variantes et alternatives"
                />

                {exercise.regression || exercise.progression ? (
                  <DetailSection title="Progression">
                    <View className="w-full max-w-full min-w-0 gap-0">
                      {exercise.regression ? (
                        <DetailRow
                          label="Régression"
                          value={exercise.regression}
                        />
                      ) : null}
                      {exercise.progression ? (
                        <DetailRow
                          label="Progression"
                          value={exercise.progression}
                        />
                      ) : null}
                    </View>
                  </DetailSection>
                ) : null}

                <OptionalDetailList
                  items={exercise.commonErrors}
                  title="Erreurs fréquentes"
                />

              </View>
            </ScrollView>
          </View>
        </View>
      ) : null}
    </Modal>
  );
}

function OptionalDetailList({
  items,
  title,
}: {
  items: string[];
  title: string;
}) {
  if (items.length === 0) {
    return null;
  }

  return (
    <DetailSection title={title}>
      <View className="w-full max-w-full min-w-0 gap-2">
        {items.map((item, index) => (
          <View
            className="w-full max-w-full min-w-0 flex-row gap-2"
            key={`${index}-${item}`}
          >
            <SubtleText className="w-5 text-right font-bold">
              {index + 1}
            </SubtleText>
            <BodyText selectable className="min-w-0 flex-1">
              {item}
            </BodyText>
          </View>
        ))}
      </View>
    </DetailSection>
  );
}

function DetailSection({
  children,
  title,
}: {
  children: ReactNode;
  title: string;
}) {
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

function splitDetailLines(value: string) {
  return value
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
}

function DetailRow({ label, value }: { label: string; value: string }) {
  const tokens = useThemeTokens();

  return (
    <View
      className="w-full max-w-full min-w-0 gap-1 border-t py-3"
      style={{ borderColor: tokens.colors.borderSoft }}
    >
      <SubtleText className="font-bold uppercase tracking-[0.8px]">
        {label}
      </SubtleText>
      <BodyText selectable style={{ color: tokens.colors.textPrimary }}>
        {value}
      </BodyText>
    </View>
  );
}
