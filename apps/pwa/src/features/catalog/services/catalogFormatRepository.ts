import type { LocalDatabase } from "@shared/db/database";
import { withDatabase } from "@shared/db";
import {
  codeFromLabel,
  normalizeCatalogCode,
  requireFiniteNumber,
  requireNonNegativeInteger,
  requirePositiveInteger,
  requireTrimmed,
} from "../domain/catalogValidation";
import { ensureCatalogReady } from "./catalogLifecycle";
import type {
  CatalogFormatInput,
  CatalogIntervalInput,
  CatalogRepetitionInput,
  CatalogRestInput,
  CatalogSeriesInput,
} from "../types";

export async function upsertCatalogSeriesLocal(
  input: CatalogSeriesInput,
): Promise<void> {
  await ensureCatalogReady();
  await withDatabase(async (db) => {
    await upsertSeries(db, input);
  });
}

export async function deleteCatalogSeriesLocal(id: number): Promise<void> {
  await deleteReferencedCatalogItem("catalog_series", "series_id", id, "série");
}

export async function upsertCatalogRepetitionLocal(
  input: CatalogRepetitionInput,
): Promise<void> {
  await ensureCatalogReady();
  await withDatabase(async (db) => {
    await upsertRepetition(db, input);
  });
}

export async function deleteCatalogRepetitionLocal(id: number): Promise<void> {
  await deleteReferencedCatalogItem(
    "catalog_repetitions",
    "repetitions_id",
    id,
    "répétition",
  );
}

export async function upsertCatalogRestLocal(
  input: CatalogRestInput,
): Promise<void> {
  await ensureCatalogReady();
  await withDatabase(async (db) => {
    await upsertRest(db, input);
  });
}

export async function deleteCatalogRestLocal(id: number): Promise<void> {
  await deleteReferencedCatalogItem("catalog_rests", "rest_id", id, "repos");
}

export async function upsertCatalogIntervalLocal(
  input: CatalogIntervalInput,
): Promise<void> {
  await ensureCatalogReady();
  await withDatabase(async (db) => {
    await upsertInterval(db, input);
  });
}

export async function deleteCatalogIntervalLocal(id: number): Promise<void> {
  await deleteReferencedCatalogItem(
    "catalog_intervals",
    "interval_id",
    id,
    "intervalle",
  );
}

export async function upsertCatalogFormatLocal(
  input: CatalogFormatInput,
): Promise<void> {
  await ensureCatalogReady();
  await withDatabase(async (db) => {
    const now = input.updatedAt ?? new Date().toISOString();
    const code = normalizeCatalogCode(
      input.code || codeFromLabel("format", input.label),
    );
    const label = requireTrimmed(input.label, "Libellé format");
    const seriesId =
      input.seriesId ??
      (await getFirstRequiredId(db, "catalog_series", "série"));
    const restId =
      input.restId ?? (await getFirstRequiredId(db, "catalog_rests", "repos"));
    const isRepetitions = input.formatType === "repetitions";
    const repetitionsId = isRepetitions
      ? requireFiniteNumber(input.repetitionsId, "Répétition format")
      : null;
    const intervalId = isRepetitions
      ? null
      : requireFiniteNumber(input.intervalId, "Intervalle format");
    if (input.id > 0) {
      await db.runAsync(
        `
        UPDATE catalog_formats
        SET
          code = ?,
          format_type = ?,
          series_id = ?,
          repetitions_id = ?,
          rest_id = ?,
          interval_id = ?,
          label = ?,
          description = ?,
          source_status = ?,
          updated_at = ?
        WHERE id = ?
        `,
        [
          code,
          input.formatType,
          seriesId,
          repetitionsId,
          restId,
          intervalId,
          label,
          input.description.trim(),
          input.sourceStatus || "admin SQLite local",
          now,
          input.id,
        ],
      );
      return;
    }

    await db.runAsync(
      `
      INSERT INTO catalog_formats (
        code,
        format_type,
        series_id,
        repetitions_id,
        rest_id,
        interval_id,
        label,
        description,
        source_status,
        updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `,
      [
        code,
        input.formatType,
        seriesId,
        repetitionsId,
        restId,
        intervalId,
        label,
        input.description.trim(),
        input.sourceStatus || "admin SQLite local",
        now,
      ],
    );
  });
}

export async function deleteCatalogFormatLocal(id: number): Promise<void> {
  await ensureCatalogReady();
  await withDatabase(async (db) => {
    await db.runAsync("DELETE FROM catalog_formats WHERE id = ?", [id]);
  });
}


async function upsertSeries(
  db: LocalDatabase,
  input: CatalogSeriesInput,
) {
  const now = input.updatedAt ?? new Date().toISOString();
  const code = normalizeCatalogCode(
    input.code || codeFromLabel("series", input.label),
  );
  const label = requireTrimmed(input.label, "Libellé série");
  const series = requirePositiveInteger(input.series, "Séries");

  if (input.id > 0) {
    await db.runAsync(
      `
      UPDATE catalog_series
      SET code = ?, label = ?, series = ?, updated_at = ?
      WHERE id = ?
      `,
      [code, label, series, now, input.id],
    );
    return;
  }

  await db.runAsync(
    `
    INSERT INTO catalog_series (code, label, series, updated_at)
    VALUES (?, ?, ?, ?)
    `,
    [code, label, series, now],
  );
}

