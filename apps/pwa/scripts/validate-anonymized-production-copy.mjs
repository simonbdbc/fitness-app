#!/usr/bin/env node

import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(scriptDir, "..");
const copyDir = path.resolve(
  valueAfter("--copy-dir") ??
    path.join(os.tmpdir(), "acrea-supabase-production-copy"),
);
const expectedLastMigration = "20260717165936";
const databaseContainer = "supabase_db_fitness-client";
const temporaryRoots = [os.tmpdir(), "/tmp", "/private/tmp"].map((root) =>
  path.resolve(root),
);
const files = {
  schema: path.join(copyDir, "public-private-schema.sql"),
  catalog: path.join(copyDir, "public-catalog-data.sql"),
  history: path.join(copyDir, "migration-history.sql"),
};

if (!temporaryRoots.some((root) => copyDir.startsWith(`${root}${path.sep}`))) {
  throw new Error(
    "The production copy must be below the system temp directory.",
  );
}
for (const [label, filePath] of Object.entries(files)) {
  if (!fs.existsSync(filePath)) {
    throw new Error(`Missing ${label} dump: ${filePath}.`);
  }
}

const history = fs.readFileSync(files.history, "utf8");
if (!history.includes(expectedLastMigration)) {
  throw new Error(
    `Production copy does not contain migration ${expectedLastMigration}.`,
  );
}
for (const unexpected of [
  "20260719202256",
  "20260811090000",
  "20260811100000",
  "20260812083749",
  "20260812105130",
  "20260813074437",
]) {
  if (history.includes(unexpected)) {
    throw new Error(
      `Production copy already contains pending migration ${unexpected}.`,
    );
  }
}

runSupabase(["start"]);
runSupabase([
  "db",
  "reset",
  "--local",
  "--version",
  expectedLastMigration,
  "--no-seed",
]);
runPsqlText(
  "drop schema if exists public cascade; drop schema if exists private cascade; create schema public; create schema private;",
);
runPsqlFile(files.schema);
runPsqlFile(files.catalog, { disableTriggers: true });
runPsqlText(
  "drop trigger if exists on_auth_user_changed_sync_profile on auth.users; create trigger on_auth_user_changed_sync_profile after insert or update of email, raw_user_meta_data on auth.users for each row execute function private.sync_auth_user_profile();",
);
runSupabase(["db", "query", "--local", "--file", "supabase/demo-user.sql"]);
runSupabase([
  "db",
  "query",
  "--local",
  "--file",
  "supabase/audits/beta_v1_00_synthetic_history_before.sql",
]);
runSupabase(["db", "push", "--local", "--dry-run"]);
runSupabase(["db", "push", "--local", "--yes"]);
runSupabase([
  "db",
  "query",
  "--local",
  "--file",
  "supabase/audits/beta_v1_00_synthetic_history_after.sql",
]);
runSupabase([
  "db",
  "query",
  "--local",
  "--file",
  "supabase/audits/weekly_ai_v2_contract.sql",
]);
runSupabase(["test", "db", "--local"]);

console.log("Anonymized production copy migration validation passed.");

function runSupabase(args) {
  const executable = path.join(projectRoot, "node_modules", ".bin", "supabase");
  run(executable, args);
}

function runPsqlFile(filePath, { disableTriggers = false } = {}) {
  const file = fs.readFileSync(filePath);
  const input = disableTriggers
    ? Buffer.concat([
        Buffer.from("set session_replication_role = replica;\n"),
        file,
        Buffer.from("\nset session_replication_role = origin;\n"),
      ])
    : file;
  run(
    "docker",
    [
      "exec",
      "-i",
      databaseContainer,
      "psql",
      "-U",
      "postgres",
      "-d",
      "postgres",
      "-v",
      "ON_ERROR_STOP=1",
    ],
    input,
  );
}

function runPsqlText(sql) {
  run("docker", [
    "exec",
    databaseContainer,
    "psql",
    "-U",
    "postgres",
    "-d",
    "postgres",
    "-v",
    "ON_ERROR_STOP=1",
    "-c",
    sql,
  ]);
}

function run(executable, args, input) {
  const result = spawnSync(executable, args, {
    cwd: projectRoot,
    env: { ...process.env, SUPABASE_TELEMETRY_DISABLED: "true" },
    input,
    stdio: input ? ["pipe", "inherit", "inherit"] : "inherit",
    maxBuffer: 100 * 1024 * 1024,
  });
  if (result.status !== 0) {
    throw new Error(
      `${path.basename(executable)} ${args.slice(0, 3).join(" ")} failed.`,
    );
  }
}

function valueAfter(flag) {
  const index = process.argv.indexOf(flag);
  return index >= 0 ? process.argv[index + 1] : undefined;
}
