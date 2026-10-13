#!/usr/bin/env node

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const scriptDir = dirname(fileURLToPath(import.meta.url));
const projectRoot = resolve(scriptDir, "..");

const outputTargets = {
  catalogJsonSeed: resolve(
    projectRoot,
    "src",
    "features",
    "catalog",
    "data",
    "catalogSeed.json",
  ),
  sqliteSeed: resolve(
    projectRoot,
    "src",
    "shared",
    "db",
    "seeds",
    "catalog-foundation.sqlite.sql",
  ),
};

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main();
}

export function generateSnapshotSeedFiles(seed) {
  assertSeed(seed);

  return {
    catalogJsonSeed: generateCatalogJsonSeed(seed),
    sqliteSeed: generateSeedSql("sqlite", seed),
  };
}

function main() {
  const args = process.argv.slice(2);
  const checkOnly = args.includes("--check");
  const inputIndex = args.indexOf("--input");
  const inputPath = inputIndex >= 0 ? args[inputIndex + 1] : null;
  const allowedArgs = new Set(
    ["--check", "--input", inputPath].filter(Boolean),
  );

  if (!inputPath || args.some((arg) => !allowedArgs.has(arg))) {
    throw new Error(
      "Usage: node scripts/update-catalog-seed-from-snapshot.mjs --input <snapshot.json> [--check]",
    );
  }

  const seed = JSON.parse(readFileSync(resolve(inputPath), "utf8"));
  const generated = generateSnapshotSeedFiles(seed);

  if (checkOnly) {
    const staleFiles = Object.entries(outputTargets)
      .filter(
        ([targetKey, filePath]) => !fileMatches(filePath, generated[targetKey]),
      )
      .map(([, filePath]) => filePath);

    if (staleFiles.length > 0) {
      throw new Error(
        `Seeds non a jour depuis le snapshot:\n${staleFiles
          .map((filePath) => `- ${filePath}`)
          .join("\n")}`,
      );
    }

    console.log("Seeds a jour depuis le snapshot.");
  } else {
    for (const [targetKey, filePath] of Object.entries(outputTargets)) {
      mkdirSync(dirname(filePath), { recursive: true });
      writeFileSync(filePath, generated[targetKey], "utf8");
      console.log(`Seed ${targetKey} mis a jour: ${filePath}`);
    }
  }
}

