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
const queueSourcePath = path.join(
  projectRoot,
  "src/shared/db/taskQueue.ts",
);
const queueSource = await fs.readFile(queueSourcePath, "utf8");
const compiled = ts.transpileModule(queueSource, {
  compilerOptions: {
    module: ts.ModuleKind.ESNext,
    target: ts.ScriptTarget.ES2022,
  },
  fileName: queueSourcePath,
}).outputText;
const { createAsyncTaskQueue } = await import(
  `data:text/javascript;base64,${Buffer.from(compiled).toString("base64")}`
);
const errorsSourcePath = path.join(
  projectRoot,
  "src/shared/db/databaseErrors.ts",
);
const errorsSource = await fs.readFile(errorsSourcePath, "utf8");
const errorsCompiled = ts.transpileModule(errorsSource, {
  compilerOptions: {
    module: ts.ModuleKind.ESNext,
    target: ts.ScriptTarget.ES2022,
  },
  fileName: errorsSourcePath,
}).outputText;
const errorsModuleUrl = `data:text/javascript;base64,${Buffer.from(errorsCompiled).toString("base64")}`;
const databaseErrors = await import(errorsModuleUrl);
const diagnosticsStubUrl =
  "data:text/javascript,export%20function%20reportTechnicalDegradationOnce()%7B%7D";
const lockSourcePath = path.join(
  projectRoot,
  "src/shared/db/browserRuntimeLock.ts",
);
const lockSource = (
  await fs.readFile(lockSourcePath, "utf8")
)
  .replace('"./databaseErrors"', `"${errorsModuleUrl}"`)
  .replace(
    '"../observability/technicalDiagnostics"',
    `"${diagnosticsStubUrl}"`,
  );
const lockCompiled = ts.transpileModule(lockSource, {
  compilerOptions: {
    module: ts.ModuleKind.ESNext,
    target: ts.ScriptTarget.ES2022,
  },
  fileName: lockSourcePath,
}).outputText;
const { createBrowserRuntimeLock } = await import(
  `data:text/javascript;base64,${Buffer.from(lockCompiled).toString("base64")}`
);
const databaseSource = await fs.readFile(
  path.join(projectRoot, "src/shared/db/database.ts"),
  "utf8",
);

test("database tasks execute sequentially", async () => {
  const queue = createAsyncTaskQueue();
  const events = [];
  let releaseFirst;
  const firstGate = new Promise((resolve) => {
    releaseFirst = resolve;
  });

  const first = queue.enqueue(async () => {
    events.push("first:start");
    await firstGate;
    events.push("first:end");
  });
  const second = queue.enqueue(async () => {
    events.push("second");
  });

  await Promise.resolve();
  assert.deepEqual(events, ["first:start"]);
  releaseFirst();
  await Promise.all([first, second]);
  assert.deepEqual(events, ["first:start", "first:end", "second"]);
});

test("a failed task never poisons the following database task", async () => {
  const queue = createAsyncTaskQueue();
  const failure = new Error("write failed");

  await assert.rejects(
    queue.enqueue(async () => {
      throw failure;
    }),
    (error) => error === failure,
  );
  assert.equal(await queue.enqueue(async () => "recovered"), "recovered");
});

test("database runtime delegates serialization to the isolated queue", () => {
  assert.match(databaseSource, /databaseTaskQueue\.enqueue/);
  assert.match(databaseSource, /databaseTaskQueue\.reset\(\)/);
  assert.doesNotMatch(databaseSource, /let databaseQueue:/);
});

