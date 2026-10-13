#!/usr/bin/env node

import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(scriptDir, "..");
const expectedProjectRef = "vnsisuhlaxxldpwjhgcm";
const temporaryRoots = [os.tmpdir(), "/tmp", "/private/tmp"].map((root) =>
  path.resolve(root),
);
const outputDir = path.resolve(
  valueAfter("--output-dir") ??
    path.join(os.tmpdir(), "acrea-supabase-production-copy"),
);
const userOwnedTables = [
  "public.user_profiles",
  "public.acrea_profiles",
  "public.acrea_profile_equipment",
  "public.acrea_profile_restrictions",
  "public.acrea_level_test_attempts",
  "public.acrea_level_test_stage_results",
  "public.acrea_level_evaluation_attempts",
  "public.acrea_level_evaluation_sessions",
  "public.acrea_level_evaluation_results",
  "public.acrea_level_evaluation_preferences",
  "public.acrea_exercise_progressions",
  "public.acrea_profile_excluded_exercises",
  "public.programs",
  "public.trainings",
  "public.seances",
  "public.sessions",
  "public.session_feedback",
];

if (
  !temporaryRoots.some((root) => outputDir.startsWith(`${root}${path.sep}`))
) {
  throw new Error(
    "The production copy must be written below the system temp directory.",
  );
}
if (!process.env.SUPABASE_ACCESS_TOKEN?.trim()) {
  throw new Error("SUPABASE_ACCESS_TOKEN is required.");
}
if (!process.env.SUPABASE_DB_PASSWORD?.trim()) {
  throw new Error("SUPABASE_DB_PASSWORD is required.");
}
if (!process.env.SUPABASE_PROJECT_REF?.trim()) {
  throw new Error("SUPABASE_PROJECT_REF is required.");
}
if (process.env.SUPABASE_PROJECT_REF !== expectedProjectRef) {
  throw new Error(
    `Production project mismatch: expected ${expectedProjectRef}, received ${process.env.SUPABASE_PROJECT_REF}.`,
  );
}

fs.rmSync(outputDir, { recursive: true, force: true });
fs.mkdirSync(outputDir, { recursive: true, mode: 0o700 });

run([
  "link",
  "--project-ref",
  process.env.SUPABASE_PROJECT_REF,
  "--password",
  process.env.SUPABASE_DB_PASSWORD,
]);
run([
  "db",
  "dump",
  "--linked",
  "--schema",
  "public,private",
  "--file",
  path.join(outputDir, "public-private-schema.sql"),
]);
run([
  "db",
  "dump",
  "--linked",
  "--schema",
  "public",
  "--data-only",
  "--use-copy",
  ...userOwnedTables.flatMap((table) => ["--exclude", table]),
  "--file",
  path.join(outputDir, "public-catalog-data.sql"),
]);
run([
  "db",
  "dump",
  "--linked",
  "--schema",
  "supabase_migrations",
  "--data-only",
  "--use-copy",
  "--file",
  path.join(outputDir, "migration-history.sql"),
]);

fs.writeFileSync(
  path.join(outputDir, "README.txt"),
  `ACREA anonymized production copy

This directory contains the public schema, catalog-only data and migration
history. Auth, profiles, evaluation attempts/results, restrictions, programs,
feedback and all other user-owned rows are deliberately excluded.

Restore only into a disposable local Supabase database. After restoring, use
supabase/demo-user.sql and the synthetic qualification fixture for test-only
identities. Compare the aggregate-only output of
supabase/audits/beta_v1_00_redacted_user_state.sql before and after the replay,
then run:

  pnpm db:production-copy:validate --copy-dir ${outputDir}

Delete this directory after validation. Never commit it.
`,
  { mode: 0o600 },
);

console.log(`Anonymized production copy prepared in ${outputDir}.`);

function run(args) {
  const executable = path.join(projectRoot, "node_modules", ".bin", "supabase");
  const result = spawnSync(executable, args, {
    cwd: projectRoot,
    env: { ...process.env, SUPABASE_TELEMETRY_DISABLED: "true" },
    stdio: "inherit",
  });
  if (result.status !== 0) {
    throw new Error(`supabase ${args.slice(0, 2).join(" ")} failed.`);
  }
}

function valueAfter(flag) {
  const index = process.argv.indexOf(flag);
  return index >= 0 ? process.argv[index + 1] : undefined;
}