async function upsertRepetition(
  db: LocalDatabase,
  input: CatalogRepetitionInput,
) {
  const now = input.updatedAt ?? new Date().toISOString();
  const code = normalizeCatalogCode(
    input.code ||
      (input.reps === null
        ? "reps-maximum"
        : codeFromLabel("repetition", input.label)),
  );
  const label = requireTrimmed(input.label, "Libellé répétition");

  if (input.reps === null) {
    const maximumRows = await db.getAllAsync<{ id: number }>(
      `
      SELECT id
      FROM catalog_repetitions
      WHERE reps IS NULL
        AND id <> ?
      LIMIT 1
      `,
      [input.id],
    );
    if (maximumRows.length > 0) {
      throw new Error("Une répétition Maximum existe déjà.");
    }
  } else {
    requirePositiveInteger(input.reps, "Nombre de répétitions");
  }

  if (input.id > 0) {
    await db.runAsync(
      `
      UPDATE catalog_repetitions
      SET code = ?, label = ?, reps = ?, updated_at = ?
      WHERE id = ?
      `,
      [code, label, input.reps, now, input.id],
    );
    return;
  }

  await db.runAsync(
    `
      INSERT INTO catalog_repetitions (
        code,
        label,
        reps,
        updated_at
      ) VALUES (?, ?, ?, ?)
    `,
    [code, label, input.reps, now],
  );
}

async function upsertRest(db: LocalDatabase, input: CatalogRestInput) {
  const now = input.updatedAt ?? new Date().toISOString();
  const code = normalizeCatalogCode(
    input.code || codeFromLabel("rest", input.label),
  );
  const label = requireTrimmed(input.label, "Libellé repos");
  const restSeconds = requireNonNegativeInteger(input.restSeconds, "Repos");

  if (input.id > 0) {
    await db.runAsync(
      `
      UPDATE catalog_rests
      SET code = ?, label = ?, rest_seconds = ?, updated_at = ?
      WHERE id = ?
      `,
      [code, label, restSeconds, now, input.id],
    );
    return;
  }

  await db.runAsync(
    `
    INSERT INTO catalog_rests (code, label, rest_seconds, updated_at)
    VALUES (?, ?, ?, ?)
    `,
    [code, label, restSeconds, now],
  );
}

async function upsertInterval(
  db: LocalDatabase,
  input: CatalogIntervalInput,
) {
  const now = input.updatedAt ?? new Date().toISOString();
  const code = normalizeCatalogCode(
    input.code || codeFromLabel("interval", input.label),
  );
  const label = requireTrimmed(input.label, "Libellé intervalle");
  const effortSeconds = requirePositiveInteger(
    input.effortSeconds,
    "Effort intervalle",
  );

  if (input.id > 0) {
    await db.runAsync(
      `
      UPDATE catalog_intervals
      SET code = ?, label = ?, effort_seconds = ?, updated_at = ?
      WHERE id = ?
      `,
      [code, label, effortSeconds, now, input.id],
    );
    return;
  }

  await db.runAsync(
    `
      INSERT INTO catalog_intervals (
        code,
        label,
        effort_seconds,
        updated_at
      ) VALUES (?, ?, ?, ?)
    `,
    [code, label, effortSeconds, now],
  );
}

async function deleteReferencedCatalogItem(
  tableName:
    | "catalog_series"
    | "catalog_repetitions"
    | "catalog_rests"
    | "catalog_intervals",
  referenceColumn: "series_id" | "repetitions_id" | "rest_id" | "interval_id",
  id: number,
  label: string,
) {
  await ensureCatalogReady();
  await withDatabase(async (db) => {
    const rows = await db.getAllAsync<{ usage_count: number }>(
      `
      SELECT COUNT(*) AS usage_count
      FROM catalog_formats
      WHERE ${referenceColumn} = ?
      `,
      [id],
    );
    const usageCount = rows[0]?.usage_count ?? 0;

    if (usageCount > 0) {
      throw new Error(
        `Suppression impossible: ${usageCount} format(s) utilisent cette ${label}.`,
      );
    }

    await db.runAsync(`DELETE FROM ${tableName} WHERE id = ?`, [id]);
  });
}


async function getFirstRequiredId(
  db: LocalDatabase,
  tableName: "catalog_series" | "catalog_rests",
  label: string,
) {
  const rows = await db.getAllAsync<{ id: number }>(
    `SELECT id FROM ${tableName} ORDER BY id LIMIT 1`,
  );
  const id = rows[0]?.id;

  if (typeof id !== "number") {
    throw new Error(`Aucun élément ${label} disponible.`);
  }

  return id;
}
