#!/usr/bin/env node

import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
const contractPath = path.join(
  scriptDirectory,
  "../public/catalog-progressive-schema-contract.json",
);

export function readProgressiveCatalogSchemaContract(
  sourcePath = contractPath,
) {
  const contract = JSON.parse(readFileSync(sourcePath, "utf8"));
  if (
    contract.schemaContractVersion !== 1 ||
    typeof contract.productionProjectRef !== "string" ||
    !contract.rpc?.index ||
    !contract.rpc?.details ||
    !Number.isInteger(contract.detailBatchSize) ||
    contract.detailBatchSize < 1 ||
    !Array.isArray(contract.requiredMediaKinds)
  ) {
    throw new Error("Contrat de schéma progressif invalide.");
  }
  return contract;
}

export function readPreflightConfiguration(environment = process.env) {
  const apiUrl = requiredEnvironment(
    environment,
    "SUPABASE_SCHEMA_PREFLIGHT_URL",
  ).replace(/\/$/u, "");
  const publishableKey = requiredEnvironment(
    environment,
    "SUPABASE_SCHEMA_PREFLIGHT_PUBLISHABLE_KEY",
  );
  const authenticatedJwt = requiredEnvironment(
    environment,
    "SUPABASE_SCHEMA_PREFLIGHT_JWT",
  );
  return { apiUrl, authenticatedJwt, publishableKey };
}

export async function verifyProgressiveCatalogSchema({
  apiUrl,
  authenticatedJwt,
  contract = readProgressiveCatalogSchemaContract(),
  fetchImplementation = fetch,
  publishableKey,
}) {
  const target = new URL(apiUrl);
  const expectedHost = `${contract.productionProjectRef}.supabase.co`;
  if (target.protocol !== "https:" || target.hostname !== expectedHost) {
    throw new Error(
      `Cible Supabase incorrecte : ${target.hostname}; attendu : ${expectedHost}.`,
    );
  }

  const result = await verifyProgressiveCatalogRpcContract({
    apiUrl,
    authenticatedJwt,
    contract,
    fetchImplementation,
    publishableKey,
  });

  return {
    detailBatchSize: result.detailSlugs.length,
    exerciseCount: result.exerciseCount,
    releaseCode: result.releaseCode,
    slug: result.detailSlugs[0],
    sourceRevision: result.sourceRevision,
  };
}

export async function verifyProgressiveCatalogRpcContract({
  apiUrl,
  authenticatedJwt,
  contract = readProgressiveCatalogSchemaContract(),
  fetchImplementation = fetch,
  publishableKey,
}) {

  const authenticatedHeaders = {
    apikey: publishableKey,
    Authorization: `Bearer ${authenticatedJwt}`,
    "Content-Type": "application/json",
  };
  const anonymousHeaders = {
    apikey: publishableKey,
    Authorization: `Bearer ${publishableKey}`,
    "Content-Type": "application/json",
  };

  const index = await callRpc({
    apiUrl,
    fetchImplementation,
    headers: authenticatedHeaders,
    name: contract.rpc.index,
    payload: {},
  });
  const activeRelease = validateCatalogIndex(index, contract);
  const detailSlugs = index.exercises
    .slice(0, contract.detailBatchSize)
    .map((exercise) => exercise.slug);
  if (detailSlugs.length !== contract.detailBatchSize) {
    throw new Error("Index progressif invalide : lot de détails incomplet.");
  }

  const details = await callRpc({
    apiUrl,
    fetchImplementation,
    headers: authenticatedHeaders,
    name: contract.rpc.details,
    payload: { p_slugs: detailSlugs },
  });
  validateCatalogDetails(details, { activeRelease, contract, slugs: detailSlugs });

  await assertAnonymousAccessIsRejected({
    apiUrl,
    fetchImplementation,
    headers: anonymousHeaders,
    name: contract.rpc.index,
    payload: {},
  });
  await assertAnonymousAccessIsRejected({
    apiUrl,
    fetchImplementation,
    headers: anonymousHeaders,
    name: contract.rpc.details,
    payload: { p_slugs: detailSlugs },
  });

  return {
    detailSlugs,
    exerciseCount: index.exercises.length,
    releaseCode: activeRelease.code,
    sourceRevision: activeRelease.sourceRevision,
  };
}

async function callRpc({ apiUrl, fetchImplementation, headers, name, payload }) {
  const response = await fetchImplementation(
    `${apiUrl}/rest/v1/rpc/${name}`,
    {
      body: JSON.stringify(payload),
      headers,
      method: "POST",
    },
  );
  if (!response.ok) {
    throw new Error(`RPC ${name} indisponible : HTTP ${response.status}.`);
  }
  return response.json();
}

