import {
  deleteCatalogInterval,
  deleteCatalogRepetition,
  deleteCatalogRest,
  deleteCatalogSeries,
  type CatalogAdminSnapshot,
} from "../services/catalogRemote";
import {
  getCatalogFormatTypeBusinessLabel,
  type CatalogFormat,
  type CatalogFormatType,
  type CatalogInterval,
  type CatalogRepetition,
  type CatalogRest,
  type CatalogSeries,
  type CatalogSessionTemplate,
} from "../types";
export type AdminCatalogStructureSection =
  | "levels"
  | "sessions"
  | "formats"
  | "series"
  | "repetitions"
  | "intervals"
  | "rests";

export type LoadStatus = "loading" | "success" | "error";
export type CatalogItemKind = "series" | "repetitions" | "rests" | "intervals";
export type PillarFilter = number | "all";

export type SessionDraft = {
  id: number | null;
  code: string;
  title: string;
  description: string;
  pillarId: number | null;
  familyId: number | null;
  exerciseId: number | null;
  phase: "warmup" | "main" | "cooldown";
  levels: number[];
  isActive: boolean;
  sourceStatus: string;
};

export type FormatDraft = {
  id: number | null;
  code: string;
  formatType: CatalogFormatType;
  seriesId: number | null;
  repetitionsId: number | null;
  intervalId: number | null;
  restId: number | null;
  label: string;
  description: string;
  sourceStatus: string;
};

export type SeriesDraft = {
  id: number | null;
  code: string;
  label: string;
  series: string;
};

export type RepetitionDraft = {
  id: number | null;
  code: string;
  label: string;
  reps: string;
  isMaximum: boolean;
};

export type RestDraft = {
  id: number | null;
  code: string;
  label: string;
  restSeconds: string;
};

export type IntervalDraft = {
  id: number | null;
  code: string;
  label: string;
  effortSeconds: string;
};

export type CatalogItemDraft =
  | { kind: "series"; value: SeriesDraft }
  | { kind: "repetitions"; value: RepetitionDraft }
  | { kind: "rests"; value: RestDraft }
  | { kind: "intervals"; value: IntervalDraft };

const adminSourceStatus = "admin catalogue";
export const levels = Array.from({ length: 10 }, (_, index) => index + 1);

export const sectionCopy: Record<
  AdminCatalogStructureSection,
  { title: string; description: string }
> = {
  levels: {
    title: "Niveaux",
    description: "Visualiser les sessions disponibles pour chaque niveau.",
  },
  sessions: {
    title: "Sessions",
    description: "Gérer les templates de session et leurs niveaux.",
  },
  formats: {
    title: "Formats",
    description: "Assembler séries, répétitions, intervalles et repos.",
  },
  series: {
    title: "Séries",
    description: "Visualiser et gérer les séries du catalogue.",
  },
  repetitions: {
    title: "Répétitions",
    description: "Visualiser et gérer les répétitions du catalogue.",
  },
  intervals: {
    title: "Intervalles",
    description: "Visualiser et gérer les intervalles du catalogue.",
  },
  rests: {
    title: "Repos",
    description: "Visualiser et gérer les repos du catalogue.",
  },
};

export function catalogItemKindFromSection(
  section: AdminCatalogStructureSection,
): CatalogItemKind | null {
  if (section === "series") return "series";
  if (section === "repetitions") return "repetitions";
  if (section === "intervals") return "intervals";
  if (section === "rests") return "rests";
  return null;
}

export function catalogItemRows(
  snapshot: CatalogAdminSnapshot,
  kind: CatalogItemKind,
) {
  if (kind === "series") {
    return snapshot.series.map((item) => ({
      draft: { kind, value: draftFromSeries(item) } satisfies CatalogItemDraft,
      id: item.id,
      kindLabel: "Série",
      label: item.label,
      usageCount: catalogItemUsage(snapshot, kind, item.id).length,
      valueLabel: `${item.series} série(s)`,
    }));
  }
  if (kind === "repetitions") {
    return snapshot.repetitions.map((item) => ({
      draft: {
        kind,
        value: draftFromRepetition(item),
      } satisfies CatalogItemDraft,
      id: item.id,
      kindLabel: item.reps === null ? "Maximum" : "Répétitions",
      label: item.label,
      usageCount: catalogItemUsage(snapshot, kind, item.id).length,
      valueLabel: item.reps === null ? "Maximum" : `${item.reps} répétition(s)`,
    }));
  }
  if (kind === "rests") {
    return snapshot.rests.map((item) => ({
      draft: { kind, value: draftFromRest(item) } satisfies CatalogItemDraft,
      id: item.id,
      kindLabel: "Repos",
      label: item.label,
      usageCount: catalogItemUsage(snapshot, kind, item.id).length,
      valueLabel: `${item.restSeconds} s`,
    }));
  }
  return snapshot.intervals.map((item) => ({
    draft: { kind, value: draftFromInterval(item) } satisfies CatalogItemDraft,
    id: item.id,
    kindLabel: "Intervalle",
    label: item.label,
    usageCount: catalogItemUsage(snapshot, kind, item.id).length,
    valueLabel: `${item.effortSeconds} s`,
  }));
}

