import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import ts from "typescript";
import { fileURLToPath } from "node:url";

const projectRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
);
const sourcePath = path.join(
  projectRoot,
  "src/features/pwa/services/apiHealthContract.ts",
);
const source = await fs.readFile(sourcePath, "utf8");
const providerSource = await fs.readFile(
  path.join(projectRoot, "src/features/pwa/providers/PwaProvider.tsx"),
  "utf8",
);
const connectionHealthSource = await fs.readFile(
  path.join(projectRoot, "src/features/pwa/hooks/useConnectionHealth.ts"),
  "utf8",
);
const clientConfigSource = await fs.readFile(
  path.join(projectRoot, "src/shared/config/clientConfig.ts"),
  "utf8",
);
const gitlabCiSource = await fs.readFile(
  path.join(projectRoot, "../../.gitlab-ci.yml"),
  "utf8",
);
const connectionStatusSource = await fs.readFile(
  path.join(projectRoot, "src/features/pwa/components/ConnectionStatus.tsx"),
  "utf8",
);
const compiled = ts.transpileModule(source, {
  compilerOptions: {
    module: ts.ModuleKind.ESNext,
    target: ts.ScriptTarget.ES2022,
  },
  fileName: sourcePath,
}).outputText;
const contract = await import(
  `data:text/javascript;base64,${Buffer.from(compiled).toString("base64")}`
);

test("being online never marks the API available without a healthcheck", () => {
  assert.equal(
    contract.apiStatusForConnectivity({ configured: true, online: true }),
    "checking",
  );
  assert.equal(
    contract.apiStatusForConnectivity({ configured: false, online: true }),
    "not-configured",
  );
  assert.equal(
    contract.apiStatusForConnectivity({ configured: true, online: false }),
    "unavailable",
  );
});

test("accepts only the fitness backend health payload", () => {
  assert.equal(
    contract.isExpectedApiHealthPayload({
      status: "ok",
      service: "fitness-backend",
    }),
    true,
  );
  assert.equal(
    contract.isExpectedApiHealthPayload({ status: "ok", service: "frontend" }),
    false,
  );
  assert.equal(contract.isExpectedApiHealthPayload("<!doctype html>"), false);
  assert.equal(contract.isExpectedApiHealthPayload(null), false);
});

test("connection health never promotes browser online state directly to API available", () => {
  assert.doesNotMatch(
    connectionHealthSource,
    /useState<PwaApiStatus>\(["']available["']\)/,
  );
  assert.doesNotMatch(
    connectionHealthSource,
    /setTrackedApiStatus\(isOnline\s*\?\s*["']available["']/,
  );
  assert.match(connectionHealthSource, /probeApiConnection\(apiProbeUrl\)/);
  assert.match(connectionHealthSource, /isExpectedApiHealthPayload/);
  assert.doesNotMatch(
    connectionHealthSource,
    /setInterval\(syncBrowserConnection/,
  );
  assert.match(providerSource, /useConnectionHealth\(\)/);
});

test("production API activation stays explicit", () => {
  assert.doesNotMatch(clientConfigSource, /productionApiBaseUrl/);
  assert.doesNotMatch(clientConfigSource, /acrea-fitness-api\.sbcenter\.fr/);
  assert.doesNotMatch(gitlabCiSource, /API_PRODUCTION_ORIGIN/);
});

test("connection probes are deduplicated and temporarily cached", () => {
  assert.match(connectionHealthSource, /activeConnectionProbes/);
  assert.match(connectionHealthSource, /recentConnectionProbeResults/);
  assert.match(connectionHealthSource, /failedProbeCacheDurationMs/);
});

test("API badge keeps a stable visible label", () => {
  assert.match(connectionStatusSource, />API<\/Badge>/);
  assert.doesNotMatch(connectionStatusSource, />API indisponible<\/Badge>/);
  assert.match(connectionStatusSource, /<View\s+accessible/);
  assert.match(connectionStatusSource, /accessibilityLabel=\{apiDescription\}/);
});
