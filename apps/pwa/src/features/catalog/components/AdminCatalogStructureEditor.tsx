import { Pressable, View } from "react-native";

import { ActionButton, Badge, BodyText, SubtleText } from "@shared/ui";

import {
  AdminCatalogBooleanChips as BooleanChips,
  AdminCatalogCrudList,
  AdminCatalogDisclosure,
  AdminCatalogFormActions as FormActions,
  AdminCatalogMultiSelectionChips as MultiSelectionChips,
  AdminCatalogSelectionChips as SelectionChips,
  AdminCatalogStatTile,
  AdminCatalogStats,
  AdminCatalogTextInput as TextInputField,
} from "./AdminCatalogUi";
import type { CatalogAdminSnapshot } from "../services/catalogRemote";
import {
  getCatalogFormatTypeBusinessLabel,
  type CatalogFormat,
  type CatalogSessionTemplate,
} from "../types";
import {
  catalogItemRows,
  levels,
  mapById,
  newCatalogItemLabel,
  type CatalogItemDraft,
  type CatalogItemKind,
  type FormatDraft,
  type PillarFilter,
  type SessionDraft,
} from "../domain/adminCatalogStructure";

export function AdminCatalogStructureStats({
  snapshot,
}: {
  snapshot: CatalogAdminSnapshot;
}) {
  return (
    <AdminCatalogStats>
      <AdminCatalogStatTile
        label="sessions"
        tone="info"
        value={String(snapshot.sessionTemplates.length)}
      />
      <AdminCatalogStatTile
        label="formats"
        tone="success"
        value={String(snapshot.formats.length)}
      />
      <AdminCatalogStatTile
        label="éléments"
        value={String(
          snapshot.series.length +
            snapshot.repetitions.length +
            snapshot.intervals.length +
            snapshot.rests.length,
        )}
      />
      <AdminCatalogStatTile
        label="associations niveaux"
        tone="success"
        value={String(snapshot.sessionTemplateLevels.length)}
      />
    </AdminCatalogStats>
  );
}

export function LevelsSection({
  disabled,
  onEditSession,
  onNewSession,
  sessions,
}: {
  disabled: boolean;
  onEditSession: (session: CatalogSessionTemplate) => void;
  onNewSession: () => void;
  sessions: CatalogSessionTemplate[];
}) {
  return (
    <AdminCatalogCrudList
      actionLabel="Nouvelle session"
      disabled={disabled}
      emptyDescription="Aucun niveau catalogue disponible."
      emptyTitle="Aucun niveau"
      items={levels.map((level) => {
        const levelSessions = sessions.filter((session) =>
          session.levels.includes(level),
        );

        return {
          action: (
            <Badge variant={levelSessions.length > 0 ? "success" : "muted"}>
              {levelSessions.length} session(s)
            </Badge>
          ),
          content:
            levelSessions.length > 0 ? (
              <View className="gap-2 border-t pt-2">
                {levelSessions.map((session) => (
                  <View
                    className="flex-row flex-wrap items-center justify-between gap-2"
                    key={session.id}
                  >
                    <View className="min-w-0 flex-1">
                      <BodyText selectable>{session.title}</BodyText>
                      <SubtleText selectable>
                        {session.pillarLabel} · {session.exerciseLabel}
                      </SubtleText>
                    </View>
                    <ActionButton
                      className="w-full"
                      disabled={disabled}
                      onPress={() => onEditSession(session)}
                      variant="secondary"
                    >
                      Éditer
                    </ActionButton>
                  </View>
                ))}
              </View>
            ) : null,
          description:
            levelSessions.length > 0
              ? "Sessions disponibles à ce niveau."
              : "Aucune session associée.",
          id: level,
          title: `Niveau ${level}`,
        };
      })}
      onAction={onNewSession}
    />
  );
}

export function SessionsSection({
  disabled,
  onEditSession,
  onNewSession,
  sessions,
}: {
  disabled: boolean;
  onEditSession: (session: CatalogSessionTemplate) => void;
  onNewSession: () => void;
  sessions: CatalogSessionTemplate[];
}) {
  return (
    <AdminCatalogCrudList
      actionLabel="Nouvelle session"
      disabled={disabled}
      emptyDescription="Aucune session ne correspond au filtre courant."
      emptyTitle="Aucune session"
      items={sessions.map((session) => ({
        action: (
          <Badge variant={session.isActive ? "success" : "muted"}>
            {session.isActive ? "Active" : "Inactive"}
          </Badge>
        ),
        badges: (
          <>
            <Badge variant="info">{session.pillarLabel}</Badge>
            <Badge variant="muted">{session.familyLabel}</Badge>
            <Badge variant="muted">{session.exerciseLabel}</Badge>
            <Badge variant="dark">{session.levels.length} niveau(x)</Badge>
          </>
        ),
        description: session.description,
        id: session.id,
        onEdit: () => onEditSession(session),
        title: session.title,
      }))}
      onAction={onNewSession}
    />
  );
}

