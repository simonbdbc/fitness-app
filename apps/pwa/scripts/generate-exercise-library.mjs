import { promises as fs } from "fs";
import { createHash } from "crypto";
import path from "path";
import { fileURLToPath } from "url";

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(scriptDirectory, "../../..");
const libraryRoot = path.join(projectRoot, "docs", "bibliotheque");
const auditPath = path.join(projectRoot, "docs", "audits", "bibliotheque-v2-audit.json");
const dataDirectory = path.join(projectRoot, "apps/pwa/src/features/catalog/data");
const outputJsonPath = path.join(dataDirectory, "exerciseLibrary.json");
const outputAssetsPath = path.join(dataDirectory, "exerciseLibraryAssets.ts");
const checkOnly = process.argv.includes("--check");
const updatedAt = "2026-08-12T00:00:00.000Z";
const releaseCode = "exercise-library-v2";
const programmingPillars = new Set(["strength", "cardio", "proprioception"]);

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});

async function main() {
  const audit = JSON.parse(await fs.readFile(auditPath, "utf8"));
  const expectedExerciseCount = audit.output?.completeExercises;
  if (audit.schemaVersion !== 2 || !Number.isInteger(expectedExerciseCount)) {
    throw new Error(`${relative(auditPath)}: invalid V2 audit.`);
  }
  const exercises = [];
  for (const exercise of await discoverExercises()) {
    const markdown = await fs.readFile(exercise.markdownPath, "utf8");
    const metadata = parseMetadata(markdown, exercise.markdownPath);
    assertIdentity(metadata, exercise);
    const poster = await inspectWebP(path.join(exercise.directory, `${exercise.slug}-poster.webp`));
    const animation = await inspectWebP(path.join(exercise.directory, `${exercise.slug}-animate.webp`));
    if (!poster.isWebP || poster.isAnimated || poster.width !== 360 || poster.height !== 360 || poster.frameCount !== 1) {
      throw new Error(`${relative(exercise.directory)}: static 360x360 poster is required.`);
    }
    if (!animation.isWebP || !animation.isAnimated || animation.width !== 360 || animation.height !== 360 || animation.frameCount < 2) {
      throw new Error(`${relative(exercise.directory)}: animated 360x360 animation is required.`);
    }
    const instructions = listItems(section(markdown, "Instructions", exercise.markdownPath));
    const description = plainText(section(markdown, "Description", exercise.markdownPath));
    const benefits = listItems(section(markdown, "Bénéfices", exercise.markdownPath));
    const variations = listItems(section(markdown, "Variantes et alternatives", exercise.markdownPath));
    const errors = listItems(optionalSection(markdown, "Points de vigilance"));
    const execution = splitExecution(instructions);
    exercises.push({
      slug: metadata.slug,
      labelFr: metadata.labelFr,
      labelEn: metadata.labelEn,
      categorySlug: metadata.categorySlug,
      equipmentSlug: metadata.equipmentSlug,
      pillarSlug: metadata.catalog.pillarSlug,
      difficulty: metadata.catalog.difficulty,
      impactSlug: metadata.catalog.impactSlug,
      familySlug: metadata.catalog.familySlug,
      typeSlug: metadata.catalog.typeSlug,
      muscleGroupSlugs: metadata.catalog.muscleGroupSlugs,
      programmingStatus: metadata.catalog.programmingStatus,
      movementDescription: description,
      startPosition: execution.start.join("\n"),
      outboundExecution: execution.outbound.join("\n"),
      returnExecution: execution.return.join("\n"),
      adaptedVersion: variations.join("\n"),
      tips: benefits.join("\n"),
      errors: errors.join("\n"),
      isActive: true,
      reviewStatus: metadata.catalog.reviewStatus,
      translationStatus: metadata.catalog.translationStatus,
      media: [
        mediaEntry("poster", exercise, poster),
        mediaEntry("animation", exercise, animation),
      ],
    });
  }
  exercises.sort((left, right) => left.slug.localeCompare(right.slug, "en"));
  if (
    exercises.length !== expectedExerciseCount
    || new Set(exercises.map((exercise) => exercise.slug)).size !== expectedExerciseCount
  ) {
    throw new Error(`Expected ${expectedExerciseCount} unique complete exercises, received ${exercises.length}.`);
  }
  const sessionTemplates = buildBetaSessionTemplates(exercises);
  const revision = createHash("sha256")
    .update(JSON.stringify({ exercises, sessionTemplates }))
    .digest("hex")
    .slice(0, 16);
  const artifact = {
    schemaVersion: 2,
    release: { code: releaseCode, locale: "fr", expectedExerciseCount, status: "active" },
    revision,
    summary: {
      exerciseCount: exercises.length,
      posters: exercises.length,
      animations: exercises.length,
      templateCount: sessionTemplates.length,
      sessionTemplateLevelCount: sessionTemplates.reduce(
        (count, template) => count + template.levels.length,
        0,
      ),
      excludedIncompleteDirectory: true,
    },
    exercises,
    sessionTemplates,
  };
  const json = `${JSON.stringify(artifact, null, 2)}\n`;
  const assets = renderAssets(exercises);
  if (checkOnly) {
    await assertCurrent(outputJsonPath, json);
    await assertCurrent(outputAssetsPath, assets);
  } else {
    await fs.writeFile(outputJsonPath, json);
    await fs.writeFile(outputAssetsPath, assets);
  }
  console.log(`[exercise-library] ${checkOnly ? "checked" : "generated"} ${exercises.length} qualified French exercises.`);
}

