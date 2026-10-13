import * as SQLite from "expo-sqlite";
import { Platform } from "react-native";

import { reportTechnicalDegradationOnce } from "@shared/observability/technicalDiagnostics";
import { createBrowserRuntimeLock } from "./browserRuntimeLock";
import { normalizeDatabaseError } from "./databaseErrors";
import type { LocalDatabase } from "./localDatabase";
import { runLocalDatabaseMigrations } from "./migrations";
import {
  createStatementContext,
  withStatementDiagnostics,
  withStatementErrorContext,
} from "./databaseStatementDiagnostics";
import { createAsyncTaskQueue } from "./taskQueue";

export {
  getLocalDatabaseErrorCode,
  isLocalDatabaseBlockedError,
  isLocalDatabaseUnavailableError,
  type LocalDatabaseErrorCode,
} from "./databaseErrors";
export type { LocalDatabase } from "./localDatabase";

const databaseName = "acrea-fitness-public-demo.db";
let databasePromise: Promise<SQLite.SQLiteDatabase> | null = null;
const databaseTaskQueue = createAsyncTaskQueue();
const browserRuntimeLock = createBrowserRuntimeLock();
let initializedPromise: Promise<void> | null = null;
let lifecycleReleaseInstalled = false;

export async function initializeDatabase() {
  if (!initializedPromise) {
    initializedPromise = (async () => {
      await acquireRuntimeLock();
      const statementContext = createStatementContext();
      const db = withStatementDiagnostics(
        await getDatabaseConnection(),
        statementContext,
      );
      try {
        await runLocalDatabaseMigrations(db);
      } catch (error) {
        throw withStatementErrorContext(error, "operation", statementContext);
      }
    })().catch(async (error: unknown) => {
      initializedPromise = null;
      await shutdownDatabaseRuntime();
      throw normalizeDatabaseError(error);
    });
  }

  return initializedPromise;
}

export async function withDatabase<T>(
  task: (db: LocalDatabase) => Promise<T>,
): Promise<T> {
  try {
    await initializeDatabase();

    return await databaseTaskQueue.enqueue(async () => {
      const statementContext = createStatementContext();
      const db = withStatementDiagnostics(
        await getDatabaseConnection(),
        statementContext,
      );
      try {
        return await task(db);
      } catch (error) {
        throw withStatementErrorContext(error, "operation", statementContext);
      }
    });
  } catch (error) {
    throw normalizeDatabaseError(error);
  }
}

async function getDatabaseConnection() {
  if (!databasePromise) {
    databasePromise = SQLite.openDatabaseAsync(databaseName).catch(
      (error: unknown) => {
        databasePromise = null;
        throw error;
      },
    );
  }

  return databasePromise;
}

async function acquireRuntimeLock() {
  if (Platform.OS !== "web" || typeof window === "undefined") return;
  await browserRuntimeLock.acquire();
  installLifecycleRelease();
}

function installLifecycleRelease() {
  if (lifecycleReleaseInstalled) return;

  lifecycleReleaseInstalled = true;
  const release = (event?: PageTransitionEvent) => {
    if (!event?.persisted) void shutdownDatabaseRuntime();
  };

  window.addEventListener("pagehide", release);
  window.addEventListener("beforeunload", () => {
    void shutdownDatabaseRuntime();
  });
}

async function shutdownDatabaseRuntime() {
  initializedPromise = null;
  databaseTaskQueue.reset();

  const currentDatabasePromise = databasePromise;
  databasePromise = null;

  if (currentDatabasePromise) {
    const db = await currentDatabasePromise.catch((error: unknown) => {
      reportTechnicalDegradationOnce(
        "local-database-close-pending-connection",
        error,
      );
      return null;
    });
    await db?.closeAsync().catch((error: unknown) => {
      reportTechnicalDegradationOnce("local-database-close", error);
    });
  }

  browserRuntimeLock.release();
}
