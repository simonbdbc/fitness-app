import { spawn } from "node:child_process";

const command = process.platform === "win32" ? "pnpm.cmd" : "pnpm";
const child = spawn(
  command,
  ["exec", "expo", "export", "--platform", "web", "--output-dir", "dist"],
  {
    env: process.env,
    stdio: ["inherit", "pipe", "pipe"],
  },
);

let pending = "";
let skippingAssets = false;
let skippedAssetCount = 0;

for (const stream of [child.stdout, child.stderr]) {
  stream.setEncoding("utf8");
  stream.on("data", (chunk) => {
    pending += chunk;
    const lines = pending.split(/\r?\n/);
    pending = lines.pop() ?? "";
    for (const line of lines) writeLine(line);
  });
}

const exitCode = await new Promise((resolve, reject) => {
  child.once("error", reject);
  child.once("close", (code, signal) => {
    if (signal) {
      reject(new Error(`Expo export interrompu par le signal ${signal}.`));
      return;
    }
    resolve(code ?? 1);
  });
});

if (pending) writeLine(pending);
if (skippingAssets) {
  process.stdout.write(
    `[expo export] ${skippedAssetCount} lignes d’assets masquées.\n`,
  );
}
if (exitCode !== 0) process.exitCode = exitCode;

function writeLine(line) {
  const plainLine = line.replace(/\x1B\[[0-?]*[ -/]*[@-~]/g, "");
  if (plainLine.includes("Assets (")) {
    skippingAssets = true;
    skippedAssetCount = 0;
    process.stdout.write("[expo export] Liste détaillée des assets masquée.\n");
    return;
  }
  if (skippingAssets && /› (?:web bundles|Files|Static routes|API routes)/.test(plainLine)) {
    skippingAssets = false;
    process.stdout.write(
      `[expo export] ${skippedAssetCount} lignes d’assets masquées.\n`,
    );
  }
  if (skippingAssets) {
    skippedAssetCount += 1;
    return;
  }
  process.stdout.write(`${line}\n`);
}