/**
 * Les niveaux de prescription ACREA ne sont pas la difficulté éditoriale
 * (1–10). Le protocole V4 positionne aujourd'hui un profil sur les niveaux
 * 1 à 3, puis le moteur gère la progression. Cette table conserve le moteur
 * inchangé tout en couvrant chaque niveau avec la difficulté documentée.
 */
function betaTemplateLevels(difficulty) {
  const levelsByDifficulty = {
    1: [1],
    2: [1, 2],
    3: [1, 2],
    4: [1, 2, 3],
    5: [2, 3, 4, 5],
    6: [4, 5, 6],
    7: [5, 6, 7, 8],
    8: [7, 8, 9],
    9: [9, 10],
    10: [10],
  };
  const levels = levelsByDifficulty[difficulty];
  if (!levels) throw new Error(`Unsupported catalog difficulty ${difficulty}.`);
  return levels;
}

function buildBetaSessionTemplates(exercises) {
  const templates = exercises
    .filter((exercise) => programmingPillars.has(exercise.pillarSlug))
    .map((exercise) => ({
      code: `beta-main-${exercise.slug}`,
      title: `${exercise.labelFr} — séance principale`,
      description: `Template beta généré depuis la fiche V2 validée de ${exercise.labelFr}.`,
      exerciseSlug: exercise.slug,
      phase: "main",
      isActive: true,
      sourceStatus: "beta v1.00 — bibliothèque V2 validée",
      updatedAt,
      levels: betaTemplateLevels(exercise.difficulty),
    }));

  const fixedPhaseExercise = exercises.find(
    (exercise) => exercise.slug === "lying-leg-raise" && exercise.pillarSlug === "proprioception",
  );
  if (!fixedPhaseExercise) {
    throw new Error("The V4 proprioception exercise lying-leg-raise is required for beta fixed phases.");
  }
  for (const [phase, title] of [
    ["warmup", "Préparation — Lying Leg Raise"],
    ["cooldown", "Retour au calme — Lying Leg Raise"],
  ]) {
    templates.push({
      code: `beta-${phase}-${fixedPhaseExercise.slug}`,
      title,
      description: `Template beta ${phase === "warmup" ? "de préparation" : "de retour au calme"} rattaché à la fiche V2 validée.`,
      exerciseSlug: fixedPhaseExercise.slug,
      phase,
      isActive: true,
      sourceStatus: "beta v1.00 — phases fixes validées",
      updatedAt,
      levels: [1],
    });
  }
  return templates;
}

async function discoverExercises() {
  const discovered = [];
  await visit(libraryRoot);
  return discovered;
  async function visit(directory) {
    const entries = await fs.readdir(directory, { withFileTypes: true });
    const slug = path.basename(directory);
    if (entries.some((entry) => entry.isFile() && entry.name === `${slug}-fr.md`)) {
      discovered.push({
        slug,
        directory,
        markdownPath: path.join(directory, `${slug}-fr.md`),
        categorySlug: path.basename(path.dirname(path.dirname(directory))),
        equipmentSlug: path.basename(path.dirname(directory)),
      });
      return;
    }
    for (const entry of entries) if (entry.isDirectory()) await visit(path.join(directory, entry.name));
  }
}

