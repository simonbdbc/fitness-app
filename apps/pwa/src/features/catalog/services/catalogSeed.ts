import catalogSeedArtifact from "../data/catalogSeed.json";
import { mergeExerciseLibraryIntoCatalogSeed } from "../data/exerciseLibrarySeed";
import type { CatalogSeed } from "../types";
import { canonicalEquipment } from "./equipmentRequirements";

export function getLocalCatalogSeed(): CatalogSeed {
  const foundation = catalogSeedArtifact as unknown as CatalogSeed;
  const coreFormatCodes = new Set([
    "format-reps-s01-maximum-rest30s",
    "format-reps-s02-r08-rest90s",
    "format-reps-s02-r12-rest90s",
    "format-reps-s02-r16-rest90s",
    "format-reps-s03-r08-rest90s",
    "format-reps-s03-r12-rest90s",
    "format-reps-s03-r16-rest90s",
    // Defaults for the standalone timer. The timer itself composes its plan
    // from primitive options, so these are deliberately not the full matrix.
    "format-reps-s03-r10-rest60s",
    "format-interval-60s-s03-rest60s",
  ]);
  const formats = foundation.formats.filter((format) =>
    coreFormatCodes.has(format.code),
  );
  const seriesCodes = new Set(formats.map((format) => format.seriesCode));
  const repetitionCodes = new Set(
    formats.flatMap((format) =>
      format.repetitionsCode ? [format.repetitionsCode] : [],
    ),
  );
  const restCodes = new Set(formats.map((format) => format.restCode));
  const intervalCodes = new Set(
    formats.flatMap((format) =>
      format.intervalCode ? [format.intervalCode] : [],
    ),
  );

  return mergeExerciseLibraryIntoCatalogSeed({
    ...foundation,
    equipment: canonicalEquipment,
    exercises: [],
    series: foundation.series.filter((row) => seriesCodes.has(row.code)),
    repetitions: foundation.repetitions.filter((row) =>
      repetitionCodes.has(row.code),
    ),
    rests: foundation.rests.filter((row) => restCodes.has(row.code)),
    intervals: foundation.intervals.filter((row) => intervalCodes.has(row.code)),
    formats,
    sessionTemplates: [],
    sessionTemplateLevels: [],
  });
}
