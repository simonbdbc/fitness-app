import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const projectRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
);
const sourceRoot = path.join(projectRoot, "src");
const applicationRoots = [path.join(projectRoot, "app"), sourceRoot];
const sourceFiles = await collectSourceFiles(sourceRoot);
const allApplicationFiles = (
  await Promise.all(applicationRoots.map(collectSourceFiles))
).flat();

test("screens remain orchestration boundaries instead of feature monoliths", async () => {
  const screens = sourceFiles.filter((file) =>
    file.includes(`${path.sep}screens${path.sep}`),
  );
  const oversized = [];

  for (const file of screens) {
    const source = await fs.readFile(file, "utf8");
    const lineCount = source.trimEnd().split(/\r?\n/).length;
    if (lineCount > 400) {
      oversized.push(`${relative(file)} (${lineCount} lignes)`);
    }
  }

  assert.deepEqual(oversized, []);
});

test("feature consumers use public entry points or named domain ports", async () => {
  const allowedPorts = new Set([
    "@features/catalog/programming",
    "@features/training/history",
  ]);
  const violations = [];

  for (const file of allApplicationFiles) {
    const source = await fs.readFile(file, "utf8");
    for (const match of source.matchAll(/from\s+["'](@features\/[^"']+)["']/g)) {
      const specifier = match[1];
      const segments = specifier.split("/");
      if (segments.length <= 2 || allowedPorts.has(specifier)) {
        continue;
      }

      violations.push(`${relative(file)} -> ${specifier}`);
    }
  }

  assert.deepEqual(violations, []);
});

test("source filenames and button variants follow the application conventions", async () => {
  const hyphenatedFiles = sourceFiles
    .filter((file) => path.basename(file).includes("-"))
    .map(relative);
  const quietVariants = [];

  for (const file of allApplicationFiles) {
    const source = await fs.readFile(file, "utf8");
    if (/variant\s*=\s*["'{][^\n}]*quiet/.test(source)) {
      quietVariants.push(relative(file));
    }
  }

  assert.deepEqual(hyphenatedFiles, []);
  assert.deepEqual(quietVariants, []);
});

test("critical providers and infrastructure facades keep a bounded impact radius", async () => {
  const limits = new Map([
    ["src/features/pwa/providers/PwaProvider.tsx", 250],
    ["src/shared/db/database.ts", 150],
    ["src/features/training/screens/TrainingScreen.tsx", 250],
    ["src/features/catalog/screens/CatalogScreen.tsx", 200],
    ["src/features/catalog/services/catalogRepository.ts", 150],
    ["src/features/workouts/services/sessionTimer.ts", 50],
  ]);

  for (const [relativePath, maximum] of limits) {
    const source = await fs.readFile(path.join(projectRoot, relativePath), "utf8");
    const lineCount = source.trimEnd().split(/\r?\n/).length;
    assert.ok(
      lineCount <= maximum,
      `${relativePath} dépasse sa limite d'architecture (${lineCount}/${maximum})`,
    );
  }
});

test("the root isolates optional PWA failures from core application failures", async () => {
  const rootLayout = await fs.readFile(
    path.join(projectRoot, "app/_layout.tsx"),
    "utf8",
  );

  assert.match(rootLayout, /PwaUnavailableProvider/);
  assert.match(rootLayout, /ProviderErrorBoundary/);
  assert.match(rootLayout, /ApplicationFatalScreen/);
});

async function collectSourceFiles(root) {
  const entries = await fs.readdir(root, { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    const entryPath = path.join(root, entry.name);
    if (entry.isDirectory()) {
      files.push(...(await collectSourceFiles(entryPath)));
    } else if (/\.(?:ts|tsx)$/.test(entry.name)) {
      files.push(entryPath);
    }
  }

  return files;
}

function relative(file) {
  return path.relative(projectRoot, file).split(path.sep).join("/");
}
