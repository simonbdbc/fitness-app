#!/usr/bin/env node

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { pathToFileURL, fileURLToPath } from "node:url";

const scriptDir = dirname(fileURLToPath(import.meta.url));
const projectRoot = resolve(scriptDir, "..");

const sourceStatus = "seed base formats metier";
const updatedAt = "2026-07-08T00:00:00.000Z";

const outputTargets = {
  sqlite: resolve(
    projectRoot,
    "src",
    "shared",
    "db",
    "seeds",
    "base-format.sqlite.sql",
  ),
};

const durationSeconds = [10, 20, 30, 40, 50, 60, 90, 120, 150, 180, 210, 240, 270, 300];
const restSeconds = durationSeconds;
const repetitionRestSeconds = range(30, 180, 30);
const intervalSeconds = durationSeconds;
const repetitions = range(4, 12, 1);
const series = range(1, 12, 1);
const intervalSeries = range(1, 8, 1);
const repetitionDefinitions = [
  ...repetitions.map((reps) => ({
    code: repetitionCode(reps),
    label: `${reps} ${plural(reps, "repetition", "repetitions")}`,
    reps,
  })),
  { code: repetitionCode(16), label: "16 repetitions", reps: 16 },
  { code: "reps-maximum", label: "Maximum", reps: null },
];

class RawSql {
  constructor(sql) {
    this.sql = sql;
  }
}

export function generateBaseFormatSeedSql(dialect) {
  return generateSql(dialect);
}

export function generateBaseFormatSeedData() {
  const rests = restSeconds.map((seconds) => ({
    code: restCode(seconds),
    label: `${formatDuration(seconds)} de repos`,
    restSeconds: seconds,
    updatedAt,
  }));
  const intervals = intervalSeconds.map((seconds) => ({
    code: intervalCode(seconds),
    label: `${formatDuration(seconds)} d'effort`,
    effortSeconds: seconds,
    updatedAt,
  }));
  const repetitionsRows = repetitionDefinitions.map((repetition) => ({
    ...repetition,
    updatedAt,
  }));
  const seriesRows = series.map((count) => ({
    code: seriesCode(count),
    label: `${count} ${plural(count, "serie", "series")}`,
    series: count,
    updatedAt,
  }));
  const repetitionFormats = [
    ...series.flatMap((seriesCount) =>
    repetitionDefinitions.filter(({ reps }) => reps !== null && reps !== 16).flatMap((repetition) =>
      repetitionRestSeconds.map((rest) => {
        const label = repetitionFormatLabel(seriesCount, repetition, rest);

        return {
          code: repetitionFormatCode(seriesCount, repetition, rest),
          formatType: "repetitions",
          seriesCode: seriesCode(seriesCount),
          repetitionsCode: repetition.code,
          restCode: restCode(rest),
          intervalCode: null,
          label,
          description: label,
          sourceStatus,
          updatedAt,
        };
      }),
    ),
  ),
    ...evaluationRepetitionSpecials().map(({ seriesCount, repetition, rest }) => {
      const label = repetitionFormatLabel(seriesCount, repetition, rest);
      return {
        code: repetitionFormatCode(seriesCount, repetition, rest),
        formatType: "repetitions",
        seriesCode: seriesCode(seriesCount),
        repetitionsCode: repetition.code,
        restCode: restCode(rest),
        intervalCode: null,
        label,
        description: label,
        sourceStatus,
        updatedAt,
      };
    }),
  ];
  const intervalFormats = intervalSeries.flatMap((seriesCount) =>
    intervalSeconds.flatMap((effort) =>
      restSeconds.map((rest) => {
        const label = `${seriesCount} ${plural(seriesCount, "serie", "series")} de ${formatDuration(
          effort,
        )} d'effort avec ${formatDuration(rest)} de repos`;

        return {
          code: intervalFormatCode(seriesCount, effort, rest),
          formatType: "intervalles",
          seriesCode: seriesCode(seriesCount),
          repetitionsCode: null,
          restCode: restCode(rest),
          intervalCode: intervalCode(effort),
          label,
          description: label,
          sourceStatus,
          updatedAt,
        };
      }),
    ),
  );
  const formats = [...repetitionFormats, ...intervalFormats];

  assertSeedData({
    rests,
    intervals,
    repetitions: repetitionsRows,
    series: seriesRows,
    repetitionFormats: repetitionFormats.map(formatSeedToSqlShape),
    intervalFormats: intervalFormats.map(formatSeedToSqlShape),
    formats: formats.map(formatSeedToSqlShape),
  });

  return {
    rests,
    series: seriesRows,
    repetitions: repetitionsRows,
    intervals,
    formats,
  };
}

