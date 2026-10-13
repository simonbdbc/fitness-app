#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import catalogSeed from "../src/features/catalog/data/catalogSeed.json" with {
  type: "json",
};
import {
  canonicalEquipment,
  equipmentOptionsForExercise,
} from "../src/features/catalog/services/equipmentRequirements.ts";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(scriptDir, "..");

loadLocalEnv();

const supabaseUrl = requiredEnv("EXPO_PUBLIC_SUPABASE_URL").replace(/\/$/, "");
const publishableKey = requiredEnv("EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY");
const targetHost = new URL(supabaseUrl).hostname;
const expectedProjectRef = process.env.SUPABASE_PROJECT_REF?.trim();
const pageSize = 1000;

if (
  expectedProjectRef &&
  targetHost !== `${expectedProjectRef}.supabase.co`
) {
  throw new Error(
    `Projet Supabase incorrect: ${targetHost}, attendu: ${expectedProjectRef}.supabase.co.`,
  );
}

if (process.env.CI && ["localhost", "127.0.0.1", "0.0.0.0"].includes(targetHost)) {
  throw new Error(`Le controle CI refuse la cible Supabase locale ${targetHost}.`);
}

console.log(`Supabase cible: ${targetHost}`);

const tableContracts = {
  catalog_pillars: contract(catalogSeed.pillars, "id"),
  catalog_impacts: contract(catalogSeed.impacts, "id"),
  catalog_families: contract(catalogSeed.families, "id"),
  catalog_types: contract(catalogSeed.types, "id"),
  catalog_muscle_groups: contract(catalogSeed.muscleGroups, "id"),
  catalog_equipment: contract(canonicalEquipment, "id"),
  catalog_exercises: contract(catalogSeed.exercises, "id"),
  catalog_exercise_muscle_groups: {
    expectedCount: catalogSeed.exercises.reduce(
      (total, exercise) => total + exercise.muscleGroupCodes.length,
      0,
    ),
    orderColumn: "exercise_id",
  },
  catalog_exercise_equipment_options: {
    expectedCount: catalogSeed.exercises.reduce(
      (total, exercise) => total + equipmentOptionsForExercise(exercise).length,
      0,
    ),
    orderColumn: "id",
  },
  catalog_exercise_equipment_option_items: {
    expectedCount: catalogSeed.exercises.reduce(
      (total, exercise) =>
        total +
        equipmentOptionsForExercise(exercise).reduce(
          (subtotal, option) => subtotal + option.equipmentCodes.length,
          0,
        ),
      0,
    ),
    orderColumn: "option_id",
  },
  catalog_series: contract(catalogSeed.series, "id"),
  catalog_repetitions: contract(catalogSeed.repetitions, "id"),
  catalog_rests: contract(catalogSeed.rests, "id"),
  catalog_intervals: contract(catalogSeed.intervals, "id"),
  catalog_formats: contract(catalogSeed.formats, "id"),
  catalog_session_templates: contract(catalogSeed.sessionTemplates, "id"),
  catalog_session_template_levels: {
    expectedCount: catalogSeed.sessionTemplateLevels.length,
    orderColumn: "session_template_id",
  },
};

const errors = [];
const snapshots = {};

for (const [tableName, tableContract] of Object.entries(tableContracts)) {
  const rows = await fetchAllRows(tableName, tableContract.orderColumn);
  snapshots[tableName] = rows;

  if (rows.length !== tableContract.expectedCount) {
    errors.push(
      `${tableName}: ${rows.length} ligne(s) distante(s), ${tableContract.expectedCount} attendue(s)`,
    );
  }

  if (tableContract.expectedCodes) {
    const remoteCodes = new Set(rows.map((row) => row.code));
    const missingCodes = tableContract.expectedCodes.filter(
      (code) => !remoteCodes.has(code),
    );

    if (missingCodes.length > 0) {
      errors.push(
        `${tableName}: codes seed manquants: ${missingCodes.slice(0, 10).join(", ")}`,
      );
    }
  }

  console.log(`${tableName}: ${rows.length}/${tableContract.expectedCount}`);
}

validateRelations(snapshots, errors);
validateEquipmentOptions(snapshots, errors);
validateSessionPhases(snapshots, errors);

if (errors.length > 0) {
  console.error("\nCatalogue Supabase non conforme au seed valide:");
  for (const error of errors) console.error(`- ${error}`);
  process.exit(1);
}

console.log("Catalogue Supabase conforme au seed valide.");

function contract(rows, orderColumn) {
  return {
    expectedCount: rows.length,
    expectedCodes: rows.map((row) => row.code),
    orderColumn,
  };
}

