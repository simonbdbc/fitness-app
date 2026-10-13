import { View } from "react-native";

import {
  Badge,
  Card,
  CardHeader,
  StatTile,
} from "@shared/ui";

import { useCatalogLibraryScreen } from "../hooks/useCatalogLibraryScreen";
import { CatalogProgressiveControls } from "./CatalogProgressiveControls";
import {
  CatalogExerciseList,
  CatalogFiltersPanel,
  EmptyState,
  ExerciseDetailModal,
} from "./CatalogLibrary";

type CatalogLibraryContentProps = {
  library: ReturnType<typeof useCatalogLibraryScreen>;
};

export function CatalogLibraryContent({
  library,
}: CatalogLibraryContentProps) {
  return (
    <>
      <Card>
        <CardHeader
          action={<Badge variant="info">{library.exercises.length} exos</Badge>}
          description="Catalogue généré depuis les fiches françaises canoniques."
          title="Vue d'ensemble"
        />
        <View className="flex-row flex-wrap gap-3">
          <StatTile
            label="exercices"
            tone="info"
            value={`${library.exercises.length}`}
          />
          <StatTile
            label="piliers"
            tone="success"
            value={`${library.filterOptions.pillars.length}`}
          />
          <StatTile
            label="familles"
            value={`${library.filterOptions.families.length}`}
          />
        </View>
      </Card>

      <CatalogProgressiveControls
        activeFilterCount={library.activeFilterCount}
        downloadProgress={library.downloadProgress}
        errorMessage={library.errorMessage}
        filtersVisible={library.filtersVisible}
        isAcceptingRelease={library.isAcceptingRelease}
        onAcceptPendingRelease={library.acceptPendingRelease}
        onRetryIndex={library.reload}
        onToggleCompleteDownload={library.toggleCompleteDownload}
        onToggleFilters={() =>
          library.setFiltersVisible((isVisible) => !isVisible)
        }
        pendingRelease={library.pendingRelease}
        showIndexError={
          library.status === "success" && Boolean(library.errorMessage)
        }
      />

      {library.filtersVisible ? (
        <CatalogFiltersPanel
          activeFilterCount={library.activeFilterCount}
          availableFamilies={library.filterOptions.families}
          filterOptions={library.filterOptions}
          filters={library.filters ?? { pillarId: library.cardioPillarId }}
          onFiltersChange={library.setFilters}
          onReset={library.resetFilters}
          onSearchChange={library.setSearchQuery}
          pillarRequired
          searchQuery={library.searchQuery}
        />
      ) : null}

      {library.exercises.length === 0 ? (
        <EmptyState
          hasFilters={
            library.activeFilterCount > 0 || Boolean(library.searchQuery.trim())
          }
        />
      ) : (
        <CatalogExerciseList
          exercises={library.exercises}
          onExerciseVisible={library.hydrateVisibleExercise}
          onExercisePress={library.openExercise}
          selectedFamilyId={library.filters?.familyId}
        />
      )}

      <ExerciseDetailModal
        exercise={library.selectedExercise}
        isHydrating={library.hydratingSlug === library.selectedExercise?.slug}
        isHydratingAnimation={
          library.hydratingAnimationSlug === library.selectedExercise?.slug
        }
        loadError={library.detailError}
        onClose={() => library.setSelectedExerciseId(null)}
        onRequestAnimation={
          library.selectedExercise
            ? () => library.loadExerciseAnimation(library.selectedExercise!)
            : undefined
        }
        onRetry={
          library.selectedExercise
            ? () => void library.openExercise(library.selectedExercise!)
            : undefined
        }
      />
    </>
  );
}
