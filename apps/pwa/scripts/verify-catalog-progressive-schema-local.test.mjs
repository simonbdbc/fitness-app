import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { test } from "node:test";

import {
  readLocalSupabaseStatus,
  verifyLocalProgressiveCatalog,
} from "./verify-catalog-progressive-schema-local.mjs";

test("the local integration reads only local Supabase configuration", () => {
  const status = readLocalSupabaseStatus({
    cliDirectory: "/workspace/apps/pwa",
    execute: () =>
      'Using workdir /tmp/acrea\n{"API_URL":"http://127.0.0.1:56321","PUBLISHABLE_KEY":"local-key"}',
  });

  assert.deepEqual(status, {
    apiUrl: "http://127.0.0.1:56321",
    publishableKey: "local-key",
  });
});

test("the local integration refuses a non-local target before it can create an account", async () => {
  await assert.rejects(
    verifyLocalProgressiveCatalog({
      apiUrl: "https://production-ref.supabase.co",
      publishableKey: "publishable-key",
    }),
    /réservé à une cible Supabase locale/u,
  );
});

test("the preflight helper remains importable without a CLI file argument", () => {
  const scriptUrl = new URL(
    "./verify-catalog-progressive-schema-local.mjs",
    import.meta.url,
  );
  const output = execFileSync(
    process.execPath,
    [
      "--input-type=module",
      "--eval",
      `await import(${JSON.stringify(scriptUrl.href)}); console.log("imported");`,
    ],
    { encoding: "utf8" },
  );

  assert.equal(output.trim(), "imported");
});
