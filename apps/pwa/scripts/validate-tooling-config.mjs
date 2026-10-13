import { readFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const appRoot = fileURLToPath(new URL("../", import.meta.url));
const localBasePath = fileURLToPath(
  new URL("../tsconfig.expo-base.json", import.meta.url),
);
const tsconfigPath = fileURLToPath(new URL("../tsconfig.json", import.meta.url));
const { loadNativeWindPreset } = require("./load-nativewind-preset.cjs");

function fail(message, error) {
  console.error(`\n[tooling:check] ${message}`);
  if (error instanceof Error) {
    console.error(`Cause: ${error.message}`);
  }
  console.error(
    "Repair dependencies from the repository root with: pnpm setup\n",
  );
  process.exit(1);
}

let expoBasePath;
let nativeWindPresetPath;
let typescriptPackagePath;

try {
  expoBasePath = require.resolve("expo/tsconfig.base.json", {
    paths: [appRoot],
  });
  nativeWindPresetPath = require.resolve("nativewind/preset", {
    paths: [appRoot],
  });
  typescriptPackagePath = require.resolve("typescript/package.json", {
    paths: [appRoot],
  });
} catch (error) {
  fail("Expo, TypeScript or NativeWind is not installed correctly.", error);
}

let localBase;
let expoBase;
let tsconfig;

try {
  [localBase, expoBase, tsconfig] = await Promise.all(
    [localBasePath, expoBasePath, tsconfigPath].map(async (path) =>
      JSON.parse(await readFile(path, "utf8")),
    ),
  );
  await Promise.all([
    readFile(nativeWindPresetPath, "utf8"),
    readFile(typescriptPackagePath, "utf8"),
  ]);
} catch (error) {
  fail("A tooling configuration file is missing or invalid.", error);
}

const localExpoConfig = {
  compilerOptions: localBase.compilerOptions,
  exclude: localBase.exclude,
};
const installedExpoConfig = {
  compilerOptions: expoBase.compilerOptions,
  exclude: expoBase.exclude,
};

if (JSON.stringify(localExpoConfig) !== JSON.stringify(installedExpoConfig)) {
  fail(
    "tsconfig.expo-base.json no longer matches the installed Expo SDK. Update the local copy from expo/tsconfig.base.json.",
  );
}

if (tsconfig.extends !== "./tsconfig.expo-base.json") {
  fail(
    'tsconfig.json must extend the repository-local "./tsconfig.expo-base.json" file.',
  );
}

const nativeWindPreset = loadNativeWindPreset();
const intelliSenseFallback = loadNativeWindPreset({
  load: () => {
    throw new Error("Simulated missing NativeWind preset");
  },
  env: { TAILWIND_MODE: "build" },
});

if (
  typeof nativeWindPreset !== "function" ||
  JSON.stringify(intelliSenseFallback) !== "{}"
) {
  fail("The NativeWind preset loader or its IntelliSense fallback is invalid.");
}

console.log(
  "[tooling:check] OK - local Expo base and NativeWind preset are valid.",
);