if (isMainModule()) {
  const args = new Set(process.argv.slice(2));
  const checkOnly = args.has("--check");

  if ([...args].some((arg) => arg !== "--check")) {
    throw new Error(
      "Usage: node scripts/generate-base-format-seed.mjs [--check]",
    );
  }

  const generated = { sqlite: generateBaseFormatSeedSql("sqlite") };

  if (checkOnly) {
    const staleFiles = Object.entries(generated)
      .filter(
        ([dialect, sql]) =>
          !seedFileMatches(dialect, outputTargets[dialect], sql),
      )
      .map(([dialect]) => outputTargets[dialect]);

    if (staleFiles.length > 0) {
      throw new Error(
        `Seed formats non a jour:\n${staleFiles.map((file) => `- ${file}`).join("\n")}`,
      );
    }

    console.log("Seed formats a jour.");
  } else {
    for (const [dialect, sql] of Object.entries(generated)) {
      const outputPath = outputTargets[dialect];
      mkdirSync(dirname(outputPath), { recursive: true });
      writeFileSync(outputPath, sql, "utf8");
      console.log(`Seed ${dialect} genere: ${outputPath}`);
    }
  }
}

function formatSeedToSqlShape(format) {
  return {
    ...format,
    format_type: format.formatType,
    series_id: format.seriesCode,
    repetitions_id: format.repetitionsCode,
    rest_id: format.restCode,
    interval_id: format.intervalCode,
  };
}