function assertSeed(seed) {
  for (const key of [
    "pillars",
    "impacts",
    "families",
    "types",
    "muscleGroups",
    "equipment",
    "exercises",
    "series",
    "repetitions",
    "rests",
    "intervals",
    "formats",
    "sessionTemplates",
    "sessionTemplateLevels",
  ]) {
    if (!Array.isArray(seed[key])) {
      throw new Error(`Snapshot invalide: ${key} doit etre un tableau.`);
    }
  }

  if (
    seed.exercises.length > 0 ||
    seed.sessionTemplates.length > 0 ||
    seed.sessionTemplateLevels.length > 0
  ) {
    throw new Error(
      "Snapshot invalide: exercices et templates proviennent exclusivement de docs/bibliotheque.",
    );
  }

  const text = JSON.stringify(seed).toLowerCase();

  for (const forbidden of [
    "hiit",
    "callisthenie",
    '"temps"',
    '"intervalkind"',
    '"repetitionkind"',
    "maximum_reps",
    "controlled_reps",
    "hold_position",
  ]) {
    if (text.includes(forbidden)) {
      throw new Error(
        `Snapshot invalide: valeur legacy interdite ${forbidden}.`,
      );
    }
  }

  const maximumRepetitions = seed.repetitions.filter(
    (repetition) => repetition.reps === null,
  );
  if (maximumRepetitions.length !== 1) {
    throw new Error("Snapshot invalide: une repetition Maximum est requise.");
  }

  if (
    seed.intervals.some((interval) =>
      /^interval-(maximum|controlled|hold)-/.test(interval.code),
    )
  ) {
    throw new Error(
      "Snapshot invalide: ancien code d'intervalle type interdit.",
    );
  }

  for (const exercise of seed.exercises) {
    for (const key of [
      "code",
      "label",
      "pillarCode",
      "impactCode",
      "familyCode",
      "typeCode",
      "equipmentCode",
    ]) {
      if (!exercise[key]) {
        throw new Error(
          `Exercice invalide ${exercise.code ?? ""}: ${key} manquant.`,
        );
      }
    }

    if (
      !Array.isArray(exercise.muscleGroupCodes) ||
      exercise.muscleGroupCodes.length === 0
    ) {
      throw new Error(
        `Exercice invalide ${exercise.code}: groupe musculaire manquant.`,
      );
    }
  }

  const exerciseCodes = new Set(
    seed.exercises.map((exercise) => exercise.code),
  );
  const sessionCodes = new Set(
    seed.sessionTemplates.map((session) => session.code),
  );

  for (const format of seed.formats) {
    const isRepetitions = format.formatType === "repetitions";
    if (
      !format.seriesCode ||
      !format.restCode ||
      (isRepetitions && (!format.repetitionsCode || format.intervalCode)) ||
      (!isRepetitions && (!format.intervalCode || format.repetitionsCode))
    ) {
      throw new Error(`Format invalide: ${format.code ?? "code manquant"}.`);
    }

    for (const forbiddenColumn of [
      "seriesCount",
      "executionCount",
      "restSeriesSeconds",
      "seriesDurationSeconds",
      "executionDurationSeconds",
      "restExecutionSeconds",
    ]) {
      if (forbiddenColumn in format) {
        throw new Error(
          `Format invalide ${format.code}: champ derive interdit ${forbiddenColumn}.`,
        );
      }
    }
  }

  for (const session of seed.sessionTemplates) {
    if (
      !session.code ||
      !session.title ||
      !exerciseCodes.has(session.exerciseCode)
    ) {
      throw new Error(
        `Template de session invalide: ${session.code ?? "code manquant"}.`,
      );
    }
  }

  for (const link of seed.sessionTemplateLevels) {
    if (
      !sessionCodes.has(link.sessionTemplateCode) ||
      !Number.isInteger(link.level) ||
      link.level < 1 ||
      link.level > 10
    ) {
      throw new Error(
        `Niveau de template de session invalide: ${link.sessionTemplateCode ?? "code manquant"}.`,
      );
    }
  }
}

function generateCatalogJsonSeed(seed) {
  return `${JSON.stringify(seed, null, 2)}\n`;
}

function generateSeedSql(dialect, seed) {
  const prefix = dialect === "psql" ? "public." : "";
  const table = (tableName) => `${prefix}${tableName}`;
  const statements = [];

  if (dialect === "sqlite") {
    statements.push("PRAGMA foreign_keys = ON;");
  }

  statements.push("begin;");
  statements.push(upsertSimple(table("catalog_pillars"), seed.pillars));
  statements.push(upsertSimple(table("catalog_impacts"), seed.impacts));
  statements.push(upsertSimple(table("catalog_families"), seed.families));
  statements.push(upsertSimple(table("catalog_types"), seed.types));
  statements.push(
    upsertSimple(table("catalog_muscle_groups"), seed.muscleGroups),
  );
  statements.push(upsertSimple(table("catalog_equipment"), seed.equipment));
  statements.push(upsertSeries(table("catalog_series"), seed.series));
  statements.push(
    upsertRepetitions(table("catalog_repetitions"), seed.repetitions),
  );
  statements.push(upsertRests(table("catalog_rests"), seed.rests));
  statements.push(upsertIntervals(table("catalog_intervals"), seed.intervals));
  statements.push(upsertFormats(table, seed.formats, dialect));
  statements.push(
    "-- Exercices, muscles et templates: geres uniquement par la bibliotheque FR.",
  );
  statements.push("commit;");

  return [
    "-- ACREA Fitness - seed structurel depuis snapshot SQLite local/dev",
    `-- Dialecte: ${dialect}`,
    `-- catalog_exercises: ${seed.exercises.length}`,
    `-- catalog_formats: ${seed.formats.length}`,
    "",
    statements.join("\n\n"),
    "",
  ].join("\n");
}

