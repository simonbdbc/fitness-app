import { existsSync, readdirSync, readFileSync } from "fs";
import path, { join, relative } from "path";
import { fileURLToPath } from "url";

const project = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");
const completeRoot = join(project, "docs", "bibliotheque");
const incompleteRoot = join(project, "docs", "bibliotheque-incomplete");
const auditPath = join(project, "docs", "audits", "bibliotheque-v2-audit.json");
const pillarSlugs = new Set(["warm-up", "cardio", "strength", "proprioception", "flexibility"]);
const equipmentSlugs = new Set([
  "wall", "chair", "table", "countertop", "couch", "stair", "door", "towel",
  "rings", "pull-up-bar", "low-bar", "vertical-bar", "parallel-bars", "parallettes",
  "bench", "box", "step", "resistance-band", "jump-rope", "kettlebell",
  "rowing-machine", "treadmill", "exercise-mat", "stationary-bike", "no-equipment",
]);

const complete = discover(completeRoot);
const incomplete = discover(incompleteRoot);
const audit = JSON.parse(readFileSync(auditPath, "utf8"));
assert(audit.schemaVersion === 2, "Unexpected V2 audit schema.");
assert(complete.length === audit.output.completeExercises, `Expected ${audit.output.completeExercises} complete exercises, got ${complete.length}.`);
assert(incomplete.length === audit.output.incompleteExercises, `Expected ${audit.output.incompleteExercises} incomplete exercises, got ${incomplete.length}.`);
assert(new Set([...complete, ...incomplete].map((record) => record.slug)).size === audit.output.totalExercises, "V2 exercise slugs must be globally unique.");

for (const record of complete) {
  assert(pillarSlugs.has(record.pillarSlug), `${record.displayPath}: unknown pillar.`);
  assert(equipmentSlugs.has(record.equipmentSlug), `${record.displayPath}: unknown equipment.`);
  const expected = [`${record.slug}-animate.webp`, `${record.slug}-en.md`, `${record.slug}-fr.md`, `${record.slug}-poster.webp`];
  assert(JSON.stringify(fileNames(record.directory)) === JSON.stringify(expected), `${record.displayPath}: complete exercise must contain exactly four files.`);
  validateMarkdown(record, "en", "complete");
  validateMarkdown(record, "fr", "complete");
}

for (const record of incomplete) {
  assert(pillarSlugs.has(record.pillarSlug), `${record.displayPath}: unknown pillar.`);
  assert(equipmentSlugs.has(record.equipmentSlug) || record.equipmentSlug === "unclassified-equipment", `${record.displayPath}: invalid incomplete equipment state.`);
  const names = fileNames(record.directory);
  assert(names.some((name) => name === `${record.slug}-en.md` || name === `${record.slug}-fr.md`), `${record.displayPath}: incomplete exercise has no Markdown.`);
  if (names.includes(`${record.slug}-en.md`)) validateMarkdown(record, "en", "incomplete");
  if (names.includes(`${record.slug}-fr.md`)) validateMarkdown(record, "fr", "incomplete");
}

assert(audit.output.completeExercises === complete.length, "V2 audit complete count is stale.");
assert(audit.output.incompleteExercises === incomplete.length, "V2 audit incomplete count is stale.");
assert(audit.output.totalExercises === complete.length + incomplete.length, "V2 audit total count is stale.");

