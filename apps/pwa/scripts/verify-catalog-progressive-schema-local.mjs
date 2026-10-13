#!/usr/bin/env node

import { execFileSync } from "node:child_process";
import { randomBytes, randomUUID } from "node:crypto";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

import {
  readProgressiveCatalogSchemaContract,
  verifyProgressiveCatalogRpcContract,
} from "./verify-catalog-progressive-schema.mjs";

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
const defaultWorkdir = path.resolve(scriptDirectory, "..");

export function readLocalSupabaseStatus({
  cliDirectory = defaultWorkdir,
  execute = execFileSync,
  workdir = defaultWorkdir,
} = {}) {
  const output = execute(
    process.platform === "win32" ? "pnpm.cmd" : "pnpm",
    [
      "--dir",
      cliDirectory,
      "exec",
      "supabase",
      "status",
      "--workdir",
      workdir,
      "--output",
      "json",
    ],
    { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] },
  );
  const jsonOffset = output.indexOf("{");
  if (jsonOffset < 0) {
    throw new Error("État Supabase local illisible.");
  }
  const status = JSON.parse(output.slice(jsonOffset));
  const apiUrl = status.API_URL?.trim();
  const publishableKey = (status.PUBLISHABLE_KEY ?? status.ANON_KEY)?.trim();
  if (!apiUrl || !publishableKey) {
    throw new Error("Identifiants de test Supabase local indisponibles.");
  }
  assertLocalTarget(apiUrl);
  return { apiUrl, publishableKey };
}

export async function verifyLocalProgressiveCatalog({
  apiUrl,
  createAccount = createLocalControlAccount,
  fetchImplementation = fetch,
  publishableKey,
} = {}) {
  assertLocalTarget(apiUrl);
  const contract = readProgressiveCatalogSchemaContract();
  const authenticatedJwt = await createAccount({
    apiUrl,
    fetchImplementation,
    publishableKey,
  });
  const result = await verifyProgressiveCatalogRpcContract({
    apiUrl,
    authenticatedJwt,
    contract,
    fetchImplementation,
    publishableKey,
  });
  const oversizedResponse = await fetchImplementation(
    `${apiUrl}/rest/v1/rpc/${contract.rpc.details}`,
    {
      body: JSON.stringify({
        p_slugs: [...result.detailSlugs, result.detailSlugs[0]],
      }),
      headers: {
        apikey: publishableKey,
        Authorization: `Bearer ${authenticatedJwt}`,
        "Content-Type": "application/json",
      },
      method: "POST",
    },
  );
  if (oversizedResponse.status !== 400) {
    throw new Error(
      `Le lot ${contract.detailBatchSize + 1} doit être refusé (HTTP ${oversizedResponse.status} reçu).`,
    );
  }
  return {
    detailBatchSize: result.detailSlugs.length,
    exerciseCount: result.exerciseCount,
    releaseCode: result.releaseCode,
    sourceRevision: result.sourceRevision,
  };
}

export async function createLocalControlAccount({
  apiUrl,
  fetchImplementation,
  publishableKey,
}) {
  const response = await fetchImplementation(`${apiUrl}/auth/v1/signup`, {
    body: JSON.stringify({
      email: `catalog-progressive-${randomUUID()}@example.test`,
      password: randomBytes(24).toString("base64url"),
    }),
    headers: { apikey: publishableKey, "Content-Type": "application/json" },
    method: "POST",
  });
  const payload = await response.json().catch(() => null);
  if (!response.ok || typeof payload?.access_token !== "string") {
    throw new Error("Compte de contrôle local authentifié indisponible.");
  }
  return payload.access_token;
}

function assertLocalTarget(apiUrl) {
  const target = new URL(apiUrl);
  if (
    target.protocol !== "http:" ||
    !["127.0.0.1", "::1", "localhost"].includes(target.hostname)
  ) {
    throw new Error("Le test d'intégration est réservé à une cible Supabase locale.");
  }
}

async function main() {
  const workdir = process.env.SUPABASE_LOCAL_WORKDIR?.trim() || defaultWorkdir;
  const result = await verifyLocalProgressiveCatalog(
    readLocalSupabaseStatus({ workdir }),
  );
  console.log(
    `Intégration catalogue progressif locale OK : ${result.releaseCode} ` +
      `(${result.sourceRevision}), ${result.exerciseCount} exercices, ` +
      `lot ${result.detailBatchSize}.`,
  );
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  });
}
