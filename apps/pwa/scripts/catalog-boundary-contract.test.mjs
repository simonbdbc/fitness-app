import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import ts from "typescript";
import { fileURLToPath } from "node:url";

const projectRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
);
const contractPath = path.join(
  projectRoot,
  "src/features/catalog/contracts/trainingCatalog.ts",
);
const contractSource = await fs.readFile(contractPath, "utf8");
const contractCompiled = ts.transpileModule(contractSource, {
  compilerOptions: {
    module: ts.ModuleKind.ESNext,
    target: ts.ScriptTarget.ES2022,
  },
  fileName: contractPath,
}).outputText;
const { resolveTrainingCatalogTimerFormat } = await import(
  `data:text/javascript;base64,${Buffer.from(contractCompiled).toString("base64")}`
);
const validationPath = path.join(
  projectRoot,
  "src/features/catalog/domain/catalogValidation.ts",
);
const validationCompiled = ts.transpileModule(
  await fs.readFile(validationPath, "utf8"),
  {
    compilerOptions: {
      module: ts.ModuleKind.ESNext,
      target: ts.ScriptTarget.ES2022,
    },
    fileName: validationPath,
  },
).outputText;
const catalogValidation = await import(
  `data:text/javascript;base64,${Buffer.from(validationCompiled).toString("base64")}`
);
const catalogRowsPath = path.join(
  projectRoot,
  "src/features/catalog/infrastructure/catalogRows.ts",
);
const catalogRowsCompiled = ts.transpileModule(
  await fs.readFile(catalogRowsPath, "utf8"),
  {
    compilerOptions: {
      module: ts.ModuleKind.ESNext,
      target: ts.ScriptTarget.ES2022,
    },
    fileName: catalogRowsPath,
  },
).outputText;
const catalogRows = await import(
  `data:text/javascript;base64,${Buffer.from(catalogRowsCompiled).toString("base64")}`
);
const trainingScreenSource = await fs.readFile(
  path.join(projectRoot, "src/features/training/screens/TrainingScreen.tsx"),
  "utf8",
);
const { generateSnapshotSeedFiles } = await import(
  new URL("./update-catalog-seed-from-snapshot.mjs", import.meta.url)
);

test("training format resolution prefers the persisted catalog id", () => {
  const formats = [repetitionFormat({ id: 17, code: "format-current" })];
  const resolved = resolveTrainingCatalogTimerFormat(formats, {
    formatCode: "format-stale",
    formatId: 17,
    formatLabel: "Ancien libellé",
  });

  assert.equal(resolved?.code, "format-current");
  assert.equal(resolved?.seriesCount, 3);
});

test("maximum repetitions remains a valid manual timer format", () => {
  const resolved = resolveTrainingCatalogTimerFormat(
    [repetitionFormat({ repetitions: null })],
    reference(),
  );

  assert.deepEqual(resolved, {
    code: "format",
    formatType: "repetitions",
    label: "3 séries maximum",
    repetitions: null,
    restSeconds: 60,
    seriesCount: 3,
  });
});

test("an incomplete interval format never reaches the timer", () => {
  const format = {
    ...repetitionFormat(),
    formatType: "intervalles",
    intervalSeconds: null,
    repetitions: null,
  };

  assert.equal(
    resolveTrainingCatalogTimerFormat([format], reference()),
    null,
  );
});

test("invalid series or rest invariants are rejected at the boundary", () => {
  assert.equal(
    resolveTrainingCatalogTimerFormat(
      [repetitionFormat({ seriesCount: 0 })],
      reference(),
    ),
    null,
  );
  assert.equal(
    resolveTrainingCatalogTimerFormat(
      [repetitionFormat({ restSeconds: -1 })],
      reference(),
    ),
    null,
  );
});

test("training consumes the public catalog hook and never the generated seed", () => {
  assert.match(trainingScreenSource, /useTrainingCatalogFormats/);
  assert.doesNotMatch(trainingScreenSource, /getLocalCatalogSeed|catalogSeed/);
  assert.doesNotMatch(
    trainingScreenSource,
    /@features\/catalog\/(services|data)\//,
  );
});