export function catalogItemUsage(
  snapshot: CatalogAdminSnapshot,
  kind: CatalogItemKind,
  id: number | null,
) {
  if (!id) return [];

  return snapshot.formats.filter((format) => {
    if (kind === "series") return format.seriesId === id;
    if (kind === "repetitions") return format.repetitionsId === id;
    if (kind === "rests") return format.restId === id;
    return format.intervalId === id;
  });
}

export async function deleteCatalogItemIfUnused(
  draft: CatalogItemDraft,
  snapshot: CatalogAdminSnapshot,
  runMutation: (
    message: string,
    mutation: () => Promise<void>,
  ) => Promise<void>,
  onDeleted: () => void,
) {
  const id = requireNumber(draft.value.id, "Élément");
  if (catalogItemUsage(snapshot, draft.kind, id).length > 0) return;

  await runMutation("Élément supprimé.", async () => {
    if (draft.kind === "series") await deleteCatalogSeries(id);
    else if (draft.kind === "repetitions") await deleteCatalogRepetition(id);
    else if (draft.kind === "rests") await deleteCatalogRest(id);
    else await deleteCatalogInterval(id);
    onDeleted();
  });
}

export function blankSessionDraft(snapshot: CatalogAdminSnapshot): SessionDraft {
  const pillarId = snapshot.pillars[0]?.id ?? null;
  const familyId = snapshot.families[0]?.id ?? null;

  return {
    id: null,
    code: "",
    title: "",
    description: "",
    pillarId,
    familyId,
    exerciseId:
      snapshot.exercises.find(
        (exercise) =>
          exercise.pillarId === pillarId && exercise.family.id === familyId,
      )?.id ?? null,
    phase: "main",
    levels: [1],
    isActive: true,
    sourceStatus: adminSourceStatus,
  };
}

export function draftFromSession(session: CatalogSessionTemplate): SessionDraft {
  return {
    id: session.id,
    code: session.code,
    title: session.title,
    description: session.description,
    pillarId: session.pillarId,
    familyId: session.familyId,
    exerciseId: session.exerciseId,
    phase: session.phase,
    levels: session.levels,
    isActive: session.isActive,
    sourceStatus: session.sourceStatus,
  };
}

export function sessionFromDraft(draft: SessionDraft) {
  if (!draft.title.trim())
    throw new Error("Le titre de la session est requis.");
  if (!draft.exerciseId) throw new Error("Un exercice est requis.");
  if (draft.levels.length === 0)
    throw new Error("Au moins un niveau est requis.");

  return {
    id: draft.id ?? 0,
    code: draft.code || codeFromLabel("session", draft.title),
    title: draft.title.trim(),
    description: draft.description.trim(),
    exerciseId: draft.exerciseId,
    phase: draft.phase,
    levels: [...new Set(draft.levels)].sort((a, b) => a - b),
    isActive: draft.isActive,
    sourceStatus: draft.sourceStatus || adminSourceStatus,
  };
}

export function blankFormatDraft(snapshot: CatalogAdminSnapshot): FormatDraft {
  return {
    id: null,
    code: "",
    formatType: "repetitions",
    seriesId: snapshot.series[0]?.id ?? null,
    repetitionsId: snapshot.repetitions[0]?.id ?? null,
    intervalId: null,
    restId: snapshot.rests[0]?.id ?? null,
    label: "",
    description: "",
    sourceStatus: adminSourceStatus,
  };
}

export function draftFromFormat(format: CatalogFormat): FormatDraft {
  return {
    id: format.id,
    code: format.code,
    formatType: format.formatType,
    seriesId: format.seriesId,
    repetitionsId: format.repetitionsId,
    intervalId: format.intervalId,
    restId: format.restId,
    label: format.label,
    description: format.description,
    sourceStatus: format.sourceStatus,
  };
}

export function formatFromDraft(draft: FormatDraft) {
  if (!draft.label.trim()) throw new Error("Le libellé du format est requis.");

  return {
    id: draft.id ?? 0,
    code: draft.code || codeFromLabel("format", draft.label),
    formatType: draft.formatType,
    seriesId: requireNumber(draft.seriesId, "Série"),
    repetitionsId:
      draft.formatType === "repetitions"
        ? requireNumber(draft.repetitionsId, "Répétition")
        : null,
    intervalId:
      draft.formatType === "intervalles"
        ? requireNumber(draft.intervalId, "Intervalle")
        : null,
    restId: requireNumber(draft.restId, "Repos"),
    label: draft.label.trim(),
    description: draft.description.trim(),
    sourceStatus: draft.sourceStatus || adminSourceStatus,
  };
}

