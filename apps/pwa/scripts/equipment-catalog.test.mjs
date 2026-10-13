import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import ts from "typescript";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const helperPath = path.join(
  root,
  "src/features/catalog/services/equipmentRequirements.ts",
);
const helperSource = await fs.readFile(helperPath, "utf8");
const helperJs = ts.transpileModule(helperSource, {
  compilerOptions: {
    module: ts.ModuleKind.ESNext,
    target: ts.ScriptTarget.ES2022,
  },
}).outputText;
const requirements = await import(
  `data:text/javascript;base64,${Buffer.from(helperJs).toString("base64")}`
);

const library = JSON.parse(
  await fs.readFile(
    path.join(root, "src/features/catalog/data/exerciseLibrary.json"),
    "utf8",
  ),
);

test("normalizes every catalog exercise to concrete equipment", () => {
  assert.equal(library.exercises.length, library.release.expectedExerciseCount);
  assert.equal(library.exercises.length, library.summary.exerciseCount);
  const canonicalCodes = new Set(
    requirements.canonicalEquipment.map((item) => item.code),
  );
  assert.equal(canonicalCodes.size, requirements.canonicalEquipment.length);
  for (const equipment of requirements.canonicalEquipment) {
    assert.match(equipment.category, /^(maison|sport)$/);
    assert.doesNotMatch(
      equipment.label.toLowerCase(),
      /\/|optionnel|^aucun$|^support(?: stable)?$/,
    );
  }
  for (const exercise of library.exercises) {
    const options = requirements.equipmentOptionsForExercise({
      code: exercise.slug,
      equipmentCode: exercise.equipmentSlug,
    });
    assert.ok(options.length > 0, `${exercise.code} has equipment options`);
    for (const option of options) {
      if (option.kind === "bodyweight") {
        assert.deepEqual(option.equipmentCodes, []);
      } else {
        assert.ok(option.equipmentCodes.length > 0);
        assert.equal(
          new Set(option.equipmentCodes).size,
          option.equipmentCodes.length,
        );
        option.equipmentCodes.forEach((code) =>
          assert.ok(canonicalCodes.has(code), `${exercise.code}: ${code}`),
        );
      }
    }
  }
});

test("maps one canonical equipment identity without legacy inference", () => {
  const exercise = (equipmentCode, code = "audit") => ({ code, equipmentCode });
  assert.deepEqual(
    requirements.equipmentOptionsForExercise(exercise("no-equipment")),
    [{ kind: "bodyweight", equipmentCodes: [] }],
  );
  assert.deepEqual(
    requirements.equipmentOptionsForExercise(exercise("pull-up-bar")),
    [{ kind: "equipment", equipmentCodes: ["pull-up-bar"] }],
  );
  assert.throws(
    () => requirements.equipmentOptionsForExercise(exercise("aucun-parallettes")),
    /hors référentiel/,
  );
});

test("filters bodyweight and concrete equipment from normalized options", () => {
  const exercise = (equipmentOptions, equipmentCode = "") => ({
    equipmentCode,
    equipmentOptions,
  });

  assert.equal(
    requirements.matchesEquipmentFilter(
      exercise([{ kind: "bodyweight", equipmentCodes: [] }]),
      { kind: "bodyweight" },
    ),
    true,
  );
  assert.equal(
    requirements.matchesEquipmentFilter(
      exercise([
        {
          kind: "equipment",
          equipmentCodes: ["pull-up-bar", "resistance-band"],
        },
      ]),
      { kind: "equipment", equipmentCode: "resistance-band" },
    ),
    true,
  );
  assert.equal(
    requirements.matchesEquipmentFilter(
      exercise([{ kind: "equipment", equipmentCodes: ["chair"] }]),
      { kind: "bodyweight" },
    ),
    false,
  );
  assert.equal(
    requirements.matchesEquipmentFilter(
      exercise([
        { kind: "equipment", equipmentCodes: ["a-evaluer"] },
      ], "a-evaluer"),
      { kind: "bodyweight" },
    ),
    false,
  );
});

test("does not silently reinterpret missing or legacy equipment options", () => {
  assert.equal(
    requirements.matchesEquipmentFilter(
      { equipmentCode: "", equipmentOptions: [] },
      { kind: "bodyweight" },
    ),
    false,
  );
  assert.equal(
    requirements.matchesEquipmentFilter(
      { equipmentCode: "bodyweight", equipmentOptions: [] },
      { kind: "bodyweight" },
    ),
    false,
  );
  assert.equal(
    requirements.matchesEquipmentFilter(
      { equipmentCode: "banc", equipmentOptions: [] },
      { kind: "equipment", equipmentCode: "banc" },
    ),
    false,
  );
});