test("structural and FR exercise catalogs are separate JSON artifacts", async () => {
  const foundationPath = path.join(
    projectRoot,
    "src/features/catalog/data/catalogSeed.json",
  );
  const exerciseLibraryPath = path.join(
    projectRoot,
    "src/features/catalog/data/exerciseLibrary.json",
  );
  const legacyTsPath = path.join(
    projectRoot,
    "src/features/catalog/data/catalogSeed.ts",
  );
  const exerciseLibraryCorePath = path.join(
    projectRoot,
    "src/features/catalog/data/exerciseLibraryCore.ts",
  );
  const foundation = JSON.parse(await fs.readFile(foundationPath, "utf8"));
  const exerciseLibrary = JSON.parse(
    await fs.readFile(exerciseLibraryPath, "utf8"),
  );

  assert.equal(foundation.exercises.length, 0);
  assert.equal(foundation.sessionTemplates.length, 0);
  assert.equal(
    exerciseLibrary.exercises.length,
    exerciseLibrary.release.expectedExerciseCount,
  );
  assert.equal(
    exerciseLibrary.exercises.length,
    exerciseLibrary.summary.exerciseCount,
  );
  assert.equal(exerciseLibrary.release.code, "exercise-library-v2");
  const exerciseLibrarySeedSource = await fs.readFile(
    path.join(
      projectRoot,
      "src/features/catalog/data/exerciseLibrarySeed.ts",
    ),
    "utf8",
  );
  const exerciseLibraryCoreSource = await fs.readFile(
    exerciseLibraryCorePath,
    "utf8",
  );
  assert.match(exerciseLibraryCoreSource, /sourceKey:\s*exerciseLibrarySourceKey/);
  assert.doesNotMatch(exerciseLibrarySeedSource, /import artifact from "\.\/exerciseLibrary\.json"/);
  assert.doesNotMatch(exerciseLibraryCoreSource, /exerciseLibrary\.json/);
  const catalogSeedWriterSource = await fs.readFile(
    path.join(
      projectRoot,
      "src/features/catalog/services/catalogSeedWriter.ts",
    ),
    "utf8",
  );
  assert.match(catalogSeedWriterSource, /source_key = excluded\.source_key/);
  assert.match(catalogSeedWriterSource, /metadata\.sourceKey/);
  const supabaseExerciseSeed = await fs.readFile(
    path.join(projectRoot, "supabase/exercise_library_v2_seed.sql"),
    "utf8",
  );
  assert.match(
    supabaseExerciseSeed,
    /release\.code \|\| ':' \|\| value\.slug/,
  );
  await assert.rejects(fs.access(legacyTsPath));
});

test("the structural snapshot updater rejects exercises and templates", async () => {
  const foundation = JSON.parse(
    await fs.readFile(
      path.join(projectRoot, "src/features/catalog/data/catalogSeed.json"),
      "utf8",
    ),
  );

  assert.throws(
    () =>
      generateSnapshotSeedFiles({
        ...foundation,
        exercises: [{ code: "forbidden-non-fr-exercise" }],
      }),
    /proviennent exclusivement de docs\/bibliotheque/,
  );
  assert.throws(
    () =>
      generateSnapshotSeedFiles({
        ...foundation,
        sessionTemplates: [{ code: "forbidden-template" }],
      }),
    /proviennent exclusivement de docs\/bibliotheque/,
  );
});

test("catalog codes are canonicalized by one pure domain rule", () => {
  assert.equal(
    catalogValidation.normalizeCatalogCode(" Élévation / Mollets "),
    "elevation-mollets",
  );
  assert.equal(catalogValidation.isStableCatalogCode("format-3x8"), true);
  assert.equal(catalogValidation.isStableCatalogCode("Format_3x8"), false);
  assert.throws(() => catalogValidation.normalizeCatalogCode("---"));
});

test("catalog numeric invariants reject invalid CRUD inputs", () => {
  assert.equal(catalogValidation.requirePositiveInteger(3.8, "Séries"), 3);
  assert.equal(catalogValidation.requireNonNegativeInteger(0, "Repos"), 0);
  assert.equal(catalogValidation.clampCatalogLevel(14), 10);
  assert.throws(() =>
    catalogValidation.requirePositiveInteger(0, "Séries"),
  );
  assert.throws(() =>
    catalogValidation.requireNonNegativeInteger(-1, "Repos"),
  );
});

test("SQL format rows are mapped at one infrastructure boundary", () => {
  const mapped = catalogRows.mapFormatRow({
    code: "interval-3x60",
    description: "Intervalles",
    format_type: "intervalles",
    id: 9,
    interval_code: "interval-60",
    interval_id: 4,
    interval_seconds: 60,
    label: "3 séries de 1 min",
    repetitions: null,
    repetitions_code: null,
    repetitions_id: null,
    rest_code: "rest-90",
    rest_id: 3,
    rest_seconds: 90,
    series_code: "series-3",
    series_count: 3,
    series_id: 3,
    source_status: "test",
    updated_at: "2026-07-15T00:00:00.000Z",
  });

  assert.equal(mapped.formatType, "intervalles");
  assert.equal(mapped.intervalSeconds, 60);
  assert.equal(mapped.restSeconds, 90);
  assert.equal(mapped.seriesCount, 3);
});

test("equipment usage mapping keeps SQL names outside the domain", () => {
  assert.deepEqual(
    catalogRows.mapCatalogEquipmentUsageRow({
      category: "sport",
      code: "elastique",
      exercise_count: 12,
      id: 4,
      label: "Élastique",
      profile_count: 2,
    }),
    {
      category: "sport",
      code: "elastique",
      exerciseCount: 12,
      id: 4,
      label: "Élastique",
      profileCount: 2,
      updatedAt: "",
    },
  );
});

function reference() {
  return { formatCode: "format", formatId: 1, formatLabel: "format" };
}

function repetitionFormat(overrides = {}) {
  return {
    code: "format",
    description: "",
    formatType: "repetitions",
    id: 1,
    intervalCode: null,
    intervalId: null,
    intervalSeconds: null,
    label: "3 séries maximum",
    repetitions: null,
    repetitionsCode: "maximum",
    repetitionsId: 1,
    restCode: "rest-60",
    restId: 1,
    restSeconds: 60,
    seriesCode: "series-3",
    seriesCount: 3,
    seriesId: 1,
    sourceStatus: "test",
    updatedAt: "2026-07-15T00:00:00.000Z",
    ...overrides,
  };
}
