import { useEffect, useState } from "react";
import { Alert, Platform, View } from "react-native";

import { withDatabase } from "@shared/db";
import { reportTechnicalDegradationOnce } from "@shared/observability/technicalDiagnostics";
import { ActionButton, Badge, BodyText, Card, CardHeader, SubtleText } from "@shared/ui";
import { usePwa } from "../providers/PwaProvider";

type SyncMetadataRow = {
  catalog_last_success_at: string | null;
};

export function StorageUsagePanel() {
  const { clearPwaCaches, diagnostics, refreshDiagnostics } = usePwa();
  const [lastCatalogSyncAt, setLastCatalogSyncAt] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;

    void (async () => {
      try {
        const rows = await withDatabase((db) =>
          db.getAllAsync<SyncMetadataRow>(`
            SELECT catalog_last_success_at
            FROM sync_metadata
            WHERE key = 'catalog'
            LIMIT 1
          `),
        );

        if (isMounted) {
          setLastCatalogSyncAt(rows[0]?.catalog_last_success_at ?? null);
        }
      } catch (error) {
        reportTechnicalDegradationOnce(
          "pwa-storage-catalog-sync-metadata",
          error,
        );
        if (isMounted) {
          setLastCatalogSyncAt(null);
        }
      }
    })();

    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    void refreshDiagnostics();
  }, [refreshDiagnostics]);

  const usageLabel = formatBytes(diagnostics?.storageUsageBytes ?? null);
  const quotaLabel = formatBytes(diagnostics?.storageQuotaBytes ?? null);

  return (
    <Card>
      <CardHeader
        title="Stockage local"
        description="Caches PWA, bibliothèque SQLite et preferences locales."
        action={<Badge variant="info">{usageLabel}</Badge>}
      />
      <View className="gap-2">
        <StorageRow label="Utilise" value={usageLabel} />
        <StorageRow label="Quota estime" value={quotaLabel} />
        <StorageRow
          label="Caches PWA"
          value={`${diagnostics?.caches.length ?? 0}`}
        />
        <StorageRow
          label="Derniere sync bibliothèque"
          value={lastCatalogSyncAt ?? "aucune"}
        />
      </View>
      <BodyText>
        Le nettoyage supprime les caches applicatifs. La bibliothèque SQLite et les
        donnees synchronisees sont conserves.
      </BodyText>
      <ActionButton onPress={() => void confirmClearCaches(clearPwaCaches)} variant="secondary">
        Vider les caches PWA
      </ActionButton>
    </Card>
  );
}

function StorageRow({ label, value }: { label: string; value: string }) {
  return (
    <View className="flex-row flex-wrap items-start justify-between gap-2">
      <SubtleText>{label}</SubtleText>
      <BodyText className="min-w-0 flex-1 text-right" selectable>
        {value}
      </BodyText>
    </View>
  );
}

function confirmClearCaches(clearPwaCaches: () => Promise<void>) {
  if (Platform.OS === "web" && typeof window !== "undefined") {
    if (window.confirm("Vider les caches PWA non critiques ?")) {
      return clearPwaCaches();
    }
    return Promise.resolve();
  }

  return new Promise<void>((resolve) => {
    Alert.alert("Vider les caches PWA", "Les donnees SQLite sont conservees.", [
      { text: "Annuler", style: "cancel", onPress: () => resolve() },
      {
        text: "Vider",
        style: "destructive",
        onPress: () => {
          void clearPwaCaches().finally(resolve);
        },
      },
    ]);
  });
}

function formatBytes(value: number | null) {
  if (!value || value <= 0) {
    return "0 o";
  }

  const units = ["o", "Ko", "Mo", "Go"];
  let nextValue = value;
  let unitIndex = 0;

  while (nextValue >= 1024 && unitIndex < units.length - 1) {
    nextValue /= 1024;
    unitIndex += 1;
  }

  return `${nextValue.toFixed(unitIndex === 0 ? 0 : 1)} ${units[unitIndex]}`;
}
