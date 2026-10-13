import { useCallback, useEffect, useMemo, useState } from "react";
import { View } from "react-native";

import { useAuth } from "@features/auth";
import {
  displaySessionStorageKey,
  usePersistentScreenState,
} from "@shared/persistence";
import {
  ActionButton,
  Badge,
  Card,
  CardHeader,
} from "@shared/ui";

import { AdminStatusFiltersPanel } from "../components/AdminCatalogExerciseEditor";
import {
  CatalogExerciseList,
  CatalogFiltersPanel,
} from "../components/CatalogLibrary";
import {
  applyAdminFilters,
  applyCatalogFilters,
  countReviewStatuses,
  emptyAdminFilters,
  emptyFilterOptions,
  errorMessageFromUnknown,
  filterOptionsFromSnapshot,
  reviewStatusBadgeVariant,
  type AdminCatalogFilters,
  type LoadStatus,
} from "../domain/adminCatalogExercise";
import { exportLocalCatalogSeedSnapshotFile } from "../services/catalogSeedExport";
import {
  fetchCatalogAdminSnapshotForAdminUi,
  type CatalogAdminSnapshot,
} from "../services/catalogRemote";
import {
  catalogExerciseReviewStatusLabels,
  type CatalogExercise,
  type CatalogFilters,
} from "../types";
import {
  AdminCatalogErrorState,
  AdminCatalogHeader,
  AdminCatalogLoadingState,
  AdminCatalogMessage,
  AdminCatalogPage,
  AdminCatalogStatTile,
  AdminCatalogStats,
  AdminCatalogToolbar,
} from "../components/AdminCatalogUi";

