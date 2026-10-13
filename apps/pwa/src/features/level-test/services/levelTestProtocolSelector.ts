import type { LocalDatabase } from "@shared/db/database";
import { resolveCatalogEvaluationProtocolVersionWithDatabase } from "@features/catalog/programming";
import {
  acreaEntryTestExercises,
  type ACREALevelEvaluationProtocolVersion,
} from "@features/programming";

export async function resolveLevelTestProtocolVersionWithDatabase(
  db: LocalDatabase,
): Promise<ACREALevelEvaluationProtocolVersion> {
  return resolveCatalogEvaluationProtocolVersionWithDatabase(
    db,
    acreaEntryTestExercises.length,
  );
}