export function blankCatalogItemDraft(kind: CatalogItemKind): CatalogItemDraft {
  if (kind === "series") {
    return { kind, value: { id: null, code: "", label: "", series: "1" } };
  }
  if (kind === "repetitions") {
    return {
      kind,
      value: {
        id: null,
        code: "",
        label: "",
        reps: "1",
        isMaximum: false,
      },
    };
  }
  if (kind === "rests") {
    return {
      kind,
      value: { id: null, code: "", label: "", restSeconds: "30" },
    };
  }
  return {
    kind,
    value: {
      id: null,
      code: "",
      label: "",
      effortSeconds: "60",
    },
  };
}

export function draftFromSeries(item: CatalogSeries): SeriesDraft {
  return {
    id: item.id,
    code: item.code,
    label: item.label,
    series: String(item.series),
  };
}

export function draftFromRepetition(item: CatalogRepetition): RepetitionDraft {
  return {
    id: item.id,
    code: item.code,
    label: item.label,
    reps: String(item.reps ?? 1),
    isMaximum: item.reps === null,
  };
}

export function draftFromRest(item: CatalogRest): RestDraft {
  return {
    id: item.id,
    code: item.code,
    label: item.label,
    restSeconds: String(item.restSeconds),
  };
}

export function draftFromInterval(item: CatalogInterval): IntervalDraft {
  return {
    id: item.id,
    code: item.code,
    label: item.label,
    effortSeconds: String(item.effortSeconds),
  };
}

export function seriesFromDraft(draft: SeriesDraft) {
  return {
    id: draft.id ?? 0,
    code: draft.code || codeFromLabel("series", draft.label),
    label: requireText(draft.label, "Libellé"),
    series: positiveInteger(draft.series, "Nombre de séries"),
  };
}

export function repetitionFromDraft(draft: RepetitionDraft) {
  return {
    id: draft.id ?? 0,
    code:
      draft.code ||
      (draft.isMaximum
        ? "reps-maximum"
        : codeFromLabel("repetition", draft.label)),
    label: requireText(draft.label, "Libellé"),
    reps: draft.isMaximum
      ? null
      : positiveInteger(draft.reps, "Nombre de répétitions"),
  };
}

export function restFromDraft(draft: RestDraft) {
  return {
    id: draft.id ?? 0,
    code: draft.code || codeFromLabel("rest", draft.label),
    label: requireText(draft.label, "Libellé"),
    restSeconds: nonNegativeInteger(draft.restSeconds, "Durée de repos"),
  };
}

export function intervalFromDraft(draft: IntervalDraft) {
  return {
    id: draft.id ?? 0,
    code: draft.code || codeFromLabel("interval", draft.label),
    label: requireText(draft.label, "Libellé"),
    effortSeconds: positiveInteger(draft.effortSeconds, "Durée d'intervalle"),
  };
}

export function catalogItemDraftTitle(draft: CatalogItemDraft) {
  const action = draft.value.id ? "Modifier" : "Créer";
  if (draft.kind === "series") return `${action} une série`;
  if (draft.kind === "repetitions") return `${action} une répétition`;
  if (draft.kind === "rests") return `${action} un repos`;
  return `${action} un intervalle`;
}

export function newCatalogItemLabel(kind: CatalogItemKind) {
  if (kind === "series") return "Nouvelle série";
  if (kind === "repetitions") return "Nouvelle répétition";
  if (kind === "rests") return "Nouveau repos";
  return "Nouvel intervalle";
}

export function catalogItemSavedMessage(kind: CatalogItemKind) {
  if (kind === "series") return "Série enregistrée.";
  if (kind === "repetitions") return "Répétition enregistrée.";
  if (kind === "rests") return "Repos enregistré.";
  return "Intervalle enregistré.";
}

export function mapById<T extends { id: number }>(rows: T[]) {
  return new Map(rows.map((row) => [row.id, row]));
}

export function requireNumber(value: number | null, label: string) {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    throw new Error(`${label} est requis.`);
  }
  return Math.trunc(value);
}

export function requireText(value: string, label: string) {
  const text = value.trim();
  if (!text) throw new Error(`${label} est requis.`);
  return text;
}

export function positiveInteger(value: string, label: string) {
  const number = Math.trunc(Number(value));
  if (!Number.isFinite(number) || number <= 0) {
    throw new Error(`${label} doit être supérieur à 0.`);
  }
  return number;
}

export function nonNegativeInteger(value: string, label: string) {
  const number = Math.trunc(Number(value));
  if (!Number.isFinite(number) || number < 0) {
    throw new Error(`${label} doit être supérieur ou égal à 0.`);
  }
  return number;
}

export function codeFromLabel(prefix: string, label: string) {
  const code = label
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

  return `${prefix}-${code || Date.now()}`;
}

export function errorMessageFromUnknown(error: unknown) {
  if (error instanceof Error && error.message.trim()) return error.message;
  if (
    typeof error === "object" &&
    error !== null &&
    "message" in error &&
    typeof error.message === "string" &&
    error.message.trim()
  ) {
    return error.message;
  }
  return "Action catalogue impossible.";
}
