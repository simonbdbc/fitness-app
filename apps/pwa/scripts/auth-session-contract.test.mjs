import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import ts from "typescript";
import { fileURLToPath } from "node:url";
import { createClient } from "@supabase/supabase-js";

const projectRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
);
const fetchSourcePath = path.join(
  projectRoot,
  "src/shared/config/supabaseAuthFetch.ts",
);
const diagnosticsStubUrl =
  "data:text/javascript,export%20function%20reportTechnicalDegradationOnce()%7B%7D";
const fetchSource = (
  await fs.readFile(fetchSourcePath, "utf8")
).replace(
  '"@shared/observability/technicalDiagnostics"',
  `"${diagnosticsStubUrl}"`,
);
const compiled = ts.transpileModule(fetchSource, {
  compilerOptions: {
    module: ts.ModuleKind.ESNext,
    target: ts.ScriptTarget.ES2022,
  },
  fileName: fetchSourcePath,
}).outputText;
const {
  createSupabaseAuthFetch,
  isLocalSignOutRequest,
  isSupabaseAuthRequest,
} = await import(
  `data:text/javascript;base64,${Buffer.from(compiled).toString("base64")}`
);
const providerSource = await fs.readFile(
  path.join(projectRoot, "src/features/auth/providers/AuthProvider.tsx"),
  "utf8",
);
const clientSource = await fs.readFile(
  path.join(projectRoot, "src/shared/config/supabaseClient.ts"),
  "utf8",
);
const sessionServiceSource = await fs.readFile(
  path.join(projectRoot, "src/features/auth/services/supabaseAuthSession.ts"),
  "utf8",
);
const policySourcePath = path.join(
  projectRoot,
  "src/features/auth/domain/authPolicy.ts",
);
const policySource = await fs.readFile(policySourcePath, "utf8");
const policyCompiled = ts.transpileModule(policySource, {
  compilerOptions: {
    module: ts.ModuleKind.ESNext,
    target: ts.ScriptTarget.ES2022,
  },
  fileName: policySourcePath,
}).outputText;
const policy = await import(
  `data:text/javascript;base64,${Buffer.from(policyCompiled).toString("base64")}`
);

test("only the local Supabase logout endpoint is classified as local sign-out", () => {
  assert.equal(
    isLocalSignOutRequest(
      "https://project.supabase.co/auth/v1/logout?scope=local",
      { method: "POST" },
    ),
    true,
  );
  assert.equal(
    isLocalSignOutRequest(
      "https://project.supabase.co/auth/v1/logout?scope=global",
      { method: "POST" },
    ),
    false,
  );
  assert.equal(
    isLocalSignOutRequest("https://project.supabase.co/rest/v1/profiles", {
      method: "POST",
    }),
    false,
  );
});

test("offline local sign-out becomes a 204 so auth-js can clear storage", async () => {
  const networkError = new TypeError("Failed to fetch");
  const resilientFetch = createSupabaseAuthFetch(async () => {
    throw networkError;
  });

  const response = await resilientFetch(
    "https://project.supabase.co/auth/v1/logout?scope=local",
    { method: "POST" },
  );

  assert.equal(response.status, 204);
});

test("only Supabase Auth URLs are classified as authentication requests", () => {
  assert.equal(
    isSupabaseAuthRequest("https://project.supabase.co/auth/v1/signup"),
    true,
  );
  assert.equal(
    isSupabaseAuthRequest("https://project.supabase.co/rest/v1/profiles"),
    false,
  );
});

test("offline auth requests become retryable 503 responses", async () => {
  const resilientFetch = createSupabaseAuthFetch(async () => {
    throw new TypeError("Failed to fetch");
  });

  const response = await resilientFetch(
    "https://project.supabase.co/auth/v1/signup",
    { method: "POST" },
  );

  assert.equal(response.status, 503);
});

test("auth-js handles offline signup without logging a console error", async () => {
  const client = createClient(
    "https://project.supabase.co",
    "sb_publishable_test",
    {
      auth: {
        autoRefreshToken: false,
        detectSessionInUrl: false,
        persistSession: false,
      },
      global: {
        fetch: createSupabaseAuthFetch(async () => {
          throw new TypeError("Failed to fetch");
        }),
      },
    },
  );
  const originalConsoleError = console.error;
  const consoleErrors = [];
  console.error = (...args) => consoleErrors.push(args);

  try {
    const { error } = await client.auth.signUp({
      email: "offline@acrea.local",
      password: "offline-password",
    });

    assert.equal(error?.name, "AuthRetryableFetchError");
    assert.equal(error?.status, 503);
    assert.equal(consoleErrors.length, 0);
  } finally {
    console.error = originalConsoleError;
  }
});

