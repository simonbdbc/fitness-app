import assert from "node:assert/strict";
import { test } from "node:test";

import {
  readPreflightConfiguration,
  verifyProgressiveCatalogSchema,
} from "./verify-catalog-progressive-schema.mjs";

const contract = {
  detailBatchSize: 2,
  minimumCatalog: {
    exercises: 2,
    pillars: 1,
    sessionTemplateLevels: 3,
    sessionTemplates: 2,
  },
  productionProjectRef: "production-ref",
  requiredMediaKinds: ["poster", "animation"],
  rpc: {
    details: "get_active_catalog_details",
    index: "get_active_catalog_index",
  },
  schemaContractVersion: 1,
};

const release = {
  code: "catalog-v4",
  expectedExerciseCount: 2,
  sourceRevision: "revision-123",
  status: "active",
};

const indexPayload = {
  exercises: [{ slug: "heel-to-toe-walk" }, { slug: "back-and-forth-step" }],
  pillars: [{ code: "warmup" }],
  releases: [release],
  sessionTemplateLevels: [{}, {}, {}],
  sessionTemplates: [{}, {}],
};

const detailsPayload = {
  exercises: [
    detailExercise("heel-to-toe-walk", "a", "b"),
    detailExercise("back-and-forth-step", "c", "d"),
  ],
};

test("the schema preflight validates authenticated progressive RPCs and rejects anon", async () => {
  const calls = [];
  const fetchImplementation = async (url, options) => {
    calls.push({ url, options });
    const name = url.split("/").at(-1);
    const isAuthenticated = options.headers.Authorization === "Bearer user-jwt";
    if (!isAuthenticated) return jsonResponse(403, { message: "forbidden" });
    return jsonResponse(
      200,
      name === "get_active_catalog_index" ? indexPayload : detailsPayload,
    );
  };

  const result = await verifyProgressiveCatalogSchema({
    apiUrl: "https://production-ref.supabase.co",
    authenticatedJwt: "user-jwt",
    contract,
    fetchImplementation,
    publishableKey: "publishable-key",
  });

  assert.deepEqual(result, {
    detailBatchSize: 2,
    exerciseCount: 2,
    releaseCode: "catalog-v4",
    slug: "heel-to-toe-walk",
    sourceRevision: "revision-123",
  });
  assert.equal(calls.length, 4);
  assert.deepEqual(JSON.parse(calls[1].options.body), {
    p_slugs: ["heel-to-toe-walk", "back-and-forth-step"],
  });
});

test("the schema preflight rejects an absent RPC rather than accepting a frontend deploy", async () => {
  await assert.rejects(
    verifyProgressiveCatalogSchema({
      apiUrl: "https://production-ref.supabase.co",
      authenticatedJwt: "user-jwt",
      contract,
      fetchImplementation: async () => jsonResponse(404, { code: "PGRST202" }),
      publishableKey: "publishable-key",
    }),
    /RPC get_active_catalog_index indisponible : HTTP 404/u,
  );
});

test("the schema preflight refuses a target other than the production project", async () => {
  await assert.rejects(
    verifyProgressiveCatalogSchema({
      apiUrl: "https://beta-ref.supabase.co",
      authenticatedJwt: "user-jwt",
      contract,
      fetchImplementation: async () => jsonResponse(200, indexPayload),
      publishableKey: "publishable-key",
    }),
    /Cible Supabase incorrecte/u,
  );
});

test("the preflight requires an authenticated JWT without exposing its value", () => {
  assert.throws(
    () =>
      readPreflightConfiguration({
        SUPABASE_SCHEMA_PREFLIGHT_PUBLISHABLE_KEY: "publishable-key",
        SUPABASE_SCHEMA_PREFLIGHT_URL: "https://production-ref.supabase.co",
      }),
    /SUPABASE_SCHEMA_PREFLIGHT_JWT/u,
  );
});

function jsonResponse(status, body) {
  return {
    json: async () => body,
    ok: status >= 200 && status < 300,
    status,
  };
}

function detailExercise(slug, posterHashCharacter, animationHashCharacter) {
  return {
    media: [
      {
        kind: "poster",
        sha256: posterHashCharacter.repeat(64),
        status: "ready",
        uri: `library/revision-123/warm-up/${slug}-poster.webp`,
      },
      {
        kind: "animation",
        sha256: animationHashCharacter.repeat(64),
        status: "ready",
        uri: `library/revision-123/warm-up/${slug}-animate.webp`,
      },
    ],
    slug,
  };
}
