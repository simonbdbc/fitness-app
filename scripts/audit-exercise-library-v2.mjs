#!/usr/bin/env node

import { promises as fs } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const completeRoot = path.join(projectRoot, "docs", "bibliotheque");
const incompleteRoot = path.join(projectRoot, "docs", "bibliotheque-incomplete");
const auditPath = path.join(projectRoot, "docs", "audits", "bibliotheque-v2-audit.json");
const checkOnly = process.argv.includes("--check");
const unexpectedArguments = process.argv.slice(2).filter((value) => value !== "--check");

if (unexpectedArguments.length > 0) {
  throw new Error("Usage: node scripts/audit-exercise-library-v2.mjs [--check]");
}

const pillarSlugs = new Set([
  "warm-up",
  "cardio",
  "strength",
  "proprioception",
  "flexibility",
]);
const equipmentSlugs = new Set([
  "wall", "chair", "table", "countertop", "couch", "stair", "door", "towel",
  "rings", "pull-up-bar", "low-bar", "vertical-bar", "parallel-bars", "parallettes",
  "bench", "box", "step", "resistance-band", "jump-rope", "kettlebell",
  "rowing-machine", "treadmill", "exercise-mat", "stationary-bike", "no-equipment",
]);
const unclassifiedEquipmentSlug = "unclassified-equipment";
const translationPlaceholder = /Traduction française à réviser|^equipment:\s*"?(?:A evaluer|À évaluer)"?\s*$|^\s*-?\s*(?:À traduire|Traduction à faire)\.?\s*$/imu;
const equipmentEvidencePatterns = {
  wall: /Mur stable/iu,
  chair: /Chaise(?:s)? stable(?:s)?/iu,
  table: /Table stable/iu,
  countertop: /Plan de travail/iu,
  couch: /Canapé/iu,
  stair: /Marche stable|Escalier/iu,
  door: /Porte stable/iu,
  towel: /Serviette|drap solide/iu,
  rings: /Anneaux/iu,
  "pull-up-bar": /Barre de traction/iu,
  "low-bar": /Barre basse/iu,
  "vertical-bar": /Barre verticale/iu,
  "parallel-bars": /Barres parallèles/iu,
  parallettes: /Parallettes/iu,
  bench: /Banc stable|Banc romain|GHD/iu,
  box: /Box ou plateforme|caisson/iu,
  step: /Marche ou step|Step stable/iu,
  "resistance-band": /Élastique/iu,
  "jump-rope": /Corde à sauter/iu,
  kettlebell: /Kettlebell/iu,
  "rowing-machine": /Rameur/iu,
  treadmill: /Tapis de course/iu,
  "exercise-mat": /Tapis de sol/iu,
  "stationary-bike": /Vélo/iu,
  "no-equipment": /Aucun matériel requis/iu,
};

const records = [
  ...(await discover(completeRoot, "complete")),
  ...(await discover(incompleteRoot, "incomplete")),
].sort((left, right) => left.slug.localeCompare(right.slug, "en"));

assertUniqueSlugs(records);
const audit = renderAudit(records);

if (checkOnly) {
  const current = await fs.readFile(auditPath, "utf8");
  if (current !== audit) {
    throw new Error(`${relative(auditPath)} is stale; run pnpm library:v2:audit.`);
  }
} else {
  await fs.writeFile(auditPath, audit);
}

const completeCount = records.filter((record) => record.libraryStatus === "complete").length;
const incompleteCount = records.length - completeCount;
console.log(
  `[exercise-library-v2] ${checkOnly ? "checked" : "audited"} ${completeCount} complete and ${incompleteCount} incomplete exercises.`,
);