function upsertSimple(tableName, rows) {
  return [
    `insert into ${tableName} (code, label)`,
    "values",
    rows
      .map((row) => `  (${quote(row.code)}, ${quote(row.label)})`)
      .join(",\n"),
    "on conflict (code) do update set",
    "  label = excluded.label;",
  ].join("\n");
}

function upsertSeries(tableName, rows) {
  return upsertRows(
    tableName,
    ["code", "label", "series", "updated_at"],
    rows,
    (row) => [row.code, row.label, row.series, row.updatedAt],
  );
}

function upsertRepetitions(tableName, rows) {
  return upsertRows(
    tableName,
    ["code", "label", "reps", "updated_at"],
    rows,
    (row) => [row.code, row.label, row.reps, row.updatedAt],
  );
}

function upsertRests(tableName, rows) {
  return upsertRows(
    tableName,
    ["code", "label", "rest_seconds", "updated_at"],
    rows,
    (row) => [row.code, row.label, row.restSeconds, row.updatedAt],
  );
}

function upsertIntervals(tableName, rows) {
  return upsertRows(
    tableName,
    ["code", "label", "effort_seconds", "updated_at"],
    rows,
    (row) => [row.code, row.label, row.effortSeconds, row.updatedAt],
  );
}

function upsertRows(tableName, columns, rows, valuesFromRow) {
  if (rows.length === 0) {
    return `-- ${tableName}: aucun seed`;
  }

  return [
    `insert into ${tableName} (${columns.join(", ")})`,
    "values",
    rows
      .map((row) => `  (${valuesFromRow(row).map(sqlValue).join(", ")})`)
      .join(",\n"),
    "on conflict (code) do update set",
    columns
      .filter((column) => column !== "code")
      .map((column) => `  ${column} = excluded.${column}`)
      .join(",\n") + ";",
  ].join("\n");
}

function upsertFormats(table, rows, dialect) {
  if (rows.length === 0) {
    return "-- catalog_formats: aucun seed";
  }

  const columns = [
    "code",
    "format_type",
    "series_code",
    "repetitions_code",
    "rest_code",
    "interval_code",
    "label",
    "description",
    "source_status",
    "updated_at",
  ];

  return [
    `with seed (${columns.join(", ")}) as (`,
    "  values",
    rows
      .map((row) => {
        const values = [
          row.code,
          row.formatType,
          row.seriesCode,
          row.repetitionsCode,
          row.restCode,
          row.intervalCode,
          row.label,
          row.description,
          row.sourceStatus,
        ];

        const updatedAt =
          dialect === "psql"
            ? `${quote(row.updatedAt)}::timestamptz`
            : sqlValue(row.updatedAt);

        return `    (${values.map(sqlValue).join(", ")}, ${updatedAt})`;
      })
      .join(",\n"),
    ")",
    `insert into ${table("catalog_formats")} (`,
    "  code, format_type, series_id, repetitions_id, rest_id, interval_id,",
    "  label, description, source_status, updated_at",
    ")",
    "select",
    "  seed.code, seed.format_type, series.id, repetitions.id, rests.id, intervals.id,",
    "  seed.label, seed.description, seed.source_status, seed.updated_at",
    "from seed",
    `join ${table("catalog_series")} series on series.code = seed.series_code`,
    `left join ${table("catalog_repetitions")} repetitions on repetitions.code = seed.repetitions_code`,
    `join ${table("catalog_rests")} rests on rests.code = seed.rest_code`,
    `left join ${table("catalog_intervals")} intervals on intervals.code = seed.interval_code`,
    "on conflict (code) do update set",
    "  format_type = excluded.format_type,",
    "  series_id = excluded.series_id,",
    "  repetitions_id = excluded.repetitions_id,",
    "  rest_id = excluded.rest_id,",
    "  interval_id = excluded.interval_id,",
    "  label = excluded.label,",
    "  description = excluded.description,",
    "  source_status = excluded.source_status,",
    "  updated_at = excluded.updated_at;",
  ].join("\n");
}

