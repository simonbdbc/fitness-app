import { useCallback, useEffect, useMemo, useState } from "react";
import { View } from "react-native";

import { useAuth } from "@features/auth";
import { ActionButton, Badge, BodyText } from "@shared/ui";
import {
  deleteCatalogEquipment,
  listCatalogEquipmentUsageForAdminUi,
  upsertCatalogEquipment,
  usesLocalCatalogAdminSnapshot,
} from "../services/catalogRemote";
import { adminCatalogErrorMessage } from "../domain/adminCatalogFeedback";
import { exportLocalCatalogSeedSnapshotFile } from "../services/catalogSeedExport";
import {
  emptyEquipmentDraft,
  stableEquipmentCodePattern,
  useAdminCatalogEquipmentUiState,
  type EquipmentDraft,
} from "../hooks/useAdminCatalogEquipmentUiState";
import type { CatalogEquipmentUsage } from "../types";
import {
  AdminCatalogErrorState,
  AdminCatalogCrudList,
  AdminCatalogFormActions,
  AdminCatalogHeader,
  AdminCatalogLoadingState,
  AdminCatalogMessage,
  AdminCatalogModal,
  AdminCatalogPage,
  AdminCatalogStatTile,
  AdminCatalogStats,
  AdminCatalogTextInput,
  AdminCatalogToolbar,
} from "../components/AdminCatalogUi";

type LoadStatus = "loading" | "success" | "error";

