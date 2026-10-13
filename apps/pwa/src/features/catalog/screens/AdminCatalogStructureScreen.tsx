import { useCallback, useEffect, useState } from "react";
import { useAuth } from "@features/auth";
import { ActionButton } from "@shared/ui";
import {
  CatalogItemForm,
  CatalogItemsSection,
  AdminCatalogStructureStats,
  FormatForm,
  FormatsSection,
  LevelsSection,
  PillarFilterChips,
  SessionForm,
  SessionsSection,
} from "../components/AdminCatalogStructureEditor";
import {
  blankCatalogItemDraft,
  blankFormatDraft,
  blankSessionDraft,
  catalogItemDraftTitle,
  catalogItemKindFromSection,
  catalogItemSavedMessage,
  catalogItemUsage,
  deleteCatalogItemIfUnused,
  draftFromFormat,
  draftFromSession,
  errorMessageFromUnknown,
  formatFromDraft,
  intervalFromDraft,
  repetitionFromDraft,
  requireNumber,
  restFromDraft,
  sectionCopy,
  seriesFromDraft,
  sessionFromDraft,
  type AdminCatalogStructureSection,
  type LoadStatus,
} from "../domain/adminCatalogStructure";
import { exportLocalCatalogSeedSnapshotFile } from "../services/catalogSeedExport";
import { useCatalogFilteredSessions } from "../hooks/useCatalogFilteredSessions";
import { useAdminCatalogStructureUiState } from "../hooks/useAdminCatalogStructureUiState";
import {
  deleteCatalogFormat,
  deleteCatalogSessionTemplate,
  fetchCatalogAdminSnapshotForAdminUi,
  upsertCatalogFormat,
  upsertCatalogInterval,
  upsertCatalogRepetition,
  upsertCatalogRest,
  upsertCatalogSeries,
  upsertCatalogSessionTemplate,
  usesLocalCatalogAdminSnapshot,
  type CatalogAdminSnapshot,
} from "../services/catalogRemote";
import type { CatalogFormat } from "../types";
import {
  AdminCatalogErrorState,
  AdminCatalogHeader,
  AdminCatalogLoadingState,
  AdminCatalogMessage,
  AdminCatalogModal as CatalogModal,
  AdminCatalogPage,
  AdminCatalogToolbar,
} from "../components/AdminCatalogUi";

export type { AdminCatalogStructureSection } from "../domain/adminCatalogStructure";