async function discover(root, libraryStatus) {
  const records = [];
  for (const pillarEntry of await directoryEntries(root)) {
    if (!pillarSlugs.has(pillarEntry.name)) {
      throw new Error(`${relative(path.join(root, pillarEntry.name))}: invalid pillar slug.`);
    }
    const pillarDirectory = path.join(root, pillarEntry.name);
    for (const equipmentEntry of await directoryEntries(pillarDirectory)) {
      const allowedEquipment = libraryStatus === "incomplete"
        ? equipmentEntry.name === unclassifiedEquipmentSlug || equipmentSlugs.has(equipmentEntry.name)
        : equipmentSlugs.has(equipmentEntry.name);
      if (!allowedEquipment) {
        throw new Error(`${relative(path.join(pillarDirectory, equipmentEntry.name))}: invalid equipment slug.`);
      }
      const equipmentDirectory = path.join(pillarDirectory, equipmentEntry.name);
      for (const exerciseEntry of await directoryEntries(equipmentDirectory)) {
        const directory = path.join(equipmentDirectory, exerciseEntry.name);
        records.push(await readExercise({
          directory,
          slug: exerciseEntry.name,
          pillarSlug: pillarEntry.name,
          equipmentSlug: equipmentEntry.name,
          libraryStatus,
        }));
      }
    }
  }
  return records;
}

async function readExercise(record) {
  const expectedNames = new Set([
    `${record.slug}-en.md`,
    `${record.slug}-fr.md`,
    `${record.slug}-poster.webp`,
    `${record.slug}-animate.webp`,
  ]);
  const names = (await fs.readdir(record.directory)).sort();
  const unexpected = names.filter((name) => !expectedNames.has(name));
  if (unexpected.length > 0) {
    throw new Error(`${relative(record.directory)}: unexpected files ${unexpected.join(", ")}.`);
  }

  const paths = {
    en: path.join(record.directory, `${record.slug}-en.md`),
    fr: path.join(record.directory, `${record.slug}-fr.md`),
    poster: path.join(record.directory, `${record.slug}-poster.webp`),
    animation: path.join(record.directory, `${record.slug}-animate.webp`),
  };
  const present = Object.fromEntries(
    await Promise.all(Object.entries(paths).map(async ([key, value]) => [key, await exists(value)])),
  );
  if (!present.en && !present.fr) {
    throw new Error(`${relative(record.directory)}: no Markdown document.`);
  }
  if (record.libraryStatus === "complete" && Object.values(present).some((value) => !value)) {
    throw new Error(`${relative(record.directory)}: complete exercise must contain four files.`);
  }

  const documents = {};
  for (const locale of ["en", "fr"]) {
    if (!present[locale]) continue;
    const markdown = await fs.readFile(paths[locale], "utf8");
    const metadata = frontmatter(markdown, paths[locale]);
    assertMetadata(metadata, { ...record, locale }, paths[locale]);
    if (!/^## Codes$/mu.test(markdown)) {
      throw new Error(`${relative(paths[locale])}: Codes section missing.`);
    }
    documents[locale] = { markdown, metadata };
  }

  const reasons = [];
  if (!present.en) reasons.push("missing-en");
  if (!present.fr) reasons.push("missing-fr");
  if (documents.fr && translationPlaceholder.test(documents.fr.markdown)) {
    reasons.push("fr-translation-incomplete");
  } else if (
    documents.fr?.metadata.incompleteReasons?.includes("fr-translation-review-pending")
  ) {
    reasons.push("fr-translation-review-pending");
  }
  if (!present.poster) reasons.push("missing-poster");
  if (!present.animation) reasons.push("missing-animation");
  if (record.equipmentSlug === unclassifiedEquipmentSlug) {
    reasons.push("equipment-unclassified");
  }
  if (documents.fr && !validCatalogMetadata(documents.fr.metadata.catalog, record.pillarSlug)) {
    reasons.push("catalog-metadata-incomplete");
  }

  if (record.libraryStatus === "complete" && reasons.length > 0) {
    throw new Error(`${relative(record.directory)}: complete exercise has ${reasons.join(", ")}.`);
  }
  if (record.libraryStatus === "incomplete" && reasons.length === 0) {
    throw new Error(`${relative(record.directory)}: exercise is complete and must be promoted.`);
  }
  for (const document of Object.values(documents)) {
    const declaredReasons = Array.isArray(document.metadata.incompleteReasons)
      ? [...document.metadata.incompleteReasons]
      : [];
    if (!sameArray(declaredReasons, reasons)) {
      throw new Error(
        `${relative(record.directory)}: incompleteReasons mismatch (${declaredReasons.join(", ")} != ${reasons.join(", ")}).`,
      );
    }
  }

  const equipmentEvidence = documents.en
    ? sectionBody(documents.en.markdown, "Équipement requis vérifié")
    : "";
  if (
    equipmentEvidence
    && record.equipmentSlug !== unclassifiedEquipmentSlug
    && !equipmentEvidencePatterns[record.equipmentSlug]?.test(equipmentEvidence)
  ) {
    throw new Error(
      `${relative(paths.en)}: verified equipment does not support ${record.equipmentSlug}.`,
    );
  }

  return {
    ...record,
    reasons,
    classificationRule:
      documents.fr?.metadata.classificationRule
      ?? documents.en?.metadata.classificationRule
      ?? "missing",
    classificationReviewStatus:
      documents.fr?.metadata.classificationReviewStatus
      ?? documents.en?.metadata.classificationReviewStatus
      ?? "missing",
    equipmentEvidenceStatus:
      record.equipmentSlug === unclassifiedEquipmentSlug
        ? "unclassified"
        : equipmentEvidence
          ? "supported"
          : "missing",
  };
}

