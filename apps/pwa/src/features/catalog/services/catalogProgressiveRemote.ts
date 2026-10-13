import { isSupabaseConfigured } from "@shared/config/clientConfig";
import { getSupabaseClient } from "@shared/config/supabaseClient";

import type { CatalogSeed } from "../types";

const maxDetailsPerRequest = 25;

type CatalogProgressivePayload = Partial<CatalogSeed> & {
  exercises?: unknown;
  releases?: unknown;
};

function requireArray<TValue>(
  value: unknown,
  field: string,
): readonly TValue[] {
  if (!Array.isArray(value)) {
    throw new Error(`Réponse catalogue invalide : ${field} est absent.`);
  }
  return value as readonly TValue[];
}

/**
 * The RPC payload already follows the portable catalogue seed contract.  The
 * structural checks keep a malformed edge response from being written to
 * SQLite, while detailed business validation remains in the seed writer.
 */
function decodePayload(payload: unknown): CatalogSeed {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    throw new Error("Réponse catalogue invalide.");
  }
  const value = payload as CatalogProgressivePayload;
  return {
    releases: requireArray(value.releases, "releases"),
    pillars: requireArray(value.pillars, "pillars"),
    impacts: requireArray(value.impacts, "impacts"),
    families: requireArray(value.families, "families"),
    types: requireArray(value.types, "types"),
    muscleGroups: requireArray(value.muscleGroups, "muscleGroups"),
    equipment: requireArray(value.equipment, "equipment"),
    exercises: requireArray(value.exercises, "exercises"),
    series: requireArray(value.series, "series"),
    repetitions: requireArray(value.repetitions, "repetitions"),
    rests: requireArray(value.rests, "rests"),
    intervals: requireArray(value.intervals, "intervals"),
    formats: requireArray(value.formats, "formats"),
    sessionTemplates: requireArray(value.sessionTemplates, "sessionTemplates"),
    sessionTemplateLevels: requireArray(
      value.sessionTemplateLevels,
      "sessionTemplateLevels",
    ),
  } as CatalogSeed;
}

function assertConfigured() {
  if (!isSupabaseConfigured) {
    throw new Error("Connexion requise pour télécharger le catalogue.");
  }
}

export async function fetchActiveCatalogIndex(): Promise<CatalogSeed> {
  assertConfigured();
  const client = getSupabaseClient();
  const { data, error } = await client.rpc("get_active_catalog_index");
  if (error) throw new Error(error.message);
  const seed = decodePayload(data);
  if (seed.releases?.filter((release) => release.status === "active").length !== 1) {
    throw new Error("L'index distant doit déclarer une release active unique.");
  }
  return seed;
}

export async function fetchActiveCatalogDetails(
  slugs: readonly string[],
): Promise<CatalogSeed> {
  const uniqueSlugs = [...new Set(slugs)];
  if (uniqueSlugs.length === 0) {
    throw new Error("Aucune fiche catalogue demandée.");
  }
  if (uniqueSlugs.length > maxDetailsPerRequest) {
    throw new Error(
      `Une demande de fiches est limitée à ${maxDetailsPerRequest} exercices.`,
    );
  }
  assertConfigured();
  const client = getSupabaseClient();
  const { data, error } = await client.rpc("get_active_catalog_details", {
    p_slugs: uniqueSlugs,
  });
  if (error) throw new Error(error.message);
  const seed = decodePayload(data);
  if (seed.exercises.length !== uniqueSlugs.length) {
    throw new Error("Une ou plusieurs fiches demandées sont indisponibles.");
  }
  return seed;
}

export { maxDetailsPerRequest };
