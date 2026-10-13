import { View } from "react-native";

import { ActionButton, Badge, Card, CardHeader } from "@shared/ui";

import type {
  CatalogDownloadProgress,
  PendingCatalogRelease,
} from "../hooks/useProgressiveCatalogLibrary";

type CatalogProgressiveControlsProps = {
  activeFilterCount: number;
  downloadProgress: CatalogDownloadProgress | null;
  errorMessage: string;
  filtersVisible: boolean;
  isAcceptingRelease: boolean;
  onAcceptPendingRelease: () => void;
  onRetryIndex: () => void;
  onToggleCompleteDownload: () => void;
  onToggleFilters: () => void;
  pendingRelease: PendingCatalogRelease | null;
  showIndexError: boolean;
};

export function CatalogProgressiveControls({
  activeFilterCount,
  downloadProgress,
  errorMessage,
  filtersVisible,
  isAcceptingRelease,
  onAcceptPendingRelease,
  onRetryIndex,
  onToggleCompleteDownload,
  onToggleFilters,
  pendingRelease,
  showIndexError,
}: CatalogProgressiveControlsProps) {
  return (
    <>
      {showIndexError ? (
        <Card variant="muted">
          <CardHeader
            title="Index complet non disponible"
            description={`${errorMessage} Les fiches déjà présentes restent consultables hors ligne.`}
          />
          <ActionButton onPress={onRetryIndex} variant="secondary">
            Réessayer le téléchargement de l’index
          </ActionButton>
        </Card>
      ) : null}

      {pendingRelease ? (
        <Card variant="info">
          <CardHeader
            title="Mise à jour de la bibliothèque disponible"
            description={`Révision ${pendingRelease.sourceRevision} détectée. Les fiches déjà téléchargées restent disponibles jusqu’à votre validation.`}
          />
          <ActionButton onPress={onAcceptPendingRelease} variant="secondary">
            {isAcceptingRelease ? "Mise à jour…" : "Mettre à jour l’index"}
          </ActionButton>
        </Card>
      ) : null}

      <View className="w-full max-w-full min-w-0 flex-row flex-wrap items-center gap-2">
        <ActionButton onPress={onToggleFilters} variant="secondary">
          {filtersVisible ? "Masquer les filtres" : "Afficher les filtres"}
        </ActionButton>
        <ActionButton onPress={onToggleCompleteDownload} variant="secondary">
          {downloadProgress
            ? `Annuler (${downloadProgress.completed}/${downloadProgress.total || "…"})`
            : "Télécharger la bibliothèque"}
        </ActionButton>
        {activeFilterCount > 0 ? (
          <Badge variant="info">
            {activeFilterCount} {activeFilterCount === 1 ? "actif" : "actifs"}
          </Badge>
        ) : null}
      </View>
    </>
  );
}