function assertMetadata(metadata, expected, filePath) {
  for (const [key, value] of Object.entries({
    slug: expected.slug,
    locale: expected.locale,
    pillarSlug: expected.pillarSlug,
    equipmentSlug: expected.equipmentSlug,
    libraryStatus: expected.libraryStatus,
  })) {
    if (metadata[key] !== value) {
      throw new Error(`${relative(filePath)}: ${key}=${metadata[key]} instead of ${value}.`);
    }
  }
  if (!metadata.classificationRule || !metadata.classificationReviewStatus) {
    throw new Error(`${relative(filePath)}: classification metadata missing.`);
  }
  if (metadata.classificationReviewStatus !== "valide") {
    throw new Error(`${relative(filePath)}: classification must be reviewed and valid.`);
  }
}

function validCatalogMetadata(catalog, pillarSlug) {
  return Boolean(
    catalog
    && catalog.pillarSlug === pillarSlug
    && Number.isInteger(catalog.difficulty)
    && catalog.difficulty >= 1
    && catalog.difficulty <= 10
    && typeof catalog.impactSlug === "string"
    && typeof catalog.familySlug === "string"
    && typeof catalog.typeSlug === "string"
    && Array.isArray(catalog.muscleGroupSlugs)
    && catalog.muscleGroupSlugs.length > 0
    && typeof catalog.reviewStatus === "string"
    && typeof catalog.translationStatus === "string"
    && typeof catalog.programmingStatus === "string"
  );
}

function assertUniqueSlugs(values) {
  const seen = new Set();
  for (const value of values) {
    if (seen.has(value.slug)) throw new Error(`Duplicate exercise slug: ${value.slug}.`);
    seen.add(value.slug);
  }
}