test("auth-js removes its persisted session after an offline local sign-out", async () => {
  const storageKey = "sb-project-auth-token";
  const values = new Map([
    [
      storageKey,
      JSON.stringify({
        access_token: unsignedJwt({ exp: Math.floor(Date.now() / 1_000) + 3_600 }),
        expires_at: Math.floor(Date.now() / 1_000) + 3_600,
        expires_in: 3_600,
        refresh_token: "refresh-token",
        token_type: "bearer",
        user: { id: "offline-user", aud: "authenticated" },
      }),
    ],
  ]);
  const storage = {
    getItem: async (key) => values.get(key) ?? null,
    removeItem: async (key) => values.delete(key),
    setItem: async (key, value) => values.set(key, value),
  };
  const client = createClient(
    "https://project.supabase.co",
    "sb_publishable_test",
    {
      auth: {
        autoRefreshToken: false,
        detectSessionInUrl: false,
        persistSession: true,
        storage,
      },
      global: {
        fetch: createSupabaseAuthFetch(async () => {
          throw new TypeError("Failed to fetch");
        }),
      },
    },
  );

  const { error } = await client.auth.signOut({ scope: "local" });

  assert.equal(error, null);
  assert.equal(values.has(storageKey), false);
});

test("all unrelated network errors remain observable", async () => {
  const networkError = new TypeError("Failed to fetch");
  const resilientFetch = createSupabaseAuthFetch(async () => {
    throw networkError;
  });

  await assert.rejects(
    resilientFetch("https://project.supabase.co/rest/v1/profiles", {
      method: "GET",
    }),
    (error) => error === networkError,
  );
});

test("the provider requests local scope through the resilient client", () => {
  assert.match(providerSource, /signOutCurrentSupabaseSession\(\)/);
  assert.match(
    sessionServiceSource,
    /auth\.signOut\(\{ scope: "local" \}\)/,
  );
  assert.match(clientSource, /fetch: createSupabaseAuthFetch\(fetch\)/);
});

test("authorization capabilities require both a session and the expected role", () => {
  const session = { accessToken: "token", provider: "supabase" };
  const basicUser = policy.buildAuthUser({
    accountType: "basic",
    email: "basic@acrea.local",
    id: "basic",
  });
  const premiumUser = policy.buildAuthUser({
    accountType: "premium",
    email: "premium@acrea.local",
    id: "premium",
  });
  const adminUser = policy.buildAuthUser({
    accountType: "admin",
    email: "admin@acrea.local",
    id: "admin",
  });

  assert.deepEqual(policy.resolveAuthCapabilities(session, basicUser), {
    canAccessAdminCatalog: false,
    canAccessPremiumFeatures: false,
  });
  assert.deepEqual(policy.resolveAuthCapabilities(session, premiumUser), {
    canAccessAdminCatalog: false,
    canAccessPremiumFeatures: true,
  });
  assert.deepEqual(policy.resolveAuthCapabilities(session, adminUser), {
    canAccessAdminCatalog: true,
    canAccessPremiumFeatures: true,
  });
  assert.deepEqual(policy.resolveAuthCapabilities(null, adminUser), {
    canAccessAdminCatalog: false,
    canAccessPremiumFeatures: false,
  });
});

test("profile fallback is always a basic user", () => {
  const fallback = policy.buildFallbackBasicUser({
    email: "member@acrea.local",
    id: "member",
    name: "Member",
  });

  assert.equal(fallback.accountType, "basic");
  assert.equal(fallback.isAdmin, false);
  assert.equal(fallback.isPremium, false);
  assert.equal(fallback.username, "member");
});

test("unknown persisted account types fail closed to basic", () => {
  assert.equal(policy.resolveUserAccountType("basic"), "basic");
  assert.equal(policy.resolveUserAccountType("premium"), "premium");
  assert.equal(policy.resolveUserAccountType("admin"), "admin");
  assert.equal(policy.resolveUserAccountType("unknown-role"), "basic");
  assert.equal(policy.resolveUserAccountType(null), "basic");
});

test("network authentication failures use a recoverable user message", () => {
  const error = new Error("Failed to fetch");
  error.name = "AuthRetryableFetchError";

  assert.equal(
    policy.authErrorMessage(error),
    "Service d'authentification indisponible. Réessaie dans quelques instants.",
  );
});

function unsignedJwt(payload) {
  const encode = (value) => Buffer.from(JSON.stringify(value)).toString("base64url");
  return `${encode({ alg: "none", typ: "JWT" })}.${encode(payload)}.`;
}
