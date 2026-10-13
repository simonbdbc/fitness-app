import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const projectRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
);
const repositoryRoot = path.resolve(projectRoot, "../..");

test("the forward migration renames the enum and updates new-profile defaults", async () => {
  const migrationsDirectory = path.join(projectRoot, "supabase/migrations");
  const migrationNames = (await fs.readdir(migrationsDirectory)).filter((name) =>
    name.endsWith("_rename_free_account_to_basic.sql"),
  );

  assert.equal(migrationNames.length, 1);
  const migration = await fs.readFile(
    path.join(migrationsDirectory, migrationNames[0]),
    "utf8",
  );

  assert.match(
    migration,
    /alter type public\.user_account_type rename value 'free' to 'basic'/i,
  );
  assert.match(
    migration,
    /alter column account_type set default 'basic'/i,
  );
  assert.match(
    migration,
    /create or replace function private\.sync_auth_user_profile\(\)[\s\S]*?'basic'/i,
  );
  assert.match(
    migration,
    /revoke all on function private\.sync_auth_user_profile\(\) from public/i,
  );
});

test("current schemas, seeds and auth runtime only expose the basic role", async () => {
  const currentSources = [
    "src/features/auth/domain/authPolicy.ts",
    "src/features/auth/providers/AuthProvider.tsx",
    "src/features/auth/services/supabaseAuthSession.ts",
    "src/application/layouts/AppLayout.tsx",
    "supabase/demo-user.sql",
    "supabase/reset-local-format-schema.sql",
  ];
  const repositorySources = [
    "docs/sql/schema-psql.sql",
    "docs/app/auth/roles-et-profils.md",
  ];

  for (const relativePath of currentSources) {
    const source = await fs.readFile(path.join(projectRoot, relativePath), "utf8");
    assert.doesNotMatch(source, /\bfree\b|Gratuit/i, relativePath);
  }

  for (const relativePath of repositorySources) {
    const source = await fs.readFile(
      path.join(repositoryRoot, relativePath),
      "utf8",
    );
    assert.doesNotMatch(source, /\bfree\b|Gratuit/i, relativePath);
  }
});