function renderAudit(values) {
  const countsByPillar = Object.fromEntries(
    [...pillarSlugs].map((pillarSlug) => [pillarSlug, { complete: 0, incomplete: 0 }]),
  );
  const incompleteReasons = {};
  const classificationRules = {};
  const classificationReviewStatuses = {};
  const equipmentEvidenceStatuses = {};
  for (const value of values) {
    countsByPillar[value.pillarSlug][value.libraryStatus] += 1;
    classificationRules[value.classificationRule] =
      (classificationRules[value.classificationRule] ?? 0) + 1;
    classificationReviewStatuses[value.classificationReviewStatus] =
      (classificationReviewStatuses[value.classificationReviewStatus] ?? 0) + 1;
    equipmentEvidenceStatuses[value.equipmentEvidenceStatus] =
      (equipmentEvidenceStatuses[value.equipmentEvidenceStatus] ?? 0) + 1;
    for (const reason of value.reasons) {
      incompleteReasons[reason] = (incompleteReasons[reason] ?? 0) + 1;
    }
  }
  const completeExercises = values.filter((value) => value.libraryStatus === "complete").length;
  const incomplete = values.filter((value) => value.libraryStatus === "incomplete");
  return `${JSON.stringify({
    schemaVersion: 2,
    generatedAt: "2026-08-11T00:00:00.000Z",
    source: {
      architecture: "exercise-library-v2",
      uniqueSlugs: values.length,
    },
    output: {
      completeExercises,
      incompleteExercises: incomplete.length,
      totalExercises: values.length,
    },
    countsByPillar,
    classificationRules: sortedObject(classificationRules),
    classificationReviewStatuses: sortedObject(classificationReviewStatuses),
    equipmentEvidenceStatuses: sortedObject(equipmentEvidenceStatuses),
    incompleteReasons: sortedObject(incompleteReasons),
    incomplete: incomplete.map((value) => ({
      slug: value.slug,
      pillarSlug: value.pillarSlug,
      equipmentSlug: value.equipmentSlug,
      reasons: value.reasons,
    })),
  }, null, 2)}\n`;
}

function sectionBody(markdown, heading) {
  const match = markdown.match(
    new RegExp(`^## ${heading}\\s*\\r?\\n([\\s\\S]*?)(?=^## |(?![\\s\\S]))`, "mu"),
  );
  return match?.[1]?.trim() ?? "";
}

function frontmatter(markdown, filePath) {
  const match = markdown.match(/^---\r?\n([\s\S]*?)\r?\n---/u);
  if (!match) throw new Error(`${relative(filePath)}: frontmatter missing.`);
  const metadata = {};
  let activeList = null;
  let activeObject = null;
  for (const line of match[1].split(/\r?\n/u)) {
    const scalar = line.match(/^([A-Za-z][A-Za-z0-9]*):\s*(.*)$/u);
    if (scalar) {
      const [, key, raw] = scalar;
      if (raw === "") {
        metadata[key] = key === "catalog" ? {} : [];
        activeObject = key === "catalog" ? metadata[key] : null;
        activeList = key === "catalog" ? null : metadata[key];
      } else {
        metadata[key] = scalarValue(raw);
        activeObject = null;
        activeList = null;
      }
      continue;
    }
    const nestedScalar = line.match(/^  ([A-Za-z][A-Za-z0-9]*):\s*(.*)$/u);
    if (nestedScalar && activeObject) {
      const [, key, raw] = nestedScalar;
      activeObject[key] = raw === "" ? [] : scalarValue(raw);
      activeList = raw === "" ? activeObject[key] : null;
      continue;
    }
    const nestedItem = line.match(/^    -\s+(.+)$/u);
    if (nestedItem && activeList) {
      activeList.push(scalarValue(nestedItem[1]));
      continue;
    }
    const item = line.match(/^  -\s+(.+)$/u);
    if (item && activeList) activeList.push(scalarValue(item[1]));
  }
  return metadata;
}

function scalarValue(raw) {
  const value = raw.trim().replace(/^"([\s\S]*)"$/u, "$1");
  if (/^\d+$/u.test(value)) return Number(value);
  if (value === "true") return true;
  if (value === "false") return false;
  return value;
}

function sameArray(left, right) {
  return left.length === right.length && left.every((value, index) => value === right[index]);
}

function sortedObject(value) {
  return Object.fromEntries(Object.entries(value).sort(([left], [right]) => left.localeCompare(right, "en")));
}

async function directoryEntries(directory) {
  if (directory === incompleteRoot && !await exists(directory)) return [];
  return (await fs.readdir(directory, { withFileTypes: true }))
    .filter((entry) => entry.isDirectory())
    .sort((left, right) => left.name.localeCompare(right.name, "en"));
}

async function exists(value) {
  try {
    await fs.access(value);
    return true;
  } catch {
    return false;
  }
}

function relative(value) {
  return path.relative(projectRoot, value).split(path.sep).join("/");
}
