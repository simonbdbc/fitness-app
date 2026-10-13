import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

import init, {
  generate_weekly_program_json,
  generate_weekly_program_rules_json,
} from "../src/generated/weekly-ai-wasm/weekly_ai_wasm.js";

const projectRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
);
const wasmBytes = await fs.readFile(
  path.join(projectRoot, "src/generated/weekly-ai-wasm/weekly_ai_wasm_bg.wasm"),
);
await init({ module_or_path: wasmBytes });

const candidate = (pillar, id, phase = "main") => ({
  sessionTemplateId: id,
  exerciseId: id,
  exerciseCode: `exercise-${id}`,
  exerciseName: `Exercise ${id}`,
  formatId: id,
  formatCode: `format-${id}`,
  formatLabel: "3 x 8",
  pillar,
  phase,
  prescriptionKind:
    phase !== "main" ? "fixed" : pillar === "cardio" ? "intervals" : "repetitions",
  level: 2,
  durationSeconds: 420,
  completeExerciseSheet: true,
  equipmentOptions: [{ kind: "bodyweight", equipmentCodes: [] }],
  muscleGroupCodes: [pillar === "strength" ? "pecs" : "jambes"],
  impactCode: "faible",
  regression: null,
  progression: null,
});

const validInput = () => ({
  schemaVersion: 3,
  profile: {
    id: "wasm-smoke-profile",
    objectiveCode: "complete",
    equipmentMode: "aucun",
    weeklyFrequency: 1,
    sessionMinutesMin: 20,
    sessionMinutesMax: 40,
    weeklyNoveltyPercent: 50,
    levelTestCompleted: true,
    levelTestVersion: 3,
    pillarLevels: { strength: 2, cardio: 2, proprioception: 2 },
    availableEquipment: [],
    preferredWeekdays: [2],
    restrictions: [{ type: "impactLimit", maximumImpact: "faible" }],
    excludedExerciseCodes: [],
  },
  candidates: [
    candidate("proprioception", 90, "warmup"),
    candidate("proprioception", 91, "cooldown"),
    candidate("strength", 1), candidate("strength", 4),
    candidate("cardio", 2), candidate("cardio", 5),
    candidate("proprioception", 3), candidate("proprioception", 6),
  ],
  recentStats: {
    successRate: 0.8,
    fatigue: 0.2,
    skippedSessions: 0,
    painRate: 0,
    progressionNeeded: false,
    regressionNeeded: false,
  },
  candidateRecentStats: [],
  exerciseProgressions: [],
  exerciseHistories: [],
  isoWeekYear: 2026,
  isoWeekNumber: 29,
  catalogVersion: "wasm-smoke-v3",
});

function assertProgram(program, generatedBy) {
  assert.deepEqual(Object.keys(program).sort(), [
    "catalogVersion",
    "generatedBy",
    "isoWeekNumber",
    "isoWeekYear",
    "role",
    "schemaVersion",
    "trainings",
    "validationFocus",
  ]);
  assert.equal(program.generatedBy, generatedBy);
  assert.equal(program.isoWeekYear, 2026);
  assert.equal(program.isoWeekNumber, 29);
  assert.equal(program.trainings.length, 1);
  assert.equal(program.trainings[0].day, "Mardi");
  assert.deepEqual(
    program.trainings[0].seances.map((seance) => seance.phase),
    ["warmup", "main", "main", "main", "cooldown"],
  );
  const sessions = program.trainings[0].seances.flatMap(
    (seance) => seance.sessions,
  );
  assert.ok(sessions.every((session) => session.prescription));
  assert.equal(sessions[0].prescription.adaptable, false);
}

test("executes the embedded Burn scorer", () => {
  const program = JSON.parse(
    generate_weekly_program_json(JSON.stringify(validInput())),
  );
  assertProgram(program, "burn-flex:weekly-scorer-v1+acrea-v3");
});

test("executes the shared deterministic scorer", () => {
  const program = JSON.parse(
    generate_weekly_program_rules_json(JSON.stringify(validInput())),
  );
  assertProgram(program, "acrea-rules-v3");
});

test("safely regresses a high-level profile when low-impact candidates are lower level", () => {
  for (const generate of [
    generate_weekly_program_json,
    generate_weekly_program_rules_json,
  ]) {
    const input = validInput();
    input.profile.pillarLevels = {
      strength: 10,
      cardio: 10,
      proprioception: 10,
    };

    const program = JSON.parse(generate(JSON.stringify(input)));
    assertProgram(
      program,
      generate === generate_weekly_program_json
        ? "burn-flex:weekly-scorer-v1+acrea-v3"
        : "acrea-rules-v3",
    );
  }
});

test("prioritizes complete exercise sheets with a deterministic fallback", () => {
  for (const generate of [
    generate_weekly_program_json,
    generate_weekly_program_rules_json,
  ]) {
    const input = validInput();
    input.candidates
      .filter((entry) => [1, 2, 3].includes(entry.exerciseId))
      .forEach((entry) => {
        entry.completeExerciseSheet = false;
      });

    const program = JSON.parse(generate(JSON.stringify(input)));
    const mainExerciseIds = mainSessionExerciseIds(program);
    input.candidates.reverse();
    const reversed = JSON.parse(generate(JSON.stringify(input)));

    assert.ok([4, 5, 6].every((id) => mainExerciseIds.includes(id)));
    assert.ok([1, 2].every((id) => !mainExerciseIds.includes(id)));
    assert.deepEqual(mainSessionExerciseIds(reversed), mainExerciseIds);
  }
});

function mainSessionExerciseIds(program) {
  return program.trainings[0].seances
    .filter((seance) => seance.phase === "main")
    .flatMap((seance) =>
      seance.sessions.map((session) => session.exerciseId),
    );
}

test("rejects unknown and legacy input fields", () => {
  const unknown = { ...validInput(), unexpected: true };
  assert.throws(() => generate_weekly_program_json(JSON.stringify(unknown)));

  const legacy = validInput();
  legacy.candidates[0].sessionDefinitionId =
    legacy.candidates[0].sessionTemplateId;
  delete legacy.candidates[0].sessionTemplateId;
  assert.throws(() => generate_weekly_program_json(JSON.stringify(legacy)));
});

test("rejects a completed evaluation older than protocol V3", () => {
  const obsoleteEvaluation = validInput();
  obsoleteEvaluation.profile.levelTestVersion = 2;

  assert.throws(
    () => generate_weekly_program_json(JSON.stringify(obsoleteEvaluation)),
    /evaluation v3/i,
  );
});
