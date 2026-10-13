import type { LocalDatabase } from "@shared/db";

export type CatalogCodeTable =
  | "catalog_pillars"
  | "catalog_impacts"
  | "catalog_families"
  | "catalog_types"
  | "catalog_muscle_groups"
  | "catalog_equipment"
  | "catalog_exercises"
  | "catalog_series"
  | "catalog_repetitions"
  | "catalog_rests"
  | "catalog_intervals"
  | "catalog_session_templates";

export async function getRequiredCatalogIdByCode(
  db: LocalDatabase,
  tableName: CatalogCodeTable,
  code: string,
): Promise<number> {
  const rows = await db.getAllAsync<{ id: number }>(
    `SELECT id FROM ${tableName} WHERE code = ? LIMIT 1`,
    [code],
  );
  const id = rows[0]?.id;

  if (typeof id !== "number") {
    throw new Error(`Code catalogue introuvable: ${tableName}.${code}`);
  }

  return id;
}

export function getRequiredMappedCatalogId(
  idsByCode: Map<string, number>,
  code: string,
): number {
  const id = idsByCode.get(code);

  if (typeof id !== "number") {
    throw new Error(`Code catalogue introuvable: ${code}`);
  }

  return id;
}

export function getOptionalMappedCatalogId(
  idsByCode: Map<string, number>,
  code: string | null | undefined,
): number | null {
  return code ? getRequiredMappedCatalogId(idsByCode, code) : null;
}