async function fetchAllRows(tableName, orderColumn) {
  const rows = [];

  for (let from = 0; ; from += pageSize) {
    const url = new URL(`${supabaseUrl}/rest/v1/${tableName}`);
    url.searchParams.set("select", "*");
    url.searchParams.set("order", `${orderColumn}.asc`);

    const response = await fetch(url, {
      headers: {
        apikey: publishableKey,
        Authorization: `Bearer ${publishableKey}`,
        Range: `${from}-${from + pageSize - 1}`,
      },
    });

    if (!response.ok && response.status !== 206) {
      const body = await response.text();
      throw new Error(`${tableName}: HTTP ${response.status}: ${body}`);
    }

    const page = await response.json();
    rows.push(...page);
    if (page.length < pageSize) break;
  }

  return rows;
}

function validateRelations(snapshot, relationErrors) {
  const idSets = Object.fromEntries(
    Object.entries(snapshot).map(([tableName, rows]) => [
      tableName,
      new Set(rows.flatMap((row) => (typeof row.id === "number" ? [row.id] : []))),
    ]),
  );

  const relations = [
    ["catalog_exercises", "pillar_id", "catalog_pillars"],
    ["catalog_exercises", "impact_id", "catalog_impacts"],
    ["catalog_exercises", "family_id", "catalog_families"],
    ["catalog_exercises", "type_id", "catalog_types"],
    ["catalog_exercises", "equipment_id", "catalog_equipment"],
    ["catalog_exercise_muscle_groups", "exercise_id", "catalog_exercises"],
    ["catalog_exercise_muscle_groups", "muscle_group_id", "catalog_muscle_groups"],
    ["catalog_exercise_equipment_options", "exercise_id", "catalog_exercises"],
    ["catalog_exercise_equipment_option_items", "option_id", "catalog_exercise_equipment_options"],
    ["catalog_exercise_equipment_option_items", "equipment_id", "catalog_equipment"],
    ["catalog_formats", "series_id", "catalog_series"],
    ["catalog_formats", "repetitions_id", "catalog_repetitions"],
    ["catalog_formats", "rest_id", "catalog_rests"],
    ["catalog_formats", "interval_id", "catalog_intervals"],
    ["catalog_session_templates", "exercise_id", "catalog_exercises"],
    ["catalog_session_template_levels", "session_template_id", "catalog_session_templates"],
  ];

  for (const [tableName, columnName, referencedTable] of relations) {
    const broken = snapshot[tableName].filter(
      (row) =>
        row[columnName] !== null &&
        !idSets[referencedTable].has(row[columnName]),
    );

    if (broken.length > 0) {
      relationErrors.push(
        `${tableName}.${columnName}: ${broken.length} reference(s) orpheline(s) vers ${referencedTable}`,
      );
    }
  }
}

function validateEquipmentOptions(snapshot, relationErrors) {
  const itemCounts = new Map();
  for (const item of snapshot.catalog_exercise_equipment_option_items) {
    itemCounts.set(item.option_id, (itemCounts.get(item.option_id) ?? 0) + 1);
  }
  const invalid = snapshot.catalog_exercise_equipment_options.filter((option) => {
    const count = itemCounts.get(option.id) ?? 0;
    return !["bodyweight", "equipment"].includes(option.kind) ||
      (option.kind === "bodyweight" ? count !== 0 : count === 0);
  });
  if (invalid.length > 0) {
    relationErrors.push(`${invalid.length} option(s) équipement distante(s) ont une forme invalide`);
  }
}

function validateSessionPhases(snapshot, relationErrors) {
  const exerciseCodeById = new Map(
    snapshot.catalog_exercises.map((exercise) => [exercise.id, exercise.code]),
  );
  const invalid = snapshot.catalog_session_templates.filter((template) => {
    const exerciseCode = exerciseCodeById.get(template.exercise_id);
    return template.phase !== expectedSessionPhase(exerciseCode);
  });
  if (invalid.length > 0) {
    relationErrors.push(`${invalid.length} template(s) de session ont une phase V3 incorrecte`);
  }
}

function expectedSessionPhase(exerciseCode) {
  if ([
    "proprioception-mobilite-epaules",
    "proprioception-mobilite-hanches",
    "proprioception-mobilite-poignets",
  ].includes(exerciseCode)) return "warmup";
  if ([
    "proprioception-mobilite-poignets-epaules-hanches",
    "renforcement-mobilite-colonne-douce",
  ].includes(exerciseCode)) return "cooldown";
  return "main";
}

function loadLocalEnv() {
  const envPath = path.join(projectRoot, ".env");
  if (!fs.existsSync(envPath)) return;

  for (const line of fs.readFileSync(envPath, "utf8").split(/\r?\n/)) {
    const match = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (!match || process.env[match[1]]) continue;
    process.env[match[1]] = match[2].trim().replace(/^['"]|['"]$/g, "");
  }
}

function requiredEnv(name) {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`${name} est requis pour auditer Supabase.`);
  return value;
}