const artifact = JSON.parse(readFileSync(join(project, "apps/pwa/src/features/catalog/data/exerciseLibrary.json"), "utf8"));
assert(artifact.release.code === "exercise-library-v2", "Unexpected exercise library release.");
assert(artifact.exercises.length === complete.length, `Expected ${complete.length} generated exercises, got ${artifact.exercises.length}.`);
assert(artifact.release.expectedExerciseCount === complete.length, "Generated release count is stale.");
assert(artifact.summary.exerciseCount === complete.length, "Generated summary count is stale.");
assert(new Set(artifact.exercises.map((exercise) => exercise.slug)).size === complete.length, "Generated slugs must be unique.");
assert(sameSet(artifact.exercises.map((exercise) => exercise.slug), complete.map((record) => record.slug)), "PWA artifact must contain exactly the complete V2 library.");
for (const slug of ["push-up", "air-squat", "burpee", "mountain-climber", "lying-leg-raise", "lean-planche"]) {
  assert(artifact.exercises.some((exercise) => exercise.slug === slug), `${slug} must remain available to ACREA evaluations.`);
}
for (const exercise of artifact.exercises) validateEditorialStatus(exercise);
assert(
  artifact.exercises.every(
    (exercise) =>
      exercise.reviewStatus === "valide" &&
      exercise.translationStatus === "validated" &&
      exercise.programmingStatus === "eligible",
  ),
  "The beta approval must cover all published exercises.",
);
const scope = JSON.parse(readFileSync(join(project, "contracts/catalog/publication-evaluation-scope.json"), "utf8"));
const mappings = JSON.parse(readFileSync(join(project, "contracts/catalog/acrea-level-evaluation-v4.json"), "utf8"));
const allowed = scope.allowedExerciseSlugs;
assert(allowed.length === 6 && new Set(allowed).size === 6, "Exactly six evaluation movements are authorized.");
assert(sameSet(allowed, mappings.exercises.map((entry) => entry.exerciseSlug)), "Scope must equal the V4 evaluation contract.");
assert(sameSet(allowed, artifact.exercises.map((entry) => entry.slug)), "Unexpected exercise in public artifact.");
assert(sameSet(allowed, complete.map((entry) => entry.slug)), "Unexpected exercise fiche in public export.");
assert(incomplete.length === 0, "Incomplete private exercises must not be exported.");
assert(artifact.sessionTemplates.every((entry) => allowed.includes(entry.exerciseSlug)), "Template outside evaluation scope.");
assert(artifact.summary.templateCount === artifact.sessionTemplates.length, "Template summary is stale.");
assert(artifact.summary.sessionTemplateLevelCount === artifact.sessionTemplates.reduce((n, entry) => n + entry.levels.length, 0), "Template-level summary is stale.");
const assets = readFileSync(join(project, "apps/pwa/src/features/catalog/data/exerciseLibraryAssets.ts"), "utf8");
for (const match of assets.matchAll(/require\("([^\"]+)"\)/g)) {
  assert(existsSync(join(project, "apps/pwa/src/features/catalog/data", match[1])), `Missing bundled asset: ${match[1]}`);
}

console.log(`[exercise-library] OK — ${complete.length} complete V2 exercises published; ${incomplete.length} incomplete exercises excluded.`);

function discover(root) {
  const records = [];
  if (!existsSync(root)) return records;
  visit(root);
  return records;
  function visit(directory) {
    const entries = readdirSync(directory, { withFileTypes: true });
    const slug = path.basename(directory);
    if (entries.some((entry) => entry.isFile() && (entry.name === `${slug}-fr.md` || entry.name === `${slug}-en.md`))) {
      const equipmentSlug = path.basename(path.dirname(directory));
      const pillarSlug = path.basename(path.dirname(path.dirname(directory)));
      records.push({ slug, directory, equipmentSlug, pillarSlug, displayPath: relative(root, directory) });
      return;
    }
    for (const entry of entries) if (entry.isDirectory()) visit(join(directory, entry.name));
  }
}

function validateMarkdown(record, locale, status) {
  const markdownPath = join(record.directory, `${record.slug}-${locale}.md`);
  const markdown = readFileSync(markdownPath, "utf8");
  for (const [key, value] of [["slug", record.slug], ["locale", locale], ["pillarSlug", record.pillarSlug], ["equipmentSlug", record.equipmentSlug], ["libraryStatus", status]]) {
    assert(new RegExp(`^${key}:\\s*"?${escapeRegex(value)}"?\\s*$`, "m").test(markdown), `${record.displayPath}: ${key} is stale in ${locale}.`);
  }
  assert(markdown.includes("## Codes"), `${record.displayPath}: Codes section is missing in ${locale}.`);
  assert(markdown.includes(`\`${record.slug}\``), `${record.displayPath}: exercise slug missing from Codes in ${locale}.`);
  if (status === "complete") {
    for (const key of ["labelFr", "labelEn", "difficulty", "impactSlug", "familySlug", "typeSlug", "muscleGroupSlugs", "reviewStatus", "translationStatus", "programmingStatus"]) {
      assert(new RegExp(`^\\s*${key}:\\s*.+$`, "m").test(markdown), `${record.displayPath}: ${key} missing from complete ${locale} document.`);
    }
    assert(!/Traduction française à réviser/u.test(markdown), `${record.displayPath}: translation placeholder in complete document.`);
  } else {
    assert(/^incompleteReasons:\s*$/m.test(markdown), `${record.displayPath}: incomplete reasons are missing.`);
  }
}