export function AdminCatalogScreen({
  initialExerciseId,
}: {
  initialExerciseId?: string;
} = {}) {
  const { user } = useAuth();
  const [snapshot, setSnapshot] = useState<CatalogAdminSnapshot | null>(null);
  const [status, setStatus] = useState<LoadStatus>("loading");
  const [message, setMessage] = useState("");
  const { setValue: setUiState, value: uiState } = usePersistentScreenState({
    initialValue: {
      adminFilters: emptyAdminFilters,
      filters: {} as CatalogFilters,
      filtersVisible: false,
    },
    parse: parseAdminCatalogUiState,
    storageKey: user?.id
      ? displaySessionStorageKey(user.id, "route:admin-catalog")
      : null,
  });
  const { adminFilters, filters, filtersVisible } = uiState;
  const setFilters = (next: CatalogFilters) =>
    setUiState((current) => ({ ...current, filters: next }));
  const setAdminFilters = (next: AdminCatalogFilters) =>
    setUiState((current) => ({ ...current, adminFilters: next }));
  const setFiltersVisible = (next: boolean | ((value: boolean) => boolean)) =>
    setUiState((current) => ({
      ...current,
      filtersVisible:
        typeof next === "function" ? next(current.filtersVisible) : next,
    }));
  const [openedInitialExerciseId, setOpenedInitialExerciseId] = useState<
    string | null
  >(null);
  const [isSaving, setIsSaving] = useState(false);
  const refreshSnapshot = useCallback(async () => {
    const nextSnapshot = await fetchCatalogAdminSnapshotForAdminUi();

    setSnapshot(nextSnapshot);
    setStatus("success");

    return nextSnapshot;
  }, []);
  const loadSnapshot = useCallback(async () => {
    setStatus("loading");
    setMessage("");

    try {
      await refreshSnapshot();
    } catch (error) {
      setMessage(errorMessageFromUnknown(error));
      setStatus("error");
    }
  }, [refreshSnapshot]);
  const exercises = useMemo(() => snapshot?.exercises ?? [], [snapshot]);
  const filterOptions = useMemo(
    () => (snapshot ? filterOptionsFromSnapshot(snapshot) : emptyFilterOptions),
    [snapshot],
  );
  const availableFamilies = useMemo(
    () => filterOptions.families,
    [filterOptions.families],
  );
  const filteredExercises = useMemo(
    () =>
      applyAdminFilters(applyCatalogFilters(exercises, filters), adminFilters),
    [adminFilters, exercises, filters],
  );
  const activeFilterCount = useMemo(
    () =>
      [
        filters.pillarId,
        filters.familyId,
        filters.equipment,
        filters.level,
        adminFilters.activity !== "all" ? adminFilters.activity : undefined,
        adminFilters.reviewStatus,
      ].filter((value) => value !== undefined).length,
    [adminFilters, filters],
  );
  const activeExerciseCount = exercises.filter(
    (exercise) => exercise.isActive,
  ).length;
  const inactiveExerciseCount = exercises.length - activeExerciseCount;
  const reviewCounts = useMemo(
    () => countReviewStatuses(exercises),
    [exercises],
  );

  useEffect(() => {
    void loadSnapshot();
  }, [loadSnapshot]);

  useEffect(() => {
    setOpenedInitialExerciseId(null);
  }, [initialExerciseId]);

  useEffect(() => {
    if (
      !snapshot ||
      !initialExerciseId ||
      openedInitialExerciseId === initialExerciseId
    ) {
      return;
    }

    const exercise =
      snapshot.exercises.find(
        (candidate) =>
          candidate.code === initialExerciseId ||
          candidate.id === Number(initialExerciseId),
      ) ?? null;

    if (exercise) setMessage("Les fiches d’exercice sont en lecture seule : modifiez la bibliothèque FR puis régénérez le catalogue.");

    setOpenedInitialExerciseId(initialExerciseId);
  }, [initialExerciseId, openedInitialExerciseId, snapshot]);

  async function exportSeedSnapshot() {
    setIsSaving(true);
    setMessage("");

    try {
      const filename = await exportLocalCatalogSeedSnapshotFile();

      setMessage(`Snapshot seed exporté : ${filename}`);
    } catch (error) {
      setMessage(errorMessageFromUnknown(error));
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <AdminCatalogPage>
      <AdminCatalogHeader
        description="Consultation du catalogue généré depuis la bibliothèque FR."
        title="Exercices"
      />

      {status === "loading" ? (
        <AdminCatalogLoadingState />
      ) : status === "error" ? (
        <AdminCatalogErrorState
          description="Vérifie la base SQLite locale et le schéma catalogue."
          message={message}
          onRetry={() => void loadSnapshot()}
        />
      ) : snapshot ? (
        <>
          <Card>
            <CardHeader
              title="Vue d'ensemble"
              description="Lecture admin complète, incluant les exercices inactifs."
              action={<Badge variant="info">{exercises.length} exos</Badge>}
            />
            <AdminCatalogStats>
              <AdminCatalogStatTile
                label="actifs"
                tone="success"
                value={`${activeExerciseCount}`}
              />
              <AdminCatalogStatTile
                label="inactifs"
                tone="warning"
                value={`${inactiveExerciseCount}`}
              />
              <AdminCatalogStatTile
                label="à revoir"
                tone="warning"
                value={`${reviewCounts.a_revoir}`}
              />
              <AdminCatalogStatTile
                label="à vérifier"
                tone="info"
                value={`${reviewCounts.a_verifier}`}
              />
            </AdminCatalogStats>
          </Card>

          <AdminCatalogMessage message={message} />

          <AdminCatalogToolbar>
            <ActionButton
              onPress={() => setFiltersVisible((isVisible) => !isVisible)}
              variant="secondary"
            >
              {filtersVisible ? "Masquer les filtres" : "Afficher les filtres"}
            </ActionButton>
            <ActionButton onPress={() => void loadSnapshot()} variant="secondary">
              Actualiser
            </ActionButton>
            <ActionButton
              disabled={isSaving}
              onPress={() => void exportSeedSnapshot()}
              variant="secondary"
            >
              Exporter seed
            </ActionButton>
            {activeFilterCount > 0 ? (
              <Badge variant="info">
                {activeFilterCount}{" "}
                {activeFilterCount === 1 ? "actif" : "actifs"}
              </Badge>
            ) : null}
          </AdminCatalogToolbar>

          {filtersVisible ? (
            <View className="w-full max-w-full min-w-0 gap-3">
              <CatalogFiltersPanel
                activeFilterCount={
                  [
                    filters.pillarId,
                    filters.familyId,
                    filters.equipment,
                    filters.level,
                  ].filter((value) => value !== undefined).length
                }
                availableFamilies={availableFamilies}
                filterOptions={filterOptions}
                filters={filters}
                onFiltersChange={setFilters}
              />
              <AdminStatusFiltersPanel
                filters={adminFilters}
                onFiltersChange={setAdminFilters}
              />
            </View>
          ) : null}

          {filteredExercises.length === 0 ? (
            <Card variant="muted">
              <CardHeader
                title="Aucun exercice"
                description="Aucun exercice ne correspond à ces filtres admin."
              />
            </Card>
          ) : (
            <CatalogExerciseList
              exercises={filteredExercises}
              onExercisePress={() => setMessage("Les fiches d’exercice sont en lecture seule : modifiez la bibliothèque FR puis régénérez le catalogue.")}
              renderExerciseBadges={(exercise) => (
                <>
                  <Badge variant={exercise.isActive ? "success" : "muted"}>
                    {exercise.isActive ? "Actif" : "Inactif"}
                  </Badge>
                  <Badge
                    variant={reviewStatusBadgeVariant(exercise.reviewStatus)}
                  >
                    {catalogExerciseReviewStatusLabels[exercise.reviewStatus]}
                  </Badge>
                </>
              )}
              selectedFamilyId={filters.familyId}
            />
          )}
        </>
      ) : null}
    </AdminCatalogPage>
  );
}

function parseAdminCatalogUiState(value: unknown) {
  if (!value || typeof value !== "object") return null;
  const candidate = value as Partial<{
    adminFilters: AdminCatalogFilters;
    filters: CatalogFilters;
    filtersVisible: boolean;
  }>;
  if (
    !candidate.filters ||
    typeof candidate.filters !== "object" ||
    !candidate.adminFilters ||
    typeof candidate.adminFilters !== "object" ||
    typeof candidate.filtersVisible !== "boolean"
  ) {
    return null;
  }
  return {
    adminFilters: candidate.adminFilters,
    filters: candidate.filters,
    filtersVisible: candidate.filtersVisible,
  };
}