export function FormatsSection({
  disabled,
  formats,
  onEditFormat,
  onNewFormat,
  snapshot,
}: {
  disabled: boolean;
  formats: CatalogFormat[];
  onEditFormat: (format: CatalogFormat) => void;
  onNewFormat: () => void;
  snapshot: CatalogAdminSnapshot;
}) {
  const seriesById = mapById(snapshot.series);
  const repetitionsById = mapById(snapshot.repetitions);
  const restsById = mapById(snapshot.rests);
  const intervalsById = mapById(snapshot.intervals);

  return (
    <AdminCatalogCrudList
      actionLabel="Nouveau format"
      disabled={disabled}
      emptyDescription="Aucun format catalogue disponible."
      emptyTitle="Aucun format"
      items={formats.map((format) => ({
        action: (
          <Badge
            variant={format.formatType === "intervalles" ? "info" : "dark"}
          >
            {getCatalogFormatTypeBusinessLabel(format.formatType)}
          </Badge>
        ),
        badges: (
          <>
            <Badge variant="muted">
              {seriesById.get(format.seriesId)?.label ?? "Série indisponible"}
            </Badge>
            {format.repetitionsId ? (
              <Badge variant="muted">
                {repetitionsById.get(format.repetitionsId)?.label ??
                  "Répétition indisponible"}
              </Badge>
            ) : null}
            {format.intervalId ? (
              <Badge variant="muted">
                {intervalsById.get(format.intervalId)?.label ??
                  "Intervalle indisponible"}
              </Badge>
            ) : null}
            <Badge variant="muted">
              {restsById.get(format.restId)?.label ?? "Repos indisponible"}
            </Badge>
          </>
        ),
        description: format.description,
        id: format.id,
        onEdit: () => onEditFormat(format),
        title: format.label,
      }))}
      onAction={onNewFormat}
    />
  );
}

export function CatalogItemsSection({
  catalogItemKind,
  disabled,
  onEditCatalogItem,
  onNewCatalogItem,
  snapshot,
}: {
  catalogItemKind: CatalogItemKind;
  disabled: boolean;
  onEditCatalogItem: (draft: CatalogItemDraft) => void;
  onNewCatalogItem: (kind: CatalogItemKind) => void;
  snapshot: CatalogAdminSnapshot;
}) {
  const rows = catalogItemRows(snapshot, catalogItemKind);

  return (
    <AdminCatalogCrudList
      actionLabel={newCatalogItemLabel(catalogItemKind)}
      disabled={disabled}
      emptyDescription="Aucun élément catalogue pour cette section."
      emptyTitle="Aucun élément"
      items={rows.map((row) => ({
        action: <Badge variant="info">{row.kindLabel}</Badge>,
        badges:
          row.usageCount > 0 ? (
            <Badge variant="warning">
              utilisé par {row.usageCount} format(s)
            </Badge>
          ) : undefined,
        description: row.valueLabel,
        id: row.id,
        onEdit: () => onEditCatalogItem(row.draft),
        title: row.label,
      }))}
      onAction={() => onNewCatalogItem(catalogItemKind)}
    />
  );
}

