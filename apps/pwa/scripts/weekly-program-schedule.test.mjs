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
const sourcePath = path.join(
  projectRoot,
  "src/features/programming/services/weeklyProgramSchedule.ts",
);
let source = await fs.readFile(sourcePath, "utf8");
source = source.replace('import * as Crypto from "expo-crypto";\n', "").replace(
  'import { getIsoWeek } from "./weeklyProgramContract";\n',
  `const getIsoWeek = (date) => {
      const value = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
      const day = value.getUTCDay() || 7;
      value.setUTCDate(value.getUTCDate() + 4 - day);
      const start = new Date(Date.UTC(value.getUTCFullYear(), 0, 1));
      return { isoWeekYear: value.getUTCFullYear(), isoWeekNumber: Math.ceil((((value - start) / 86400000) + 1) / 7) };
    };\n`,
);
const compiled = ts.transpileModule(source, {
  compilerOptions: {
    module: ts.ModuleKind.ESNext,
    target: ts.ScriptTarget.ES2022,
  },
  fileName: sourcePath,
}).outputText;
const schedule = await import(
  `data:text/javascript;base64,${Buffer.from(compiled).toString("base64")}`
);

const profile = () => ({
  id: "profile",
  name: "Nom A",
  objective: "Texte A",
  objectiveCode: "complete",
  equipmentMode: "mixte",
  weeklyFrequency: 3,
  sessionMinutesMin: 30,
  sessionMinutesMax: 45,
  weeklyNoveltyPercent: 50,
  levelTestStatus: "completed",
  levelTestVersion: 3,
  levelTestCompletedAt: "2026-07-01T00:00:00.000Z",
  pillarLevels: { strength: 2, cardio: 3, proprioception: 1 },
  availableEquipment: ["chaise", "mur"],
  preferredWeekdays: [2, 5],
  restrictions: [
    { type: "temporaryPain", muscleGroupCodes: ["dos", "bras"] },
    { type: "impactLimit", maximumImpact: "faible" },
  ],
  excludedExerciseCodes: [],
});

test("canonical profile ignores display text and collection order", () => {
  const left = profile();
  const right = {
    ...profile(),
    name: "Nom B",
    objective: "Texte B",
    availableEquipment: ["mur", "chaise"],
    preferredWeekdays: [5, 2],
    restrictions: [...profile().restrictions].reverse(),
  };
  right.restrictions[1] = {
    type: "temporaryPain",
    muscleGroupCodes: ["bras", "dos"],
  };
  assert.equal(
    schedule.canonicalWeeklyProgramProfile(left),
    schedule.canonicalWeeklyProgramProfile(right),
  );
});

test("finds the first preferred day strictly after the request", () => {
  assert.equal(
    schedule.nextPreferredDateAfter(new Date(2026, 6, 14, 18), [2, 3, 5]),
    "2026-07-15",
  );
  assert.equal(
    schedule.nextPreferredDateAfter(new Date(2026, 6, 17, 18), [1, 5]),
    "2026-07-20",
  );
});

test("builds the new snapshot in the following ISO week", () => {
  const effectiveDate = schedule.nextPreferredDateAfter(
    new Date(2026, 6, 17, 18),
    [1, 5],
  );
  const result = schedule.buildPartialRegenerationSchedule({
    effectiveDate,
    existingTrainings: [],
    preferredWeekdays: [1, 5],
    requestedAt: new Date(`${effectiveDate}T12:00:00`),
    weeklyFrequency: 2,
  });
  assert.deepEqual(
    result.slots.map(({ date }) => date),
    ["2026-07-20", "2026-07-24"],
  );
});

test("maps ISO weekdays across year boundaries", () => {
  assert.equal(schedule.isoDateForWeekday(2020, 53, 5), "2021-01-01");
});

test("sorts remotely supplied weekdays chronologically", () => {
  assert.deepEqual(
    schedule
      .currentWeekDatesForWeekdays(new Date(2026, 6, 14), [5, 3])
      .map(({ date }) => date),
    ["2026-07-15", "2026-07-17"],
  );
});

test("preserves Tuesday and replaces only future unstarted trainings", () => {
  const result = schedule.buildPartialRegenerationSchedule({
    effectiveDate: "2026-07-15",
    existingTrainings: [
      {
        id: 1,
        scheduledDate: "2026-07-14",
        status: "terminee",
        hasFeedback: true,
      },
      {
        id: 2,
        scheduledDate: "2026-07-17",
        status: "a faire",
        hasFeedback: false,
      },
    ],
    preferredWeekdays: [3, 5],
    requestedAt: new Date(2026, 6, 14, 18),
    weeklyFrequency: 3,
  });
  assert.deepEqual(
    result.preserved.map(({ id }) => id),
    [1],
  );
  assert.deepEqual(
    result.replaceable.map(({ id }) => id),
    [2],
  );
  assert.deepEqual(
    result.slots.map(({ date }) => date),
    ["2026-07-15", "2026-07-17"],
  );
});

test("keeps completed and feedback-linked future trainings", () => {
  const result = schedule.buildPartialRegenerationSchedule({
    effectiveDate: "2026-07-15",
    existingTrainings: [
      {
        id: 1,
        scheduledDate: "2026-07-17",
        status: "terminee",
        hasFeedback: false,
      },
      {
        id: 2,
        scheduledDate: "2026-07-18",
        status: "a faire",
        hasFeedback: true,
      },
    ],
    preferredWeekdays: [3, 5, 6],
    requestedAt: new Date(2026, 6, 14, 18),
    weeklyFrequency: 3,
  });
  assert.deepEqual(
    result.preserved.map(({ id }) => id),
    [1, 2],
  );
  assert.deepEqual(result.replaceable, []);
  assert.deepEqual(
    result.slots.map(({ date }) => date),
    ["2026-07-15"],
  );
});