async function assertAnonymousAccessIsRejected({
  apiUrl,
  fetchImplementation,
  headers,
  name,
  payload,
}) {
  const response = await fetchImplementation(
    `${apiUrl}/rest/v1/rpc/${name}`,
    {
      body: JSON.stringify(payload),
      headers,
      method: "POST",
    },
  );
  if (![401, 403].includes(response.status)) {
    throw new Error(
      `La RPC ${name} doit refuser anon (HTTP ${response.status} reçu).`,
    );
  }
}

function validateCatalogIndex(payload, contract) {
  if (!isRecord(payload) || !Array.isArray(payload.releases)) {
    throw new Error("Index progressif invalide : release absente.");
  }
  const activeReleases = payload.releases.filter(
    (release) => isRecord(release) && release.status === "active",
  );
  if (activeReleases.length !== 1) {
    throw new Error("Index progressif invalide : une release active est requise.");
  }
  const activeRelease = activeReleases[0];
  if (
    typeof activeRelease.code !== "string" ||
    typeof activeRelease.sourceRevision !== "string" ||
    activeRelease.sourceRevision.length === 0
  ) {
    throw new Error("Index progressif invalide : identité de release absente.");
  }
  validateArrayLength(payload, "exercises", contract.minimumCatalog.exercises);
  validateArrayLength(payload, "pillars", contract.minimumCatalog.pillars);
  validateArrayLength(
    payload,
    "sessionTemplates",
    contract.minimumCatalog.sessionTemplates,
  );
  validateArrayLength(
    payload,
    "sessionTemplateLevels",
    contract.minimumCatalog.sessionTemplateLevels,
  );
  if (activeRelease.expectedExerciseCount !== payload.exercises.length) {
    throw new Error("Index progressif invalide : exercices actifs incohérents.");
  }
  const slugs = payload.exercises.map((exercise) => exercise?.slug);
  if (
    slugs.some((slug) => typeof slug !== "string" || slug.length === 0) ||
    new Set(slugs).size !== slugs.length
  ) {
    throw new Error("Index progressif invalide : slugs d'exercices incohérents.");
  }
  return activeRelease;
}

function validateCatalogDetails(payload, { activeRelease, contract, slugs }) {
  if (!isRecord(payload) || !Array.isArray(payload.exercises)) {
    throw new Error("Détails progressifs invalides : exercice absent.");
  }
  if (
    payload.exercises.length !== slugs.length ||
    payload.exercises.some(
      (exercise) => !isRecord(exercise) || !slugs.includes(exercise.slug),
    ) ||
    new Set(payload.exercises.map((exercise) => exercise.slug)).size !== slugs.length
  ) {
    throw new Error("Détails progressifs invalides : fiche demandée absente.");
  }
  for (const exercise of payload.exercises) {
    if (!Array.isArray(exercise.media)) {
      throw new Error("Détails progressifs invalides : médias absents.");
    }
    for (const kind of contract.requiredMediaKinds) {
      const media = exercise.media.find(
        (item) => isRecord(item) && item.kind === kind,
      );
      if (
        !isRecord(media) ||
        media.status !== "ready" ||
        typeof media.uri !== "string" ||
        !media.uri.startsWith(`library/${activeRelease.sourceRevision}/`) ||
        typeof media.sha256 !== "string" ||
        !/^[a-f0-9]{64}$/u.test(media.sha256)
      ) {
        throw new Error(`Détails progressifs invalides : média ${kind} absent ou invalide.`);
      }
    }
  }
}

function validateArrayLength(payload, property, expectedLength) {
  if (!Array.isArray(payload[property]) || payload[property].length !== expectedLength) {
    throw new Error(
      `Index progressif invalide : ${property} doit contenir ${expectedLength} élément(s).`,
    );
  }
}

function requiredEnvironment(environment, name) {
  const value = environment[name]?.trim();
  if (!value) throw new Error(`Variable CI requise : ${name}.`);
  return value;
}

function isRecord(value) {
  return typeof value === "object" && value !== null;
}

async function main() {
  const result = await verifyProgressiveCatalogSchema({
    ...readPreflightConfiguration(),
  });
  const outputPath = outputPathFromArguments(process.argv.slice(2));
  if (outputPath) {
    mkdirSync(path.dirname(outputPath), { recursive: true });
    writeFileSync(
      outputPath,
      `${JSON.stringify(
        {
          checkedAt: new Date().toISOString(),
          schemaContractVersion: readProgressiveCatalogSchemaContract()
            .schemaContractVersion,
          ...result,
        },
        null,
        2,
      )}\n`,
    );
  }
  console.log(
    `Préflight Supabase progressif OK : ${result.releaseCode} (${result.sourceRevision}), ` +
      `${result.exerciseCount} exercices, détail ${result.slug}.`,
  );
}

function outputPathFromArguments(argumentsList) {
  if (argumentsList.length === 0) return null;
  if (argumentsList.length !== 2 || argumentsList[0] !== "--output") {
    throw new Error("Usage : verify-catalog-progressive-schema.mjs [--output <fichier>].");
  }
  return path.resolve(argumentsList[1]);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  });
}