export function SessionForm({
  disabled,
  draft,
  onCancel,
  onChange,
  onDelete,
  onSave,
  snapshot,
}: {
  disabled: boolean;
  draft: SessionDraft;
  onCancel: () => void;
  onChange: (draft: SessionDraft) => void;
  onDelete?: () => void;
  onSave: () => void;
  snapshot: CatalogAdminSnapshot;
}) {
  const eligibleExercises = snapshot.exercises.filter(
    (exercise) =>
      exercise.pillarId === draft.pillarId &&
      exercise.family.id === draft.familyId,
  );

  function changeFilters(
    next: Partial<Pick<SessionDraft, "pillarId" | "familyId">>,
  ) {
    const updated = { ...draft, ...next };
    const selectedExercise = snapshot.exercises.find(
      (exercise) => exercise.id === updated.exerciseId,
    );

    if (
      selectedExercise &&
      (selectedExercise.pillarId !== updated.pillarId ||
        selectedExercise.family.id !== updated.familyId)
    ) {
      updated.exerciseId = null;
    }

    onChange(updated);
  }

  return (
    <View className="gap-3">
      <TextInputField
        label="Titre"
        onChangeText={(title) => onChange({ ...draft, title })}
        value={draft.title}
      />
      <TextInputField
        label="Description"
        multiline
        onChangeText={(description) => onChange({ ...draft, description })}
        value={draft.description}
      />
      <SelectionChips
        label="Phase"
        onChange={(phase) => onChange({ ...draft, phase })}
        options={[
          { label: "Échauffement", value: "warmup" as const },
          { label: "Principale", value: "main" as const },
          { label: "Assouplissements", value: "cooldown" as const },
        ]}
        value={draft.phase}
      />
      <SelectionChips
        label="Pilier"
        onChange={(pillarId) => changeFilters({ pillarId })}
        options={snapshot.pillars.map((pillar) => ({
          label: pillar.label,
          value: pillar.id,
        }))}
        value={draft.pillarId}
      />
      <SelectionChips
        label="Famille"
        onChange={(familyId) => changeFilters({ familyId })}
        options={snapshot.families.map((family) => ({
          label: family.label,
          value: family.id,
        }))}
        value={draft.familyId}
      />
      <SelectionChips
        label="Exercice"
        onChange={(exerciseId) => onChange({ ...draft, exerciseId })}
        options={eligibleExercises.map((exercise) => ({
          label: exercise.label,
          value: exercise.id,
        }))}
        value={draft.exerciseId}
      />
      {eligibleExercises.length === 0 ? (
        <SubtleText>
          Aucun exercice ne correspond au pilier et à la famille.
        </SubtleText>
      ) : null}
      <MultiSelectionChips
        label="Niveaux"
        onChange={(nextLevels) =>
          onChange({ ...draft, levels: [...nextLevels].sort((a, b) => a - b) })
        }
        options={levels.map((level) => ({
          label: `Niveau ${level}`,
          value: level,
        }))}
        values={draft.levels}
      />
      <BooleanChips
        falseLabel="Inactive"
        label="Statut"
        onChange={(isActive) => onChange({ ...draft, isActive })}
        trueLabel="Active"
        value={draft.isActive}
      />
      <FormActions
        disabled={disabled}
        onCancel={onCancel}
        onDelete={onDelete}
        onSave={onSave}
      />
    </View>
  );
}

export function FormatForm({
  disabled,
  draft,
  onCancel,
  onChange,
  onDelete,
  onSave,
  snapshot,
}: {
  disabled: boolean;
  draft: FormatDraft;
  onCancel: () => void;
  onChange: (draft: FormatDraft) => void;
  onDelete?: () => void;
  onSave: () => void;
  snapshot: CatalogAdminSnapshot;
}) {
  return (
    <View className="gap-3">
      <TextInputField
        label="Libellé"
        onChangeText={(label) => onChange({ ...draft, label })}
        value={draft.label}
      />
      <TextInputField
        label="Description"
        multiline
        onChangeText={(description) => onChange({ ...draft, description })}
        value={draft.description}
      />
      <SelectionChips
        label="Type"
        onChange={(formatType) =>
          onChange({
            ...draft,
            formatType,
            repetitionsId:
              formatType === "repetitions"
                ? (draft.repetitionsId ?? snapshot.repetitions[0]?.id ?? null)
                : null,
            intervalId:
              formatType === "intervalles"
                ? (draft.intervalId ?? snapshot.intervals[0]?.id ?? null)
                : null,
          })
        }
        options={[
          { label: "Répétitions", value: "repetitions" },
          { label: "Intervalles", value: "intervalles" },
        ]}
        value={draft.formatType}
      />
      <SelectionChips
        label="Séries"
        onChange={(seriesId) => onChange({ ...draft, seriesId })}
        options={snapshot.series.map((series) => ({
          label: series.label,
          value: series.id,
        }))}
        value={draft.seriesId}
      />
      {draft.formatType === "repetitions" ? (
        <SelectionChips
          label="Répétitions"
          onChange={(repetitionsId) => onChange({ ...draft, repetitionsId })}
          options={snapshot.repetitions.map((repetition) => ({
            label: repetition.label,
            value: repetition.id,
          }))}
          value={draft.repetitionsId}
        />
      ) : (
        <SelectionChips
          label="Intervalles"
          onChange={(intervalId) => onChange({ ...draft, intervalId })}
          options={snapshot.intervals.map((interval) => ({
            label: interval.label,
            value: interval.id,
          }))}
          value={draft.intervalId}
        />
      )}
      <SelectionChips
        label="Repos"
        onChange={(restId) => onChange({ ...draft, restId })}
        options={snapshot.rests.map((rest) => ({
          label: rest.label,
          value: rest.id,
        }))}
        value={draft.restId}
      />
      <FormActions
        disabled={disabled}
        onCancel={onCancel}
        onDelete={onDelete}
        onSave={onSave}
      />
    </View>
  );
}

