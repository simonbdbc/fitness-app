import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import ts from "typescript";
import { fileURLToPath } from "node:url";

import { generateBaseFormatSeedData } from "./generate-base-format-seed.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

test("the active catalog exposes exactly 2,219 unique V3 formats", () => {
  const seed = generateBaseFormatSeedData();
  assert.equal(seed.formats.length, 2_219);
  assert.equal(new Set(seed.formats.map(({ code }) => code)).size, 2_219);
  assert.equal(
    new Set(seed.formats.map((format) => [
      format.formatType,
      format.seriesCode,
      format.repetitionsCode,
      format.intervalCode,
      format.restCode,
    ].join(":"))).size,
    2_219,
  );
  assert.equal(seed.formats.filter(({ formatType }) => formatType === "repetitions").length, 651);
  assert.equal(seed.formats.filter(({ formatType }) => formatType === "intervalles").length, 1_568);
  for (const code of [
    "format-reps-s02-r16-rest90s",
    "format-reps-s03-r16-rest90s",
    "format-reps-s01-maximum-rest30s",
    "format-reps-s12-r12-rest30s",
    "format-interval-300s-s08-rest300s",
  ]) {
    assert.ok(seed.formats.some((format) => format.code === code), `${code} missing`);
  }
});

test("main exercise advance requires both saved feedback and finished recovery", async () => {
  const sourcePath = path.join(root, "src/features/training/domain/mainExerciseRecovery.ts");
  const source = await fs.readFile(sourcePath, "utf8");
  const compiled = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
    fileName: sourcePath,
  }).outputText;
  const recovery = await import(
    `data:text/javascript;base64,${Buffer.from(compiled).toString("base64")}`
  );
  assert.equal(recovery.mainExerciseRecoverySeconds, 90);
  assert.equal(recovery.trainingSessionAllowsEarlyFinish("warmup"), true);
  assert.equal(recovery.trainingSessionAllowsEarlyFinish("main"), false);
  assert.equal(recovery.trainingSessionAllowsEarlyFinish("cooldown"), true);
  assert.equal(recovery.canAdvanceAfterMainExercise({ feedbackSaved: false, recoveryComplete: false }), false);
  assert.equal(recovery.canAdvanceAfterMainExercise({ feedbackSaved: true, recoveryComplete: false }), false);
  assert.equal(recovery.canAdvanceAfterMainExercise({ feedbackSaved: false, recoveryComplete: true }), false);
  assert.equal(recovery.canAdvanceAfterMainExercise({ feedbackSaved: true, recoveryComplete: true }), true);
});

test("format resolution excludes historical catalog rows", async () => {
  const source = await fs.readFile(
    path.join(
      root,
      "src/features/programming/services/catalogProgrammingCandidates.ts",
    ),
    "utf8",
  );
  assert.match(
    source,
    /format\.sourceStatus === "seed base formats metier"\s*&&\s*format\.formatType === expectedType/,
  );
});

test("evaluation appreciation initializes history until training feedback exists", async () => {
  const sourcePath = path.join(
    root,
    "src/features/programming/services/exerciseHistoryMerge.ts",
  );
  const source = await fs.readFile(sourcePath, "utf8");
  const compiled = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
    fileName: sourcePath,
  }).outputText;
  const history = await import(
    `data:text/javascript;base64,${Buffer.from(compiled).toString("base64")}`
  );
  const evaluation = [{
    appreciation_average: 1,
    evaluated_at: "2026-07-17T10:00:00Z",
    exercise_id: 42,
  }];
  assert.deepEqual(
    history.mergeEvaluationAndTrainingHistories([], evaluation),
    [{
      appreciation_average: 1,
      exercise_id: 42,
      last_performed_at: "2026-07-17T10:00:00Z",
      reached_maximum: 0,
    }],
  );
  const training = [{
    appreciation_average: 5,
    exercise_id: 42,
    last_performed_at: "2026-07-18T10:00:00Z",
    reached_maximum: 1,
  }];
  assert.deepEqual(
    history.mergeEvaluationAndTrainingHistories(training, evaluation),
    training,
  );
});
