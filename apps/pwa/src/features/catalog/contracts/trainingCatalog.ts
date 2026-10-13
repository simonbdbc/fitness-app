import type { CatalogFormat } from "../types";

export type TrainingCatalogFormatReference = {
  formatCode?: string | null;
  formatId: number;
  formatLabel: string;
};

export type TrainingCatalogTimerFormat =
  | {
      code: string;
      formatType: "repetitions";
      label: string;
      repetitions: number | null;
      restSeconds: number;
      seriesCount: number;
    }
  | {
      code: string;
      formatType: "intervalles";
      intervalSeconds: number;
      label: string;
      restSeconds: number;
      seriesCount: number;
    };

export function resolveTrainingCatalogTimerFormat(
  formats: readonly CatalogFormat[],
  reference: TrainingCatalogFormatReference,
): TrainingCatalogTimerFormat | null {
  const format =
    formats.find((candidate) => candidate.id === reference.formatId) ??
    (reference.formatCode
      ? formats.find((candidate) => candidate.code === reference.formatCode)
      : undefined) ??
    formats.find((candidate) => candidate.label === reference.formatLabel);

  if (!format || format.seriesCount <= 0 || format.restSeconds < 0) return null;

  if (format.formatType === "repetitions") {
    return {
      code: format.code,
      formatType: "repetitions",
      label: format.label,
      repetitions: format.repetitions,
      restSeconds: format.restSeconds,
      seriesCount: format.seriesCount,
    };
  }

  if (format.intervalSeconds === null || format.intervalSeconds <= 0) {
    return null;
  }

  return {
    code: format.code,
    formatType: "intervalles",
    intervalSeconds: format.intervalSeconds,
    label: format.label,
    restSeconds: format.restSeconds,
    seriesCount: format.seriesCount,
  };
}
