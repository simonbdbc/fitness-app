import path from "node:path";
import fs from "node:fs";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const projectRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
);
const workspaceRoot = path.resolve(projectRoot, "../..");
const crate = path.join(workspaceRoot, "crates/weekly-ai-wasm");
const output = path.join(projectRoot, "src/generated/weekly-ai-wasm");
const toolchain = "stable";
const rustc = spawnSync(
  "rustup",
  ["which", "rustc", "--toolchain", toolchain],
  { cwd: workspaceRoot, encoding: "utf8" },
);
if (rustc.error) throw rustc.error;
if (rustc.status !== 0) {
  process.stderr.write(rustc.stderr);
  process.exit(rustc.status ?? 1);
}
const toolchainBin = path.dirname(rustc.stdout.trim());
const cargoBin = path.join(
  process.env.CARGO_HOME ?? path.join(process.env.HOME, ".cargo"),
  "bin",
);
const rustcVersion = spawnSync(
  path.join(toolchainBin, "rustc"),
  ["--version"],
  {
    encoding: "utf8",
  },
);
if (
  rustcVersion.status !== 0 ||
  !rustcVersion.stdout.startsWith("rustc 1.95.0 ")
) {
  throw new Error(
    `Rust 1.95.0 requis, version trouvée: ${rustcVersion.stdout.trim()}`,
  );
}
const result = spawnSync(
  "wasm-pack",
  ["build", crate, "--target", "web", "--out-dir", output, "--locked"],
  {
    cwd: workspaceRoot,
    encoding: "utf8",
    stdio: "inherit",
    env: {
      ...process.env,
      PATH: [toolchainBin, cargoBin, process.env.PATH]
        .filter(Boolean)
        .join(path.delimiter),
      RUSTUP_TOOLCHAIN: toolchain,
    },
  },
);

if (result.error) throw result.error;
if (result.status !== 0) process.exit(result.status ?? 1);

const gluePath = path.join(output, "weekly_ai_wasm.js");
const generatedGlue = fs.readFileSync(gluePath, "utf8");
const importMetaLoader = "new URL('weekly_ai_wasm_bg.wasm', import.meta.url)";
if (!generatedGlue.includes(importMetaLoader)) {
  throw new Error(
    "Chargeur WASM généré inattendu: import.meta.url introuvable.",
  );
}
fs.writeFileSync(
  gluePath,
  generatedGlue.replace(importMetaLoader, "'/weekly_ai_wasm_bg.wasm'"),
);
fs.copyFileSync(
  path.join(output, "weekly_ai_wasm_bg.wasm"),
  path.join(projectRoot, "public/weekly_ai_wasm_bg.wasm"),
);