function parseMetadata(markdown, markdownPath) {
  const frontmatter = markdown.match(/^---\r?\n([\s\S]*?)\r?\n---/u)?.[1];
  if (!frontmatter) throw new Error(`${relative(markdownPath)}: frontmatter is missing.`);
  const scalar = (key) => frontmatter.match(new RegExp(`^\\s*${key}:\\s*(.+)$`, "m"))?.[1]?.trim().replace(/^"(.*)"$/, "$1");
  const number = (key) => Number(scalar(key));
  const muscleBlock = frontmatter.match(/^  muscleGroupSlugs:\r?\n((?:    - .+\r?\n?)+)/m)?.[1] ?? "";
  const muscleGroupSlugs = [...muscleBlock.matchAll(/^    - (.+)$/gm)].map((match) => match[1].trim());
  const result = {
    slug: scalar("slug"),
    labelFr: scalar("labelFr"),
    labelEn: scalar("labelEn"),
    categorySlug: scalar("pillarSlug"),
    equipmentSlug: scalar("equipmentSlug"),
    catalog: {
      pillarSlug: scalar("pillarSlug"),
      difficulty: number("difficulty"),
      impactSlug: scalar("impactSlug"),
      familySlug: scalar("familySlug"),
      typeSlug: scalar("typeSlug"),
      muscleGroupSlugs,
      reviewStatus: scalar("reviewStatus"),
      translationStatus: scalar("translationStatus"),
      programmingStatus: scalar("programmingStatus"),
    },
  };
  if (
    Object.values(result).some((value) => !value) ||
    Object.values(result.catalog).some((value) => !value) ||
    !Number.isInteger(result.catalog.difficulty) ||
    muscleGroupSlugs.length === 0
  ) {
    throw new Error(`${relative(markdownPath)}: incomplete canonical metadata.`);
  }
  if (!["a_verifier", "valide", "a_revoir"].includes(result.catalog.reviewStatus)) {
    throw new Error(`${relative(markdownPath)}: invalid reviewStatus.`);
  }
  if (!["source_only", "translated", "validated"].includes(result.catalog.translationStatus)) {
    throw new Error(`${relative(markdownPath)}: invalid translationStatus.`);
  }
  if (!["library_only", "eligible", "blocked"].includes(result.catalog.programmingStatus)) {
    throw new Error(`${relative(markdownPath)}: invalid programmingStatus.`);
  }
  return result;
}

function assertIdentity(metadata, exercise) {
  for (const [key, expected] of Object.entries({ slug: exercise.slug, categorySlug: exercise.categorySlug, equipmentSlug: exercise.equipmentSlug })) {
    if (metadata[key] !== expected) throw new Error(`${relative(exercise.markdownPath)}: ${key} must match its path.`);
  }
}

function section(markdown, heading, markdownPath) {
  const value = optionalSection(markdown, heading);
  if (!value) throw new Error(`${relative(markdownPath)}: section ${heading} is required.`);
  return value;
}

function optionalSection(markdown, heading) {
  const lines = markdown.split(/\r?\n/);
  const start = lines.findIndex((line) => line.trim() === `## ${heading}`);
  if (start === -1) return "";
  const end = lines.findIndex((line, index) => index > start && line.startsWith("## "));
  return lines.slice(start + 1, end === -1 ? undefined : end).join("\n").trim();
}

function plainText(value) {
  return value.replace(/!\[[^\]]*\]\([^)]+\)/g, "").replace(/\*\*/g, "").replace(/\s+/g, " ").trim();
}

function listItems(value) {
  const items = value.split(/\r?\n/)
    .map((line) => line.match(/^\s*(?:-+|\d+\.)\s+(.+)$/)?.[1]?.trim())
    .filter(Boolean);
  return items.length > 0 ? items : [plainText(value)].filter(Boolean);
}

function splitExecution(instructions) {
  const startCount = Math.max(1, Math.ceil(instructions.length / 3));
  const endCount = instructions.length - startCount > 1 ? 1 : 0;
  return {
    start: instructions.slice(0, startCount),
    outbound: instructions.slice(startCount, instructions.length - endCount),
    return: endCount ? instructions.slice(-endCount) : instructions.slice(-1),
  };
}