function generateSql(dialect) {
  const prefix = dialect === "psql" ? "public." : "";
  const table = (name) => `${prefix}${name}`;

  const rests = restSeconds.map((seconds) => ({
    code: restCode(seconds),
    label: `${formatDuration(seconds)} de repos`,
    rest_seconds: seconds,
    updated_at: updatedAt,
  }));

  const intervals = intervalSeconds.map((seconds) => ({
    code: intervalCode(seconds),
    label: `${formatDuration(seconds)} d'effort`,
    effort_seconds: seconds,
    updated_at: updatedAt,
  }));

  const repetitionRows = repetitionDefinitions.map((repetition) => ({
    ...repetition,
    updated_at: updatedAt,
  }));

  const seriesRows = series.map((count) => ({
    code: seriesCode(count),
    label: `${count} ${plural(count, "serie", "series")}`,
    series: count,
    updated_at: updatedAt,
  }));

  const repetitionFormats = [
    ...series.flatMap((seriesCount) =>
    repetitionDefinitions.filter(({ reps }) => reps !== null && reps !== 16).flatMap((repetition) =>
      repetitionRestSeconds.map((rest) => {
        const label = repetitionFormatLabel(seriesCount, repetition, rest);

        return {
          code: repetitionFormatCode(seriesCount, repetition, rest),
          format_type: "repetitions",
          series_id: raw(
            `(select id from ${table("catalog_series")} where code = ${quote(seriesCode(seriesCount))})`,
          ),
          repetitions_id: raw(
            `(select id from ${table("catalog_repetitions")} where code = ${quote(repetition.code)})`,
          ),
          rest_id: raw(
            `(select id from ${table("catalog_rests")} where code = ${quote(restCode(rest))})`,
          ),
          interval_id: null,
          label,
          description: label,
          source_status: sourceStatus,
          updated_at: updatedAt,
        };
      }),
    ),
  ),
    ...evaluationRepetitionSpecials().map(({ seriesCount, repetition, rest }) => {
      const label = repetitionFormatLabel(seriesCount, repetition, rest);
      return {
        code: repetitionFormatCode(seriesCount, repetition, rest),
        format_type: "repetitions",
        series_id: raw(
          `(select id from ${table("catalog_series")} where code = ${quote(seriesCode(seriesCount))})`,
        ),
        repetitions_id: raw(
          `(select id from ${table("catalog_repetitions")} where code = ${quote(repetition.code)})`,
        ),
        rest_id: raw(
          `(select id from ${table("catalog_rests")} where code = ${quote(restCode(rest))})`,
        ),
        interval_id: null,
        label,
        description: label,
        source_status: sourceStatus,
        updated_at: updatedAt,
      };
    }),
  ];

  const intervalFormats = intervalSeries.flatMap((seriesCount) =>
    intervalSeconds.flatMap((effort) =>
      restSeconds.map((rest) => {
        const label = `${seriesCount} ${plural(seriesCount, "serie", "series")} de ${formatDuration(
          effort,
        )} d'effort avec ${formatDuration(rest)} de repos`;

        return {
          code: intervalFormatCode(seriesCount, effort, rest),
          format_type: "intervalles",
          series_id: raw(
            `(select id from ${table("catalog_series")} where code = ${quote(seriesCode(seriesCount))})`,
          ),
          repetitions_id: null,
          rest_id: raw(
            `(select id from ${table("catalog_rests")} where code = ${quote(restCode(rest))})`,
          ),
          interval_id: raw(
            `(select id from ${table("catalog_intervals")} where code = ${quote(intervalCode(effort))})`,
          ),
          label,
          description: label,
          source_status: sourceStatus,
          updated_at: updatedAt,
        };
      }),
    ),
  );

  const formats = [...repetitionFormats, ...intervalFormats];
  assertSeedData({
    rests,
    intervals,
    repetitions: repetitionRows,
    series: seriesRows,
    repetitionFormats,
    intervalFormats,
    formats,
  });

  const statements = [];
  if (dialect === "sqlite") statements.push("PRAGMA foreign_keys = ON;");
  statements.push("begin;");
  statements.push(
    upsert(
      table("catalog_rests"),
      ["code", "label", "rest_seconds", "updated_at"],
      rests,
    ),
  );
  statements.push(
    upsert(
      table("catalog_series"),
      ["code", "label", "series", "updated_at"],
      seriesRows,
    ),
  );
  statements.push(
    upsert(
      table("catalog_repetitions"),
      ["code", "label", "reps", "updated_at"],
      repetitionRows,
    ),
  );
  statements.push(
    upsert(
      table("catalog_intervals"),
      ["code", "label", "effort_seconds", "updated_at"],
      intervals,
    ),
  );
  statements.push(
    upsert(
      table("catalog_formats"),
      [
        "code",
        "format_type",
        "series_id",
        "repetitions_id",
        "rest_id",
        "interval_id",
        "label",
        "description",
        "source_status",
        "updated_at",
      ],
      formats,
    ),
  );
  statements.push("commit;");

  const sql = [
    "-- ACREA Fitness - seed base formats metier",
    "-- Source de verite: docs/metier",
    `-- Dialecte: ${dialect}`,
    `-- updated_at: ${updatedAt}`,
    `-- catalog_rests: ${rests.length}`,
    `-- catalog_series: ${seriesRows.length}`,
    `-- catalog_repetitions: ${repetitionRows.length}`,
    `-- catalog_intervals: ${intervals.length}`,
    `-- catalog_formats repetitions: ${repetitionFormats.length}`,
    `-- catalog_formats intervalles: ${intervalFormats.length}`,
    `-- catalog_formats total: ${formats.length}`,
    "",
    statements.join("\n\n"),
    "",
  ].join("\n");

  assertNoLegacyValues(sql);

  return sql;
}

function assertSeedData(data) {
  assertCount("catalog_rests", data.rests, 14);
  assertCount("catalog_series", data.series, 12);
  assertCount("catalog_repetitions", data.repetitions, 11);
  assertCount("catalog_intervals", data.intervals, 14);
  assertCount("catalog_formats repetitions", data.repetitionFormats, 651);
  assertCount("catalog_formats intervalles", data.intervalFormats, 1568);
  assertCount("catalog_formats total", data.formats, 2219);

  const maximumRepetitions = data.repetitions.filter(
    (row) => row.reps === null,
  );
  assertCount("catalog_repetitions maximum", maximumRepetitions, 1);

  for (const format of data.repetitionFormats) {
    if (
      format.format_type !== "repetitions" ||
      format.series_id === null ||
      format.repetitions_id === null ||
      format.rest_id === null ||
      format.interval_id !== null
    ) {
      throw new Error(`Format repetitions invalide: ${format.code}`);
    }
  }

  for (const format of data.intervalFormats) {
    if (
      format.format_type !== "intervalles" ||
      format.series_id === null ||
      format.repetitions_id !== null ||
      format.rest_id === null ||
      format.interval_id === null
    ) {
      throw new Error(`Format intervalles invalide: ${format.code}`);
    }
  }
}