function upsertSessionTemplates(table, rows, dialect) {
  if (rows.length === 0) {
    return "-- catalog_session_templates: aucun seed";
  }

  return [
    "with seed (code, title, description, exercise_code, is_active, source_status, updated_at) as (",
    "  values",
    rows
      .map((row) => {
        const isActive =
          dialect === "psql" ? String(row.isActive) : row.isActive ? "1" : "0";
        const updatedAt =
          dialect === "psql"
            ? `${quote(row.updatedAt)}::timestamptz`
            : quote(row.updatedAt);

        return `    (${quote(row.code)}, ${quote(row.title)}, ${quote(row.description)}, ${quote(row.exerciseCode)}, ${isActive}, ${quote(row.sourceStatus)}, ${updatedAt})`;
      })
      .join(",\n"),
    ")",
    `insert into ${table("catalog_session_templates")} (code, title, description, exercise_id, is_active, source_status, updated_at)`,
    "select seed.code, seed.title, seed.description, exercise.id, seed.is_active, seed.source_status, seed.updated_at",
    "from seed",
    `join ${table("catalog_exercises")} exercise on exercise.code = seed.exercise_code`,
    "on conflict (code) do update set",
    "  title = excluded.title,",
    "  description = excluded.description,",
    "  exercise_id = excluded.exercise_id,",
    "  is_active = excluded.is_active,",
    "  source_status = excluded.source_status,",
    "  updated_at = excluded.updated_at;",
  ].join("\n");
}

function replaceSessionTemplateLevels(table, rows, dialect) {
  if (rows.length === 0) {
    return "-- catalog_session_template_levels: aucun seed";
  }

  return [
    "with seed (session_template_code, level, updated_at) as (",
    "  values",
    rows
      .map((row) => {
        const updatedAt =
          dialect === "psql"
            ? `${quote(row.updatedAt)}::timestamptz`
            : quote(row.updatedAt);

        return `    (${quote(row.sessionTemplateCode)}, ${sqlValue(row.level)}, ${updatedAt})`;
      })
      .join(",\n"),
    ")",
    `insert into ${table("catalog_session_template_levels")} (session_template_id, level, updated_at)`,
    "select session.id, seed.level, seed.updated_at",
    "from seed",
    `join ${table("catalog_session_templates")} session on session.code = seed.session_template_code`,
    "on conflict (session_template_id, level) do update set",
    "  updated_at = excluded.updated_at;",
  ].join("\n");
}

