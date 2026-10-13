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
  "src/features/programming/services/weeklyProgramContract.ts",
);
const source = await fs.readFile(contractPath, "utf8");
const compiled = ts.transpileModule(source, {
  compilerOptions: {
    module: ts.ModuleKind.ESNext,
    target: ts.ScriptTarget.ES2022,
  },
  fileName: contractPath,
}).outputText;
const contract = await import(
  `data:text/javascript;base64,${Buffer.from(compiled).toString("base64")}`
);

const prescription = (phase) => ({
  kind: phase === "main" ? "repetitions" : "fixed",
  series: phase === "main" ? 2 : 1,
  repetitions: phase === "main" ? 4 : null,
  effortSeconds: phase === "main" ? null : 300,
  restSeconds: phase === "main" ? 60 : 0,
  estimatedDurationSeconds: phase === "main" ? 92 : 300,
  adaptable: phase === "main",
});

const session = (phase, id) => ({
  code: `session-${id}`,
  sessionTemplateId: id,
  exerciseId: id + 10,
  exerciseCode: `exercise-${id}`,
  exerciseName: `Exercise ${id}`,
  formatId: id + 20,
  formatLabel: phase === "main" ? "2 x 4" : "5 min",
  formatCode: `format-${id}`,
  phase,
  level: 2,
  prescription: prescription(phase),
  easier: { name: "Régression", level: 1, note: "Régression" },
  harder: { name: "Progression", level: 3, note: "Progression" },
  safetyRule: "Technique stable",
});

const validProgram = () => ({
  schemaVersion: 3,
  isoWeekYear: 2026,
  isoWeekNumber: 29,
  catalogVersion: "catalog-v1",
  role: "Installation",
  validationFocus: "Qualité",
  generatedBy: "burn-flex:weekly-scorer-v1",
  trainings: [
    {
      code: "T1",
      day: "Lundi",
      title: "Corps entier",
      dominantPillar: "strength",
      durationMinutes: 25,
      status: "a faire",
      seances: [
        {
          code: "seance-echauffement",
          phase: "warmup",
          pillar: null,
          title: "Échauffement",
          sessions: [session("warmup", 1)],
        },
        {
          code: "seance-renforcement",
          phase: "main",
          pillar: "strength",
          title: "Renforcement",
          sessions: [session("main", 10)],
        },
        {
          code: "seance-cardio",
          phase: "main",
          pillar: "cardio",
          title: "Cardio",
          sessions: [session("main", 11)],
        },
        {
          code: "seance-proprioception",
          phase: "main",
          pillar: "proprioception",
          title: "Proprioception",
          sessions: [session("main", 12)],
        },
        {
          code: "seance-assouplissements",
          phase: "cooldown",
          pillar: null,
          title: "Assouplissements",
          sessions: [session("cooldown", 2)],
        },
      ],
    },
  ],
});

test("accepts canonical catalog identifiers", () => {
  const parsed = contract.parseWeeklyProgram(validProgram());
  assert.equal(parsed.trainings[0].scheduledDate, "2026-07-13");
  const parsedSession = parsed.trainings[0].seances[1].sessions[0];
  assert.equal(parsedSession.sessionTemplateId, 10);
  assert.equal(parsedSession.exerciseId, 20);
  assert.equal(parsedSession.formatId, 30);
});

test("rejects unknown output fields", () => {
  const output = validProgram();
  output.trainings[0].seances[1].sessions[0].unknown = true;
  assert.throws(
    () => contract.parseWeeklyProgram(output),
    /champ inconnu unknown/,
  );
});

test("rejects legacy sessionDefinitionId output", () => {
  const output = validProgram();
  const legacySession = output.trainings[0].seances[1].sessions[0];
  legacySession.sessionDefinitionId = legacySession.sessionTemplateId;
  delete legacySession.sessionTemplateId;
  assert.throws(() => contract.parseWeeklyProgram(output));
});

test("keeps ISO week year across the new year boundary", () => {
  assert.deepEqual(contract.getIsoWeek(new Date(2021, 0, 1)), {
    isoWeekYear: 2020,
    isoWeekNumber: 53,
  });
  assert.deepEqual(contract.getIsoWeek(new Date(2021, 0, 4)), {
    isoWeekYear: 2021,
    isoWeekNumber: 1,
  });
});

test("requires an explicit exercise-sheet completeness signal without promoting fallbacks", () => {
  const fallbackCandidate = {
    sessionTemplateId: 1,
    exerciseId: 1,
    exerciseCode: "exercise-1",
    exerciseName: "Exercice 1",
    formatId: 1,
    formatCode: "format-1",
    formatLabel: "2 x 4",
    pillar: "strength",
    phase: "main",
    prescriptionKind: "repetitions",
    level: 2,
    durationSeconds: 120,
    completeExerciseSheet: false,
    equipmentOptions: [{ kind: "bodyweight", equipmentCodes: [] }],
    muscleGroupCodes: ["pecs"],
    impactCode: "faible",
    regression: null,
    progression: null,
  };
  const input = buildInput(fallbackCandidate);

  assert.equal(input.candidates[0].completeExerciseSheet, false);

  const missingSignal = { ...fallbackCandidate };
  delete missingSignal.completeExerciseSheet;
  assert.throws(
    () => buildInput(missingSignal),
    /complétude candidat invalide/,
  );
});

function buildInput(candidate) {
  return contract.buildWeeklyProgramAiInput({
    candidates: [candidate],
    catalogVersion: "catalog-v1",
    profile: {
      id: "profile-1",
      objectiveCode: "complete",
      equipmentMode: "aucun",
      weeklyFrequency: 1,
      sessionMinutesMin: 20,
      sessionMinutesMax: 25,
      weeklyNoveltyPercent: 0,
      levelTestStatus: "completed",
      levelTestVersion: 3,
      pillarLevels: {
        strength: 2,
        cardio: 2,
        proprioception: 2,
      },
      availableEquipment: [],
      preferredWeekdays: [1],
      restrictions: [],
      excludedExerciseCodes: [],
    },
    recentStats: {
      successRate: 0.8,
      fatigue: 0.2,
      skippedSessions: 0,
      painRate: 0,
      progressionNeeded: false,
      regressionNeeded: false,
    },
    candidateRecentStats: [],
    week: { isoWeekYear: 2026, isoWeekNumber: 29 },
  });
}
