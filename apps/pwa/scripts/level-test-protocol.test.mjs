import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import ts from "typescript";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const sourcePath = path.join(root, "src/features/level-test/domain/levelTestProtocol.ts");
const entrySourcePath = path.join(root, "src/features/programming/data/acreaEntryLevelTest.ts");
const entrySource = await fs.readFile(entrySourcePath, "utf8");
const entryCompiled = ts.transpileModule(entrySource, {
  compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
  fileName: entrySourcePath,
}).outputText;
const entryUrl = `data:text/javascript;base64,${Buffer.from(entryCompiled).toString("base64")}`;
const source = (await fs.readFile(sourcePath, "utf8")).replace(
  /import \{\s*acreaEntryTestExercises,\s*type ACREAEntryTestExerciseCode,\s*\} from "\.\.\/\.\.\/programming\/data\/acreaEntryLevelTest";/,
  `import { acreaEntryTestExercises } from "${entryUrl}";\ntype ACREAEntryTestExerciseCode = string;`,
);
const compiled = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
  fileName: sourcePath,
}).outputText;
const protocol = await import(`data:text/javascript;base64,${Buffer.from(compiled).toString("base64")}`);
const entry = await import(entryUrl);

test("all six exercises are replayed when one technical result fails", () => {
  const exerciseCodes = Array.from({ length: 6 }, (_, index) => `exercise-${index + 1}`);
  const results = exerciseCodes.map((exerciseCode) => ({ exerciseCode, technicalValid: true }));
  assert.equal(protocol.isEvaluationSessionPassed(exerciseCodes, results), true);
  results[2].technicalValid = false;
  assert.equal(protocol.isEvaluationSessionPassed(exerciseCodes, results), false);
});

test("evaluation phases unlock only after the preceding session passes", () => {
  const sessions = [];
  assert.equal(protocol.nextRequiredEvaluationPhase(sessions), 1);
  sessions.push({ phase: 1, status: "failed" });
  assert.equal(protocol.nextRequiredEvaluationPhase(sessions), 1);
  sessions.push({ phase: 1, status: "passed" });
  assert.equal(protocol.nextRequiredEvaluationPhase(sessions), 2);
  sessions.push({ phase: 2, status: "passed" }, { phase: 3, status: "passed" });
  assert.equal(protocol.nextRequiredEvaluationPhase(sessions), null);
});

test("the three sessions use the required prescriptions", () => {
  assert.deepEqual(protocol.prescriptionForEvaluationPhase(1, "renforcement-bodyweight-squats"), {
    repetitions: 12,
    restSeconds: 90,
    series: 2,
  });
  assert.deepEqual(protocol.prescriptionForEvaluationPhase(1, "proprioception-planche-lean"), {
    repetitions: 6,
    restSeconds: 90,
    series: 2,
  });
  assert.deepEqual(protocol.prescriptionForEvaluationPhase(2, "cardio-mountain-climber-controle"), {
    repetitions: 16,
    restSeconds: 90,
    series: 3,
  });
  assert.deepEqual(protocol.prescriptionForEvaluationPhase(2, "renforcement-strict-pushups"), {
    repetitions: 8,
    restSeconds: 90,
    series: 3,
  });
  assert.deepEqual(protocol.prescriptionForEvaluationPhase(3, "renforcement-strict-pushups"), {
    repetitions: null,
    restSeconds: 30,
    series: 1,
  });
});

test("six exercises produce warmup, recoveries and cooldown", () => {
  const steps = protocol.buildEvaluationStepKinds(6);
  assert.equal(steps.length, 13);
  assert.equal(steps.filter((step) => step === "exercise").length, 6);
  assert.equal(steps.filter((step) => step === "recovery").length, 5);
  assert.equal(steps[0], "warmup");
  assert.equal(steps.at(-1), "cooldown");
});

test("recovery cards have no timer and only global phases can end early", () => {
  assert.equal(protocol.evaluationStepUsesTimer("recovery"), false);
  assert.equal(protocol.evaluationStepUsesTimer("exercise"), true);
  assert.equal(protocol.evaluationStepAllowsEarlyFinish("warmup"), true);
  assert.equal(protocol.evaluationStepAllowsEarlyFinish("cooldown"), true);
  assert.equal(protocol.evaluationStepAllowsEarlyFinish("exercise"), false);
  assert.equal(protocol.evaluationStepAllowsEarlyFinish("recovery"), false);
});

test("planche lean is dynamic and mapped to the canonical exercise", () => {
  const planche = entry.acreaEntryTestExercises.find(
    ({ code }) => code === "proprioception-planche-lean",
  );
  assert.equal(planche.exerciseSlug, "lean-planche");
  assert.match(planche.execution.join(" "), /épaules au-delà des mains/i);
  assert.match(planche.execution.join(" "), /retour/i);
  assert.match(planche.execution.join(" "), /bras tendus/i);
});

test("strict maximum thresholds are continuous and exercise-specific", () => {
  for (const [code, level2, level3] of [
    ["renforcement-strict-pushups", 20, 50],
    ["renforcement-bodyweight-squats", 30, 80],
    ["cardio-burpee-sans-pompe", 20, 50],
    ["cardio-mountain-climber-controle", 40, 90],
    ["proprioception-leg-raise", 20, 50],
    ["proprioception-planche-lean", 10, 30],
  ]) {
    assert.equal(protocol.levelForStrictMaximum(code, level2 - 1), 1);
    assert.equal(protocol.levelForStrictMaximum(code, level2), 2);
    assert.equal(protocol.levelForStrictMaximum(code, level3 - 1), 2);
    assert.equal(protocol.levelForStrictMaximum(code, level3), 3);
  }
  assert.throws(() => protocol.levelForStrictMaximum("renforcement-strict-pushups", -1), /entier positif/);
});

test("the weakest of the two exercises defines the pillar level", () => {
  assert.equal(protocol.pillarLevelFromStrictMaximums([
    { exerciseCode: "renforcement-strict-pushups", value: 55 },
    { exerciseCode: "renforcement-bodyweight-squats", value: 40 },
  ]), 2);
  assert.equal(protocol.pillarLevelFromStrictMaximums([
    { exerciseCode: "proprioception-leg-raise", value: 60 },
    { exerciseCode: "proprioception-planche-lean", value: 9 },
  ]), 1);
  assert.throws(() => protocol.pillarLevelFromStrictMaximums([
    { exerciseCode: "renforcement-strict-pushups", value: 12 },
  ]), /Deux exercices/);
});

test("evaluation feedback requires technique, appreciation and the phase-three maximum", () => {
  assert.throws(
    () => protocol.assertValidEvaluationFeedback(1, {
      appreciationRating: 4,
      technicalValid: null,
    }),
    /technique/i,
  );
  assert.throws(
    () => protocol.assertValidEvaluationFeedback(1, {
      appreciationRating: null,
      technicalValid: true,
    }),
    /appréciation/i,
  );
  assert.throws(
    () => protocol.assertValidEvaluationFeedback(3, {
      appreciationRating: 4,
      technicalValid: false,
    }),
    /maximum/i,
  );
  assert.doesNotThrow(() => protocol.assertValidEvaluationFeedback(3, {
    appreciationRating: 4,
    maximumRepetitions: 0,
    technicalValid: false,
  }));
});
