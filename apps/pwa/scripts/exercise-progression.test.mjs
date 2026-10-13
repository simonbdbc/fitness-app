import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import ts from "typescript";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const sourcePath = path.join(root, "src/features/programming/services/exerciseProgression.ts");
const source = await fs.readFile(sourcePath, "utf8");
const compiled = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
  fileName: sourcePath,
}).outputText;
const progression = await import(`data:text/javascript;base64,${Buffer.from(compiled).toString("base64")}`);

test("repetition progression crosses 8 reps then increases series", () => {
  let value = progression.initialExercisePrescription("repetitions", "strength", 5);
  for (let index = 0; index < 4; index += 1) value = progression.adaptExercisePrescription(value, "harder", "strength", 5);
  assert.deepEqual([value.series, value.repetitions], [2, 8]);
  value = progression.adaptExercisePrescription(value, "harder", "strength", 5);
  assert.deepEqual([value.series, value.repetitions], [3, 4]);
});

test("level six repetition progression starts at 6x8 and reaches 12x12", () => {
  const current = {
    kind: "repetitions", series: 6, repetitions: 8, effortSeconds: null,
    restSeconds: 30, estimatedDurationSeconds: 1, adaptable: true,
  };
  const next = progression.adaptExercisePrescription(current, "harder", "strength", 6);
  assert.deepEqual([next.series, next.repetitions], [6, 9]);
  assert.deepEqual(
    [progression.initialExercisePrescription("repetitions", "strength", 6).series,
      progression.initialExercisePrescription("repetitions", "strength", 6).repetitions],
    [6, 8],
  );
});

test("interval progression changes effort, rest, then series", () => {
  const effortMax = {
    kind: "intervals", series: 2, repetitions: null, effortSeconds: 60,
    restSeconds: 60, estimatedDurationSeconds: 1, adaptable: true,
  };
  const lessRest = progression.adaptExercisePrescription(effortMax, "harder", "cardio", 5);
  assert.equal(lessRest.restSeconds, 50);
  const stageMax = { ...lessRest, restSeconds: 30 };
  const nextSeries = progression.adaptExercisePrescription(stageMax, "harder", "cardio", 5);
  assert.deepEqual([nextSeries.series, nextSeries.effortSeconds, nextSeries.restSeconds], [3, 30, 60]);
});

test("pain, stopping and low quality force a safety regression", () => {
  for (const input of [
    { completed: true, painLevel: "pain", qualityRating: 5 },
    { completed: false, painLevel: "none", qualityRating: 5 },
    { completed: true, painLevel: "none", qualityRating: 2 },
  ]) {
    assert.equal(
      progression.safeProgressionDirection({ ...input, progressionPreference: "harder" }),
      "easier",
    );
  }
});

test("all six progression scales expose the required anchors and maxima", () => {
  const cases = [
    ["repetitions", "strength", 5, [2, 4, null, 30], [8, 8, null, 30]],
    ["repetitions", "strength", 6, [6, 8, null, 30], [12, 12, null, 30]],
    ["intervals", "cardio", 5, [2, null, 30, 60], [5, null, 60, 30]],
    ["intervals", "cardio", 6, [4, null, 20, 60], [8, null, 60, 20]],
    ["intervals", "proprioception", 5, [1, null, 30, 60], [4, null, 180, 30]],
    ["intervals", "proprioception", 6, [1, null, 30, 60], [8, null, 300, 30]],
  ];
  for (const [kind, pillar, level, expectedStart, expectedMaximum] of cases) {
    const start = progression.initialExercisePrescription(kind, pillar, level);
    assert.deepEqual(
      [start.series, start.repetitions, start.effortSeconds, start.restSeconds],
      expectedStart,
    );
    let current = start;
    for (let step = 0; step < 500; step += 1) {
      const next = progression.adaptExercisePrescription(current, "harder", pillar, level);
      if (JSON.stringify(next) === JSON.stringify(current)) break;
      current = next;
    }
    assert.deepEqual(
      [current.series, current.repetitions, current.effortSeconds, current.restSeconds],
      expectedMaximum,
    );
    assert.equal(progression.prescriptionAtMaximum(current, pillar, level), true);
    const previous = progression.adaptExercisePrescription(current, "easier", pillar, level);
    assert.notDeepEqual(previous, current);
    assert.deepEqual(
      progression.adaptExercisePrescription(start, "easier", pillar, level),
      start,
    );
  }
});
