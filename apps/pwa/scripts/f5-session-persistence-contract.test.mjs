import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const projectRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
);

const f5ReferenceSha256 = new Map([
  ["src/features/workouts/domain/sessionTimerMachine.ts", "97cd3c87f77267424d7c4d6e7d24998711c71eea90939d34ad7e2c5e4f4d7080"],
  ["src/features/workouts/hooks/useSessionTimer.ts", "a6429d6fda107b389d7be2bb0c927fc7bce620c8405367c1a33a87b039f426c9"],
  ["src/features/workouts/services/sessionTimerPersistence.ts", "0d9826709852035908836b01de49fffb13ee5f11dd7437f50a82d59fc36fc97a"],
  ["src/features/workouts/services/timerScreenPreferences.ts", "02290b539699780b397ca6b8af3f978d45c7a66395443b2a756060bfceff52b4"],
  ["src/features/workouts/screens/TimerScreen.tsx", "fc030074f8f42d0f28d087bb1ca15039edb9c3d41c47f5e67a0a59855eae30bb"],
]);

test("the proven f5 timer engine preserves f5cd675 logic with an isolated demo storage namespace", async () => {
  for (const [relativePath, expectedHash] of f5ReferenceSha256) {
    const content = (await fs.readFile(path.join(projectRoot, relativePath), "utf8")).replaceAll("acrea-fitness-public-demo.", "acrea-fitness.");
    const actualHash = createHash("sha256").update(content).digest("hex");
    assert.equal(actualHash, expectedHash, `${relativePath} drifted from f5cd675`);
  }
});

test("the PWA runtime dependency versions stay aligned with f5cd675", async () => {
  const packageJson = JSON.parse(
    await fs.readFile(path.join(projectRoot, "package.json"), "utf8"),
  );
  assert.deepEqual(
    Object.fromEntries(
      [
        "@react-native-async-storage/async-storage",
        "expo",
        "expo-router",
        "react",
        "react-native",
        "react-native-web",
      ].map((name) => [name, packageJson.dependencies[name]]),
    ),
    {
      "@react-native-async-storage/async-storage": "^2.2.0",
      expo: "~55.0.27",
      "expo-router": "~55.0.14",
      react: "19.2.0",
      "react-native": "0.83.6",
      "react-native-web": "^0.21.0",
    },
  );
});