function assertCount(label, rows, expected) {
  if (rows.length !== expected) {
    throw new Error(`${label}: attendu ${expected}, recu ${rows.length}`);
  }
}

function assertNoLegacyValues(sql) {
  const forbidden = ["temps", "hiit", "callisthenie"];
  const lower = sql.toLowerCase();
  const found = forbidden.filter((value) => lower.includes(value));

  if (found.length > 0) {
    throw new Error(
      `Valeurs legacy interdites dans le seed: ${found.join(", ")}`,
    );
  }
}

function upsert(tableName, columns, rows) {
  const updates = columns
    .filter((column) => column !== "code")
    .map((column) => `  ${column} = excluded.${column}`)
    .join(",\n");

  return [
    `insert into ${tableName} (${columns.join(", ")})`,
    "values",
    rows
      .map(
        (row) =>
          `  (${columns.map((column) => sqlValue(row[column])).join(", ")})`,
      )
      .join(",\n"),
    "on conflict (code) do update set",
    `${updates};`,
  ].join("\n");
}

function sqlValue(value) {
  if (value instanceof RawSql) return value.sql;
  if (value === null) return "null";
  if (typeof value === "number") return String(value);
  return quote(value);
}

function quote(value) {
  return `'${String(value).replaceAll("'", "''")}'`;
}

function raw(sql) {
  return new RawSql(sql);
}

function seedFileMatches(dialect, filePath, expected) {
  if (!existsSync(filePath)) {
    return false;
  }

  const actual = readFileSync(filePath, "utf8");

  if (dialect === "psql") {
    return actual === expected || actual.includes(expected);
  }

  return actual === expected;
}

function isMainModule() {
  return import.meta.url === pathToFileURL(process.argv[1]).href;
}

function restCode(seconds) {
  return `rest-${seconds}s`;
}

function seriesCode(count) {
  return `series-${pad2(count)}`;
}

function repetitionCode(reps) {
  return `reps-${pad2(reps)}`;
}

function intervalCode(seconds) {
  return `interval-${seconds}s`;
}

function repetitionFormatCode(seriesCount, repetition, rest) {
  const repetitionPart =
    repetition.reps === null ? "maximum" : `r${pad2(repetition.reps)}`;
  return `format-reps-s${pad2(seriesCount)}-${repetitionPart}-rest${rest}s`;
}

function intervalFormatCode(seriesCount, effort, rest) {
  return `format-interval-${effort}s-s${pad2(seriesCount)}-rest${rest}s`;
}

function repetitionFormatLabel(seriesCount, repetition, rest) {
  const seriesLabel = `${seriesCount} ${plural(seriesCount, "serie", "series")}`;
  const effortLabel =
    repetition.reps === null
      ? "du maximum de repetitions"
      : `de ${repetition.reps} ${plural(repetition.reps, "repetition", "repetitions")}`;
  return `${seriesLabel} ${effortLabel} avec ${formatDuration(rest)} de repos`;
}

function evaluationRepetitionSpecials() {
  const reps16 = repetitionDefinitions.find(({ reps }) => reps === 16);
  const maximum = repetitionDefinitions.find(({ reps }) => reps === null);
  if (!reps16 || !maximum) throw new Error("Formats exceptionnels d'evaluation manquants.");
  return [
    { seriesCount: 2, repetition: reps16, rest: 90 },
    { seriesCount: 3, repetition: reps16, rest: 90 },
    { seriesCount: 1, repetition: maximum, rest: 30 },
  ];
}

function formatDuration(seconds) {
  if (seconds < 60) return `${seconds} s`;
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;

  return remainingSeconds === 0
    ? `${minutes} min`
    : `${minutes}.${String(remainingSeconds).padStart(2, "0")} min`;
}

function plural(count, singular, pluralValue) {
  return count === 1 ? singular : pluralValue;
}

function pad2(value) {
  return String(value).padStart(2, "0");
}

function range(start, end, step) {
  const values = [];
  for (let value = start; value <= end; value += step) {
    values.push(value);
  }
  return values;
}