function upsertExercises(table, exercises) {
  if (exercises.length === 0) {
    return "-- catalog_exercises: aucun seed";
  }

  const columns = [
    "code",
    "label",
    "pillar_code",
    "difficulty",
    "impact_code",
    "family_code",
    "type_code",
    "equipment_code",
    "movement_description",
    "start_position",
    "outbound_execution",
    "return_execution",
    "adapted_version",
    "tips",
    "errors",
  ];

  return [
    `with seed (${columns.join(", ")}) as (`,
    "  values",
    exercises
      .map((exercise) => {
        const values = [
          exercise.code,
          exercise.label,
          exercise.pillarCode,
          exercise.difficulty,
          exercise.impactCode,
          exercise.familyCode,
          exercise.typeCode,
          exercise.equipmentCode,
          exercise.movementDescription,
          exercise.startPosition,
          exercise.outboundExecution,
          exercise.returnExecution,
          exercise.adaptedVersion,
          exercise.tips,
          exercise.errors,
        ];

        return `    (${values.map(sqlValue).join(", ")})`;
      })
      .join(",\n"),
    ")",
    `insert into ${table("catalog_exercises")} (`,
    "  code, label, pillar_id, difficulty, impact_id, family_id, type_id, equipment_id,",
    "  movement_description, start_position, outbound_execution, return_execution,",
    "  adapted_version, tips, errors",
    ")",
    "select",
    "  seed.code, seed.label, pillar.id, seed.difficulty, impact.id, family.id, catalog_type.id, equipment.id,",
    "  seed.movement_description, seed.start_position, seed.outbound_execution, seed.return_execution,",
    "  seed.adapted_version, seed.tips, seed.errors",
    "from seed",
    `join ${table("catalog_pillars")} pillar on pillar.code = seed.pillar_code`,
    `join ${table("catalog_impacts")} impact on impact.code = seed.impact_code`,
    `join ${table("catalog_families")} family on family.code = seed.family_code`,
    `join ${table("catalog_types")} catalog_type on catalog_type.code = seed.type_code`,
    `join ${table("catalog_equipment")} equipment on equipment.code = seed.equipment_code`,
    "on conflict (code) do update set",
    "  label = excluded.label,",
    "  pillar_id = excluded.pillar_id,",
    "  difficulty = excluded.difficulty,",
    "  impact_id = excluded.impact_id,",
    "  family_id = excluded.family_id,",
    "  type_id = excluded.type_id,",
    "  equipment_id = excluded.equipment_id,",
    "  movement_description = excluded.movement_description,",
    "  start_position = excluded.start_position,",
    "  outbound_execution = excluded.outbound_execution,",
    "  return_execution = excluded.return_execution,",
    "  adapted_version = excluded.adapted_version,",
    "  tips = excluded.tips,",
    "  errors = excluded.errors;",
  ].join("\n");
}

function insertMuscleLinks(table, exercises) {
  const links = exercises.flatMap((exercise) =>
    exercise.muscleGroupCodes.map((muscleGroupCode) => ({
      exerciseCode: exercise.code,
      muscleGroupCode,
    })),
  );

  if (links.length === 0) {
    return "-- catalog_exercise_muscle_groups: aucun lien";
  }

  return [
    "with seed (exercise_code, muscle_group_code) as (",
    "  values",
    links
      .map(
        (link) =>
          `    (${quote(link.exerciseCode)}, ${quote(link.muscleGroupCode)})`,
      )
      .join(",\n"),
    ")",
    `insert into ${table("catalog_exercise_muscle_groups")} (exercise_id, muscle_group_id)`,
    "select exercise.id, muscle_group.id",
    "from seed",
    `join ${table("catalog_exercises")} exercise on exercise.code = seed.exercise_code`,
    `join ${table("catalog_muscle_groups")} muscle_group on muscle_group.code = seed.muscle_group_code`,
    "on conflict (exercise_id, muscle_group_id) do nothing;",
  ].join("\n");
}

function updateExerciseReferences(table, exercises, columnName, propertyName) {
  const rows = exercises.filter((exercise) => exercise[propertyName]);

  if (rows.length === 0) {
    return `-- ${columnName}: aucun lien`;
  }

  return [
    "with seed (exercise_code, linked_code) as (",
    "  values",
    rows
      .map(
        (exercise) =>
          `    (${quote(exercise.code)}, ${quote(exercise[propertyName])})`,
      )
      .join(",\n"),
    ")",
    `update ${table("catalog_exercises")} exercise`,
    `set ${columnName} = linked.id`,
    `from ${table("catalog_exercises")} linked, seed`,
    "where exercise.code = seed.exercise_code",
    "  and linked.code = seed.linked_code;",
  ].join("\n");
}

function fileMatches(filePath, content) {
  return existsSync(filePath) && readFileSync(filePath, "utf8") === content;
}

function sqlValue(value) {
  if (value === null || value === undefined) {
    return "null";
  }

  if (typeof value === "number") {
    return Number.isFinite(value) ? String(value) : "null";
  }

  return quote(value);
}

function quote(value) {
  return `'${String(value).replaceAll("'", "''")}'`;
}