export function CatalogItemForm({
  disabled,
  draft,
  linkedFormats,
  onCancel,
  onChange,
  onDelete,
  onFormatPress,
  onSave,
}: {
  disabled: boolean;
  draft: CatalogItemDraft;
  linkedFormats: CatalogFormat[];
  onCancel: () => void;
  onChange: (draft: CatalogItemDraft) => void;
  onDelete?: () => void;
  onFormatPress: (format: CatalogFormat) => void;
  onSave: () => void;
}) {
  return (
    <View className="gap-3">
      <TextInputField
        label="Libellé"
        onChangeText={(label) =>
          onChange({
            ...draft,
            value: { ...draft.value, label },
          } as CatalogItemDraft)
        }
        value={draft.value.label}
      />

      {draft.kind === "series" ? (
        <TextInputField
          inputMode="numeric"
          label="Nombre de séries"
          onChangeText={(series) =>
            onChange({ kind: "series", value: { ...draft.value, series } })
          }
          value={draft.value.series}
        />
      ) : null}

      {draft.kind === "repetitions" ? (
        <>
          <BooleanChips
            falseLabel="Nombre défini"
            label="Maximum"
            onChange={(isMaximum) =>
              onChange({
                kind: "repetitions",
                value: {
                  ...draft.value,
                  isMaximum,
                  label:
                    isMaximum && !draft.value.label.trim()
                      ? "Maximum"
                      : draft.value.label,
                },
              })
            }
            trueLabel="Maximum"
            value={draft.value.isMaximum}
          />
          {!draft.value.isMaximum ? (
            <TextInputField
              inputMode="numeric"
              label="Nombre de répétitions"
              onChangeText={(reps) =>
                onChange({
                  kind: "repetitions",
                  value: { ...draft.value, reps },
                })
              }
              value={draft.value.reps}
            />
          ) : null}
        </>
      ) : null}

      {draft.kind === "rests" ? (
        <TextInputField
          inputMode="numeric"
          label="Durée en secondes"
          onChangeText={(restSeconds) =>
            onChange({ kind: "rests", value: { ...draft.value, restSeconds } })
          }
          value={draft.value.restSeconds}
        />
      ) : null}

      {draft.kind === "intervals" ? (
        <TextInputField
          inputMode="numeric"
          label="Durée en secondes"
          onChangeText={(effortSeconds) =>
            onChange({
              kind: "intervals",
              value: { ...draft.value, effortSeconds },
            })
          }
          value={draft.value.effortSeconds}
        />
      ) : null}

      <AdminCatalogDisclosure
        badge={<Badge variant="info">{linkedFormats.length} format(s)</Badge>}
        description="Ouvre un format lié pour modifier ses associations."
        title="Formats liés"
      >
        {linkedFormats.length === 0 ? (
          <SubtleText>Aucun format lié.</SubtleText>
        ) : (
          linkedFormats.map((format) => (
            <ActionButton
              disabled={disabled}
              key={format.id}
              onPress={() => onFormatPress(format)}
              variant="secondary"
            >
              {format.label}
            </ActionButton>
          ))
        )}
      </AdminCatalogDisclosure>

      {linkedFormats.length > 0 ? (
        <SubtleText>
          Suppression bloquée tant que des formats utilisent cet élément.
        </SubtleText>
      ) : null}
      <FormActions
        deleteDisabled={linkedFormats.length > 0}
        disabled={disabled}
        onCancel={onCancel}
        onDelete={onDelete}
        onSave={onSave}
      />
    </View>
  );
}

export function PillarFilterChips({
  active,
  onChange,
  pillars,
}: {
  active: PillarFilter;
  onChange: (value: PillarFilter) => void;
  pillars: CatalogAdminSnapshot["pillars"];
}) {
  return (
    <View className="flex-row flex-wrap gap-2">
      <Pressable onPress={() => onChange("all")}>
        <Badge variant={active === "all" ? "dark" : "muted"}>Tous</Badge>
      </Pressable>
      {pillars.map((pillar) => (
        <Pressable key={pillar.id} onPress={() => onChange(pillar.id)}>
          <Badge variant={active === pillar.id ? "dark" : "muted"}>
            {pillar.label}
          </Badge>
        </Pressable>
      ))}
    </View>
  );
}
