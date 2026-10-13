#!/usr/bin/env node

import {
  existsSync,
  mkdirSync,
  readFileSync,
  writeFileSync,
} from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { canonicalEquipment } from "../src/features/catalog/services/equipmentRequirements.ts";
import { generateBaseFormatSeedData } from "./generate-base-format-seed.mjs";
import { generateSnapshotSeedFiles } from "./update-catalog-seed-from-snapshot.mjs";

const scriptDir = dirname(fileURLToPath(import.meta.url));
const projectRoot = resolve(scriptDir, "..");
const checkOnly = process.argv.includes("--check");
const args = new Set(process.argv.slice(2));

if ([...args].some((arg) => arg !== "--check")) {
  throw new Error(
    "Usage: node scripts/generate-catalog-foundation-seed.mjs [--check]",
  );
}

const outputTargets = {
  sqliteSeed: resolve(
    projectRoot,
    "src/shared/db/seeds/catalog-foundation.sqlite.sql",
  ),
  catalogJsonSeed: resolve(
    projectRoot,
    "src/features/catalog/data/catalogSeed.json",
  ),
};

const foundation = {
  pillars: rows([
    ["warm-up", "Échauffement"],
    ["cardio", "Cardio"],
    ["strength", "Renforcement"],
    ["proprioception", "Proprioception"],
    ["flexibility", "Assouplissement"],
  ]),
  impacts: rows([
    ["faible", "Faible"],
    ["modere", "Modéré"],
    ["eleve", "Élevé"],
  ]),
  families: rows([
    ["corps-entier", "Corps entier"],
    ["haut-du-corps", "Haut du corps"],
    ["bas-du-corps", "Bas du corps"],
  ]),
  types: rows([
    ["echauffement", "Échauffement"],
    ["cardio", "Cardio"],
    ["gainage", "Gainage"],
    ["force", "Force"],
    ["endurance", "Endurance"],
    ["proprioception", "Proprioception"],
    ["assouplissement", "Assouplissement"],
  ]),
  muscleGroups: rows([
    ["abdos", "Abdos"],
    ["bras", "Bras"],
    ["dos", "Dos"],
    ["epaules", "Épaules"],
    ["fessiers", "Fessiers"],
    ["jambes", "Jambes"],
    ["pecs", "Pecs"],
  ]),
};

const formats = generateBaseFormatSeedData();
const seed = {
  ...foundation,
  equipment: canonicalEquipment,
  // Exercises and session templates are generated exclusively from
  // docs/bibliotheque by generate-exercise-library.mjs.
  exercises: [],
  series: formats.series,
  repetitions: formats.repetitions,
  rests: formats.rests,
  intervals: formats.intervals,
  formats: formats.formats,
  sessionTemplates: [],
  sessionTemplateLevels: [],
};

assertFoundation(seed);
const generated = generateSnapshotSeedFiles(seed);

if (checkOnly) {
  const staleFiles = Object.entries(outputTargets)
    .filter(
      ([targetKey, filePath]) =>
        !existsSync(filePath) ||
        readFileSync(filePath, "utf8") !== generated[targetKey],
    )
    .map(([, filePath]) => filePath);
  if (staleFiles.length > 0) {
    throw new Error(
      `Seed de structure catalogue non à jour:\n${staleFiles
        .map((filePath) => `- ${filePath}`)
        .join("\n")}`,
    );
  }
  console.log("Seed de structure catalogue à jour (sans exercice legacy). ");
} else {
  for (const [targetKey, filePath] of Object.entries(outputTargets)) {
    mkdirSync(dirname(filePath), { recursive: true });
    writeFileSync(filePath, generated[targetKey], "utf8");
    console.log(`Catalogue ${targetKey} généré: ${filePath}`);
  }
}

function rows(values) {
  return values.map(([code, label]) => ({ code, label }));
}

function assertFoundation(value) {
  const expected = {
    pillars: 5,
    impacts: 3,
    families: 3,
    types: 7,
    muscleGroups: 7,
    equipment: 25,
    series: 12,
    repetitions: 11,
    rests: 14,
    intervals: 14,
    formats: 2219,
  };
  for (const [key, count] of Object.entries(expected)) {
    if (value[key].length !== count) {
      throw new Error(`${key}: ${value[key].length} lignes, ${count} attendues.`);
    }
  }
  if (
    value.exercises.length !== 0 ||
    value.sessionTemplates.length !== 0 ||
    value.sessionTemplateLevels.length !== 0
  ) {
    throw new Error("Le seed de structure ne doit contenir aucun exercice.");
  }
}