function validateEditorialStatus(exercise) {
  const requiredTexts = [exercise.movementDescription, exercise.startPosition, exercise.outboundExecution, exercise.returnExecution, exercise.adaptedVersion, exercise.tips, exercise.errors];
  const incomplete = requiredTexts.some((value) => !value?.trim()) || requiredTexts.some((value) => value.includes("Traduction française à réviser."));
  if (incomplete) {
    assert(exercise.reviewStatus !== "valide", `${exercise.slug}: incomplete exercise cannot be validated.`);
    assert(exercise.translationStatus !== "validated", `${exercise.slug}: incomplete translation cannot be validated.`);
    assert(exercise.programmingStatus !== "eligible", `${exercise.slug}: incomplete exercise cannot be programming-eligible.`);
  }
}

function validateBetaTemplates(artifact) {
  const programmingPillars = ["strength", "cardio", "proprioception"];
  const programmingExercises = artifact.exercises.filter((exercise) =>
    programmingPillars.includes(exercise.pillarSlug),
  );
  const templates = artifact.sessionTemplates ?? [];
  assert(
    artifact.summary.templateCount === templates.length,
    "Template summary is stale.",
  );
  assert(
    artifact.summary.sessionTemplateLevelCount === templates.reduce(
      (count, template) => count + template.levels.length,
      0,
    ),
    "Template-level summary is stale.",
  );
  assert(
    templates.filter((template) => template.phase === "main").length === programmingExercises.length,
    "Every ACREA-programmable exercise needs one main beta template.",
  );
  for (const phase of ["warmup", "cooldown"]) {
    const fixedTemplates = templates.filter((template) => template.phase === phase);
    assert(
      fixedTemplates.length === 1,
      `Exactly one beta ${phase} template is required.`,
    );
    const exercise = artifact.exercises.find(
      (candidate) => candidate.slug === fixedTemplates[0].exerciseSlug,
    );
    assert(exercise, `The beta ${phase} template references an unknown exercise.`);
    assert(
      exercise.equipmentSlug === "no-equipment" && exercise.impactSlug === "faible",
      `The beta ${phase} template must remain usable without equipment at low impact.`,
    );
  }
  for (const pillar of programmingPillars) {
    assert(
      templates.some((template) => {
        const exercise = artifact.exercises.find(
          (candidate) => candidate.slug === template.exerciseSlug,
        );
        return (
          template.phase === "main" &&
          exercise?.pillarSlug === pillar &&
          exercise.equipmentSlug === "no-equipment" &&
          exercise.impactSlug === "faible"
        );
      }),
      `The ${pillar} pillar needs a main template usable without equipment at low impact.`,
    );
    assert(
      templates.some((template) => {
        const exercise = artifact.exercises.find(
          (candidate) => candidate.slug === template.exerciseSlug,
        );
        return (
          template.phase === "main" &&
          exercise?.pillarSlug === pillar &&
          exercise.equipmentSlug === "no-equipment" &&
          exercise.impactSlug === "faible" &&
          template.levels.includes(1)
        );
      }),
      `The ${pillar} pillar needs a low-impact, no-equipment main fallback from ACREA level 1.`,
    );
  }
  for (const pillar of programmingPillars) {
    const exerciseSlugs = new Set(
      programmingExercises
        .filter((exercise) => exercise.pillarSlug === pillar)
        .map((exercise) => exercise.slug),
    );
    for (let level = 1; level <= 10; level += 1) {
      assert(
        templates.some(
          (template) =>
            template.phase === "main" &&
            exerciseSlugs.has(template.exerciseSlug) &&
            template.levels.some((candidateLevel) => Math.abs(candidateLevel - level) <= 1),
        ),
        `No ${pillar} main template can serve ACREA level ${level}.`,
      );
    }
  }
}

function fileNames(directory) {
  return readdirSync(directory, { withFileTypes: true }).filter((entry) => entry.isFile()).map((entry) => entry.name).sort();
}

function sameSet(left, right) {
  return left.length === right.length && left.every((value) => new Set(right).has(value));
}

function escapeRegex(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}