test("database error codes remain stable across the extracted boundary", () => {
  const blocked = databaseErrors.createLocalDatabaseBlockedError();
  const unavailable = databaseErrors.createLocalDatabaseUnavailableError();

  assert.equal(
    databaseErrors.getLocalDatabaseErrorCode(blocked),
    "LOCAL_DATABASE_BLOCKED",
  );
  assert.equal(
    databaseErrors.getLocalDatabaseErrorCode(unavailable),
    "LOCAL_DATABASE_UNAVAILABLE",
  );
  assert.match(unavailable.message, /Recharge l'application pour réessayer\./);
  assert.doesNotMatch(unavailable.message, /mise à jour/);
  assert.equal(databaseErrors.normalizeDatabaseError(blocked), blocked);
});

test("browser VFS failures normalize to the public unavailable error", () => {
  const accessHandleError = new Error("createSyncAccessHandle failed");
  const normalized = databaseErrors.normalizeDatabaseError(accessHandleError);

  assert.equal(
    databaseErrors.getLocalDatabaseErrorCode(normalized),
    "LOCAL_DATABASE_UNAVAILABLE",
  );
});

test("missing cross-origin isolation normalizes to the public unavailable error", () => {
  const sharedArrayBufferError = new Error(
    "SharedArrayBuffer is not defined",
  );
  const normalized = databaseErrors.normalizeDatabaseError(
    sharedArrayBufferError,
  );

  assert.equal(
    databaseErrors.getLocalDatabaseErrorCode(normalized),
    "LOCAL_DATABASE_UNAVAILABLE",
  );
});

test("a rejected Web Lock request never leaves database access pending", async () => {
  const environment = fakeRuntimeEnvironment(new Map());
  environment.locks = {
    request: async () => {
      throw new Error("Web Locks unavailable");
    },
  };
  const lock = createBrowserRuntimeLock({
    createBlockedError: databaseErrors.createLocalDatabaseBlockedError,
    createUnavailableError: databaseErrors.createLocalDatabaseUnavailableError,
    getEnvironment: () => environment,
  });

  await assert.rejects(lock.acquire(), (error) =>
    databaseErrors.isLocalDatabaseUnavailableError(error),
  );
});

test("fallback leases exclude a second browser runtime and release cleanly", async () => {
  const values = new Map();
  const environment = fakeRuntimeEnvironment(values);
  const firstLock = createBrowserRuntimeLock({
    createBlockedError: databaseErrors.createLocalDatabaseBlockedError,
    createUnavailableError: databaseErrors.createLocalDatabaseUnavailableError,
    getEnvironment: () => environment,
    instanceId: "first-runtime",
    leaseKey: "runtime-lease",
  });
  const secondLock = createBrowserRuntimeLock({
    createBlockedError: databaseErrors.createLocalDatabaseBlockedError,
    createUnavailableError: databaseErrors.createLocalDatabaseUnavailableError,
    getEnvironment: () => environment,
    instanceId: "second-runtime",
    leaseKey: "runtime-lease",
  });

  await firstLock.acquire();
  await assert.rejects(secondLock.acquire(), (error) =>
    databaseErrors.isLocalDatabaseBlockedError(error),
  );

  firstLock.release();
  await secondLock.acquire();
  assert.equal(
    JSON.parse(values.get("runtime-lease")).instanceId,
    "second-runtime",
  );
  secondLock.release();
  assert.equal(values.has("runtime-lease"), false);
});

test("an unwritable fallback lease exposes the public unavailable error", async () => {
  const environment = fakeRuntimeEnvironment(new Map());
  environment.storage.setItem = () => {
    throw new Error("storage denied");
  };
  const lock = createBrowserRuntimeLock({
    createBlockedError: databaseErrors.createLocalDatabaseBlockedError,
    createUnavailableError: databaseErrors.createLocalDatabaseUnavailableError,
    getEnvironment: () => environment,
    instanceId: "unwritable-runtime",
    leaseKey: "runtime-lease",
  });

  await assert.rejects(lock.acquire(), (error) =>
    databaseErrors.isLocalDatabaseUnavailableError(error),
  );
});

test("a corrupted fallback lease never bypasses single-runtime protection", async () => {
  const values = new Map([["runtime-lease", "{invalid-json"]]);
  const lock = createBrowserRuntimeLock({
    createBlockedError: databaseErrors.createLocalDatabaseBlockedError,
    createUnavailableError: databaseErrors.createLocalDatabaseUnavailableError,
    getEnvironment: () => fakeRuntimeEnvironment(values),
    instanceId: "safe-runtime",
    leaseKey: "runtime-lease",
  });

  await assert.rejects(lock.acquire(), (error) =>
    databaseErrors.isLocalDatabaseUnavailableError(error),
  );
});

function fakeRuntimeEnvironment(values) {
  let nextIntervalId = 0;
  return {
    clearInterval: () => undefined,
    now: () => 1_000,
    setInterval: () => {
      nextIntervalId += 1;
      return nextIntervalId;
    },
    storage: {
      getItem: (key) => values.get(key) ?? null,
      removeItem: (key) => values.delete(key),
      setItem: (key, value) => values.set(key, value),
    },
  };
}
