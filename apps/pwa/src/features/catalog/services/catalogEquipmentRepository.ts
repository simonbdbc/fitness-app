import { withDatabase } from "@shared/db";
import {
  assertEquipmentLabelIsConcrete,
  isStableCatalogCode,
  normalizeEquipmentCode,
} from "../domain/catalogValidation";
import { mapCatalogEquipmentUsageRow } from "../infrastructure/catalogRows";
import { getCatalogEquipmentUsageRows } from "../infrastructure/catalogQueries";
import { ensureCatalogReady } from "./catalogLifecycle";
import type {
  CatalogEquipmentInput,
  CatalogEquipmentUsage,
} from "../types";

export async function upsertCatalogEquipmentLocal(
  input: CatalogEquipmentInput,
): Promise<CatalogEquipmentUsage> {
  await ensureCatalogReady();

  return withDatabase(async (db) => {
    const code = normalizeEquipmentCode(input.code);
    const label = input.label.trim();

    if (!code) {
      throw new Error("Le code équipement est requis.");
    }

    if (!isStableCatalogCode(code)) {
      throw new Error(
        "Le code équipement doit utiliser uniquement lettres minuscules, chiffres et tirets.",
      );
    }

    if (!label) {
      throw new Error("Le libellé équipement est requis.");
    }
    assertEquipmentLabelIsConcrete(label);

    const duplicateRows = await db.getAllAsync<{ id: number }>(
      `
      SELECT id
      FROM catalog_equipment
      WHERE code = ?
        AND (? IS NULL OR id <> ?)
      LIMIT 1
      `,
      [code, input.id ?? null, input.id ?? null],
    );

    if (duplicateRows.length > 0) {
      throw new Error("Ce code équipement existe déjà.");
    }

    if (typeof input.id === "number") {
      await db.runAsync(
        `
        UPDATE catalog_equipment
        SET code = ?, label = ?, category = ?
        WHERE id = ?
        `,
        [code, label, input.category, input.id],
      );
    } else {
      await db.runAsync(
        `
        INSERT INTO catalog_equipment (code, label, category)
        VALUES (?, ?, ?)
        `,
        [code, label, input.category],
      );
    }

    const rows = await getCatalogEquipmentUsageRows(db, code);
    const row = rows[0];

    if (!row) {
      throw new Error("Équipement introuvable après enregistrement.");
    }

    return mapCatalogEquipmentUsageRow(row);
  });
}

export async function deleteCatalogEquipmentLocal(id: number): Promise<void> {
  await ensureCatalogReady();

  await withDatabase(async (db) => {
    const rows = await db.getAllAsync<{
      exercise_count: number;
      profile_count: number;
    }>(
      `
      SELECT
        (SELECT COUNT(DISTINCT options.exercise_id)
         FROM catalog_exercise_equipment_option_items items
         JOIN catalog_exercise_equipment_options options ON options.id = items.option_id
         WHERE items.equipment_id = ?) AS exercise_count,
        (SELECT COUNT(*) FROM acrea_profile_equipment inventory
         WHERE inventory.equipment_id = ?) AS profile_count
      `,
      [id, id],
    );
    const exerciseCount = rows[0]?.exercise_count ?? 0;
    const profileCount = rows[0]?.profile_count ?? 0;

    if (exerciseCount > 0 || profileCount > 0) {
      throw new Error(
        `Suppression impossible: ${exerciseCount} exercice(s) et ${profileCount} profil(s) utilisent cet équipement.`,
      );
    }

    await db.runAsync("DELETE FROM catalog_equipment WHERE id = ?", [id]);
  });
}