export function AdminCatalogEquipmentScreen() {
  const { user } = useAuth();
  const usesLocalPersistence = usesLocalCatalogAdminSnapshot();
  const persistenceLabel = usesLocalPersistence ? "SQLite local" : "Supabase";
  const [equipment, setEquipment] = useState<CatalogEquipmentUsage[]>([]);
  const [status, setStatus] = useState<LoadStatus>("loading");
  const [message, setMessage] = useState("");
  const { draft, search, setDraft, setSearch } =
    useAdminCatalogEquipmentUiState(user?.id);
  const [isSaving, setIsSaving] = useState(false);

  const refreshEquipment = useCallback(async () => {
    const rows = await listCatalogEquipmentUsageForAdminUi();
    setEquipment(rows);
    setStatus("success");
  }, []);
  const loadEquipment = useCallback(async () => {
    setStatus("loading");
    setMessage("");
    try {
      await refreshEquipment();
    } catch (error) {
      setMessage(adminCatalogErrorMessage(error, "Action équipement impossible."));
      setStatus("error");
    }
  }, [refreshEquipment]);

  useEffect(() => {
    void loadEquipment();
  }, [loadEquipment]);

  const filteredEquipment = useMemo(() => {
    const needle = search.trim().toLowerCase();

    if (!needle) {
      return equipment;
    }

    return equipment.filter(
      (item) =>
        item.code.toLowerCase().includes(needle) ||
        item.label.toLowerCase().includes(needle),
    );
  }, [equipment, search]);
  const usedCount = equipment.filter(
    (item) => item.exerciseCount > 0 || item.profileCount > 0,
  ).length;
  const selectedUsage =
    typeof draft?.id === "number"
      ? (equipment.find((item) => item.id === draft.id) ?? null)
      : null;

  async function saveDraft() {
    if (!draft) {
      return;
    }

    const normalizedCode = draft.code.trim().toLowerCase();
    const normalizedLabel = draft.label.trim();

    if (!stableEquipmentCodePattern.test(normalizedCode)) {
      setMessage(
        "Code invalide: utilise lettres minuscules, chiffres et tirets.",
      );
      return;
    }

    if (!normalizedLabel) {
      setMessage("Le libellé équipement est requis.");
      return;
    }

    setIsSaving(true);
    setMessage("");

    try {
      await upsertCatalogEquipment({
        id: draft.id,
        code: normalizedCode,
        label: normalizedLabel,
        category: draft.category,
      });

      await loadEquipment();
      setDraft(null);
      setMessage(`Équipement enregistré dans ${persistenceLabel}.`);
    } catch (error) {
      setMessage(adminCatalogErrorMessage(error, "Action équipement impossible."));
    } finally {
      setIsSaving(false);
    }
  }

  async function deleteDraft() {
    if (!draft?.id) {
      return;
    }

    setIsSaving(true);
    setMessage("");

    try {
      await deleteCatalogEquipment(draft.id);
      await loadEquipment();
      setDraft(null);
      setMessage(`Équipement supprimé de ${persistenceLabel}.`);
    } catch (error) {
      setMessage(adminCatalogErrorMessage(error, "Action équipement impossible."));
    } finally {
      setIsSaving(false);
    }
  }

  async function exportSeedSnapshot() {
    setIsSaving(true);
    setMessage("");

    try {
      const filename = await exportLocalCatalogSeedSnapshotFile();

      setMessage(`Snapshot seed exporté : ${filename}`);
    } catch (error) {
      setMessage(adminCatalogErrorMessage(error, "Action équipement impossible."));
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <AdminCatalogPage>
      <AdminCatalogHeader
        description={`Gestion des équipements utilisés par le catalogue via ${persistenceLabel}.`}
        title="Équipements"
      />

      {status === "loading" ? (
        <AdminCatalogLoadingState label="Chargement des équipements..." />
      ) : null}

      {status === "error" ? (
        <AdminCatalogErrorState
          description={`${persistenceLabel} n'a pas répondu.`}
          message={message}
          onRetry={() => void loadEquipment()}
          title="Équipements indisponibles"
        />
      ) : null}

      {status === "success" ? (
        <>
          <AdminCatalogStats>
            <AdminCatalogStatTile
              label="Équipements"
              value={String(equipment.length)}
            />
            <AdminCatalogStatTile
              label="Utilisés"
              tone="info"
              value={String(usedCount)}
            />
            <AdminCatalogStatTile
              label="Libres"
              tone="success"
              value={String(equipment.length - usedCount)}
            />
          </AdminCatalogStats>

          <AdminCatalogMessage message={message} />

          <AdminCatalogToolbar>
            <ActionButton onPress={() => void loadEquipment()} variant="secondary">
              Actualiser
            </ActionButton>
            <ActionButton
              disabled={isSaving}
              onPress={() => void exportSeedSnapshot()}
              variant="secondary"
            >
              Exporter seed
            </ActionButton>
            <View className="min-w-64 flex-1">
              <AdminCatalogTextInput
                label="Recherche"
                onChangeText={setSearch}
                placeholder="barre, tapis, aucun..."
                value={search}
              />
            </View>
          </AdminCatalogToolbar>

          <AdminCatalogCrudList
            actionLabel="Nouvel équipement"
            disabled={isSaving}
            emptyDescription="Aucun équipement ne correspond à la recherche."
            emptyTitle="Aucun équipement"
            items={filteredEquipment.map((item) => ({
              action: (
                <Badge variant={item.exerciseCount > 0 ? "info" : "muted"}>
                  {item.exerciseCount} exercice(s)
                </Badge>
              ),
              content:
                item.exerciseCount > 0 || item.profileCount > 0 ? (
                  <View className="flex-row flex-wrap gap-2">
                    <Badge variant={item.profileCount > 0 ? "info" : "muted"}>
                      {item.profileCount} profil(s)
                    </Badge>
                    <Badge variant="warning">Suppression bloquée</Badge>
                  </View>
                ) : null,
              description: `${item.code} · ${item.category === "maison" ? "Maison" : "Sport"}`,
              id: item.id,
              onEdit: () => {
                setDraft({
                  id: item.id,
                  code: item.code,
                  label: item.label,
                  category: item.category,
                });
                setMessage("");
              },
              title: item.label,
            }))}
            onAction={() => {
              setDraft(emptyEquipmentDraft);
              setMessage("");
            }}
          />
        </>
      ) : null}

      <EquipmentModal
        draft={draft}
        isSaving={isSaving}
        onClose={() => setDraft(null)}
        onDelete={() => void deleteDraft()}
        onDraftChange={setDraft}
        onSave={() => void saveDraft()}
        persistenceLabel={persistenceLabel}
        exerciseUsageCount={selectedUsage?.exerciseCount ?? 0}
        profileUsageCount={selectedUsage?.profileCount ?? 0}
      />
    </AdminCatalogPage>
  );
}


function EquipmentModal({
  draft,
  isSaving,
  onClose,
  onDelete,
  onDraftChange,
  onSave,
  persistenceLabel,
  exerciseUsageCount,
  profileUsageCount,
}: {
  draft: EquipmentDraft | null;
  isSaving: boolean;
  onClose: () => void;
  onDelete: () => void;
  onDraftChange: (draft: EquipmentDraft) => void;
  onSave: () => void;
  persistenceLabel: string;
  exerciseUsageCount: number;
  profileUsageCount: number;
}) {
  if (!draft) {
    return null;
  }

  return (
    <AdminCatalogModal
      onClose={onClose}
      title={draft.id ? "Modifier l'équipement" : "Créer un équipement"}
      visible
    >
      <View className="gap-4">
        <View className="flex-row flex-wrap gap-2">
          <Badge variant="dark">{persistenceLabel}</Badge>
          <Badge variant={exerciseUsageCount > 0 ? "info" : "muted"}>
            {exerciseUsageCount} exercice(s)
          </Badge>
          <Badge variant={profileUsageCount > 0 ? "info" : "muted"}>
            {profileUsageCount} profil(s)
          </Badge>
          {exerciseUsageCount > 0 || profileUsageCount > 0 ? (
            <Badge variant="muted">Suppression bloquée</Badge>
          ) : null}
        </View>

        <AdminCatalogTextInput
          autoCapitalize="none"
          label="Code"
          onChangeText={(code) =>
            onDraftChange({ ...draft, code: code.toLowerCase() })
          }
          placeholder="barre-traction"
          value={draft.code}
        />
        <BodyText>
          Format attendu : lettres minuscules, chiffres et tirets.
        </BodyText>

        <AdminCatalogTextInput
          label="Libellé"
          onChangeText={(label) => onDraftChange({ ...draft, label })}
          placeholder="Barre de traction"
          value={draft.label}
        />

        <View className="gap-2">
          <BodyText>Catégorie</BodyText>
          <View className="flex-row gap-2">
            {(["maison", "sport"] as const).map((category) => (
              <ActionButton
                key={category}
                onPress={() => onDraftChange({ ...draft, category })}
                variant={draft.category === category ? "primary" : "secondary"}
              >
                {category === "maison" ? "Maison" : "Sport"}
              </ActionButton>
            ))}
          </View>
        </View>

        <AdminCatalogFormActions
          deleteDisabled={exerciseUsageCount > 0 || profileUsageCount > 0}
          disabled={isSaving}
          onCancel={onClose}
          onDelete={draft.id ? onDelete : undefined}
          onSave={onSave}
        />
      </View>
    </AdminCatalogModal>
  );
}