function mediaEntry(kind, exercise, inspection) {
  const fileName = `${exercise.slug}-${kind === "poster" ? "poster" : "animate"}.webp`;
  return {
    kind,
    uri: relative(path.join(exercise.directory, fileName)),
    fileName,
    mimeType: "image/webp",
    width: inspection.width,
    height: inspection.height,
    frameCount: inspection.frameCount,
    loopCount: kind === "animation" ? inspection.loopCount : null,
    sha256: inspection.sha256,
    status: "ready",
    updatedAt,
  };
}

function renderAssets(exercises) {
  const entries = exercises.map((exercise) => {
    const poster = assetPath(exercise.media[0].uri);
    const animation = assetPath(exercise.media[1].uri);
    return `  ${JSON.stringify(exercise.slug)}: {\n    animationSource: require(${JSON.stringify(animation)}),\n    posterSource: require(${JSON.stringify(poster)}),\n  },`;
  }).join("\n");
  return `// Generated by scripts/generate-exercise-library.mjs. Do not edit manually.\nimport type { ImageSourcePropType } from "react-native";\n\nexport type ExerciseLibraryMediaAssetSources = {\n  animationSource: ImageSourcePropType;\n  posterSource: ImageSourcePropType;\n};\n\nexport const exerciseLibraryMediaSources = {\n${entries}\n} as const satisfies Record<string, ExerciseLibraryMediaAssetSources>;\n`;
}

function assetPath(uri) {
  let value = path.relative(dataDirectory, path.join(projectRoot, uri)).split(path.sep).join("/");
  if (!value.startsWith(".")) value = `./${value}`;
  return value;
}

async function inspectWebP(filePath) {
  const buffer = await fs.readFile(filePath).catch(() => null);
  const invalid = { frameCount: 0, height: 0, isAnimated: false, isWebP: false, loopCount: null, sha256: null, width: 0 };
  if (!buffer || buffer.length < 20 || buffer.toString("ascii", 0, 4) !== "RIFF" || buffer.toString("ascii", 8, 12) !== "WEBP") return invalid;
  const declaredSize = buffer.readUInt32LE(4) + 8;
  if (declaredSize > buffer.length) return invalid;
  let dimensions = null;
  let frames = 0;
  let loopCount = null;
  let animated = false;
  for (let offset = 12; offset + 8 <= declaredSize;) {
    const name = buffer.toString("ascii", offset, offset + 4);
    const size = buffer.readUInt32LE(offset + 4);
    const start = offset + 8;
    const end = start + size;
    offset = end + (size % 2);
    if (end > declaredSize || offset > buffer.length) return invalid;
    const data = buffer.subarray(start, end);
    dimensions = dimensions || webpDimensions(name, data);
    if (name === "ANIM" && data.length >= 6) { animated = true; loopCount = data.readUInt16LE(4); }
    if (name === "ANMF") frames += 1;
  }
  if (!dimensions) return invalid;
  return { frameCount: frames || 1, height: dimensions.height, isAnimated: animated && frames >= 2, isWebP: true, loopCount, sha256: createHash("sha256").update(buffer).digest("hex"), width: dimensions.width };
}

function webpDimensions(name, data) {
  if (name === "VP8X" && data.length >= 10) return { width: readUInt24(data, 4) + 1, height: readUInt24(data, 7) + 1 };
  if (name === "VP8 " && data.length >= 10 && data[3] === 0x9d && data[4] === 0x01 && data[5] === 0x2a) return { width: data.readUInt16LE(6) & 0x3fff, height: data.readUInt16LE(8) & 0x3fff };
  if (name === "VP8L" && data.length >= 5 && data[0] === 0x2f) return { width: 1 + data[1] + ((data[2] & 0x3f) << 8), height: 1 + (data[2] >> 6) + (data[3] << 2) + ((data[4] & 0x0f) << 10) };
  return null;
}

function readUInt24(buffer, offset) {
  return buffer[offset] | (buffer[offset + 1] << 8) | (buffer[offset + 2] << 16);
}

async function assertCurrent(filePath, expected) {
  const current = await fs.readFile(filePath, "utf8").catch(() => null);
  if (current !== expected) throw new Error(`${relative(filePath)} is stale. Run pnpm library:exercise:generate.`);
}

function relative(filePath) {
  return path.relative(projectRoot, filePath).split(path.sep).join("/");
}