export function AdminCatalogStructureScreen({
  section,
}: {
  section: AdminCatalogStructureSection;
}) {
  const { user } = useAuth();
  const persistenceLabel = usesLocalCatalogAdminSnapshot()
    ? "SQLite local"
    : "Supabase";
  const [snapshot, setSnapshot] = useState<CatalogAdminSnapshot | null>(null);
  const [status, setStatus] = useState<LoadStatus>("loading");
  const [message, setMessage] = useState("");
  const [saving, setSaving] = useState(false);
  const {
    catalogItemDraft,
    formatDraft,
    pillarFilter,
    sessionDraft,
    setCatalogItemDraft,
    setFormatDraft,
    setPillarFilter,
    setSessionDraft,
  } = useAdminCatalogStructureUiState(user?.id, section);
  const copy = sectionCopy[section];
  const catalogItemKind = catalogItemKindFromSection(section);
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
      setStatus("error");
      setMessage(errorMessageFromUnknown(error));
    }
  }, [refreshSnapshot]);
  useEffect(() => {
    void loadSnapshot();
  }, [loadSnapshot]);

  const filteredSessions = useCatalogFilteredSessions(snapshot, pillarFilter);

  async function runMutation(
    successMessage: string,
    mutation: () => Promise<void>,
  ) {
    setSaving(true);
    setMessage("");
    try {
      await mutation();
      await refreshSnapshot();
      setMessage(successMessage);
    } catch (error) {
      setMessage(errorMessageFromUnknown(error));
    } finally {
      setSaving(false);
    }
  }
  async function exportSeedSnapshot() {
    setSaving(true);
    setMessage("");
    try {
      const filename = await exportLocalCatalogSeedSnapshotFile();
      setMessage(`Snapshot seed exporté : ${filename}`);
    } catch (error) {
      setMessage(errorMessageFromUnknown(error));
    } finally {
      setSaving(false);
    }
  }
  async function saveSessionDraft() {
    if (!sessionDraft) return;

    const input = sessionFromDraft(sessionDraft);
    await runMutation("Session enregistrée.", async () => {
      await upsertCatalogSessionTemplate(input);
      setSessionDraft(null);
    });
  }

  async function saveFormatDraft() {
    if (!formatDraft) return;

    const input = formatFromDraft(formatDraft);
    await runMutation("Format enregistré.", async () => {
      await upsertCatalogFormat(input);
      setFormatDraft(null);
    });
  }

  async function saveCatalogItemDraft() {
    if (!catalogItemDraft) return;

    await runMutation(
      catalogItemSavedMessage(catalogItemDraft.kind),
      async () => {
        if (catalogItemDraft.kind === "series") {
          await upsertCatalogSeries(seriesFromDraft(catalogItemDraft.value));
        } else if (catalogItemDraft.kind === "repetitions") {
          await upsertCatalogRepetition(
            repetitionFromDraft(catalogItemDraft.value),
          );
        } else if (catalogItemDraft.kind === "rests") {
          await upsertCatalogRest(restFromDraft(catalogItemDraft.value));
        } else {
          await upsertCatalogInterval(
            intervalFromDraft(catalogItemDraft.value),
          );
        }

        setCatalogItemDraft(null);
      },
    );
  }

  function openNewSession() {
    if (snapshot) setSessionDraft(blankSessionDraft(snapshot));
  }

  function openNewFormat() {
    if (snapshot) setFormatDraft(blankFormatDraft(snapshot));
  }

  function openLinkedFormat(format: CatalogFormat) {
    setCatalogItemDraft(null);
    setFormatDraft(draftFromFormat(format));
  }

  return (
    <AdminCatalogPage>
      <AdminCatalogHeader description={copy.description} title={copy.title} />

      {status === "loading" ? <AdminCatalogLoadingState /> : null}
      {status === "error" ? (
        <AdminCatalogErrorState
          description={`Vérifie ${persistenceLabel} et le schéma catalogue.`}
          message={message}
          onRetry={() => void loadSnapshot()}
        />
      ) : null}

      {status === "success" && snapshot ? (
        <>
          <AdminCatalogStructureStats snapshot={snapshot} />

          <AdminCatalogMessage message={message} />

          <AdminCatalogToolbar>
            <ActionButton onPress={() => void loadSnapshot()} variant="secondary">
              Actualiser
            </ActionButton>
            <ActionButton
              disabled={saving}
              onPress={() => void exportSeedSnapshot()}
              variant="secondary"
            >
              Exporter seed
            </ActionButton>
            {section === "sessions" || section === "levels" ? (
              <PillarFilterChips
                active={pillarFilter}
                onChange={setPillarFilter}
                pillars={snapshot.pillars}
              />
            ) : null}
          </AdminCatalogToolbar>

          {section === "levels" ? (
            <LevelsSection
              disabled={saving}
              onEditSession={(session) =>
                setSessionDraft(draftFromSession(session))
              }
              onNewSession={openNewSession}
              sessions={filteredSessions}
            />
          ) : null}

          {section === "sessions" ? (
            <SessionsSection
              disabled={saving}
              onEditSession={(session) =>
                setSessionDraft(draftFromSession(session))
              }
              onNewSession={openNewSession}
              sessions={filteredSessions}
            />
          ) : null}

          {section === "formats" ? (
            <FormatsSection
              disabled={saving}
              formats={snapshot.formats}
              onEditFormat={(format) => setFormatDraft(draftFromFormat(format))}
              onNewFormat={openNewFormat}
              snapshot={snapshot}
            />
          ) : null}

          {catalogItemKind ? (
            <CatalogItemsSection
              catalogItemKind={catalogItemKind}
              disabled={saving}
              onEditCatalogItem={setCatalogItemDraft}
              onNewCatalogItem={(kind) =>
                setCatalogItemDraft(blankCatalogItemDraft(kind))
              }
              snapshot={snapshot}
            />
          ) : null}

          <CatalogModal
            onClose={() => setSessionDraft(null)}
            title={
              sessionDraft?.id ? "Modifier la session" : "Créer une session"
            }
            visible={sessionDraft !== null}
          >
            {sessionDraft ? (
              <SessionForm
                disabled={saving}
                draft={sessionDraft}
                onCancel={() => setSessionDraft(null)}
                onChange={setSessionDraft}
                onDelete={
                  sessionDraft.id
                    ? () =>
                        void runMutation("Session supprimée.", async () => {
                          await deleteCatalogSessionTemplate(
                            requireNumber(sessionDraft.id, "Session"),
                          );
                          setSessionDraft(null);
                        })
                    : undefined
                }
                onSave={() => void saveSessionDraft()}
                snapshot={snapshot}
              />
            ) : null}
          </CatalogModal>

          <CatalogModal
            onClose={() => setFormatDraft(null)}
            title={formatDraft?.id ? "Modifier le format" : "Créer un format"}
            visible={formatDraft !== null}
          >
            {formatDraft ? (
              <FormatForm
                disabled={saving}
                draft={formatDraft}
                onCancel={() => setFormatDraft(null)}
                onChange={setFormatDraft}
                onDelete={
                  formatDraft.id
                    ? () =>
                        void runMutation("Format supprimé.", async () => {
                          await deleteCatalogFormat(
                            requireNumber(formatDraft.id, "Format"),
                          );
                          setFormatDraft(null);
                        })
                    : undefined
                }
                onSave={() => void saveFormatDraft()}
                snapshot={snapshot}
              />
            ) : null}
          </CatalogModal>

          <CatalogModal
            onClose={() => setCatalogItemDraft(null)}
            title={
              catalogItemDraft ? catalogItemDraftTitle(catalogItemDraft) : ""
            }
            visible={catalogItemDraft !== null}
          >
            {catalogItemDraft ? (
              <CatalogItemForm
                disabled={saving}
                draft={catalogItemDraft}
                key={`${catalogItemDraft.kind}:${catalogItemDraft.value.id ?? "new"}`}
                linkedFormats={catalogItemUsage(
                  snapshot,
                  catalogItemDraft.kind,
                  catalogItemDraft.value.id,
                )}
                onCancel={() => setCatalogItemDraft(null)}
                onChange={setCatalogItemDraft}
                onDelete={
                  catalogItemDraft.value.id
                    ? () =>
                        void deleteCatalogItemIfUnused(
                          catalogItemDraft,
                          snapshot,
                          runMutation,
                          () => setCatalogItemDraft(null),
                        )
                    : undefined
                }
                onFormatPress={openLinkedFormat}
                onSave={() => void saveCatalogItemDraft()}
              />
            ) : null}
          </CatalogModal>
        </>
      ) : null}
    </AdminCatalogPage>
  );
}
