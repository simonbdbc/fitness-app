import type { LocalDatabase } from "./localDatabase";

type StatementContext = {
  source: string;
};

export function createStatementContext(): StatementContext {
  return { source: "SQLite operation" };
}

export function withStatementDiagnostics(
  db: LocalDatabase,
  context: StatementContext,
): LocalDatabase {
  return {
    execAsync: (source) => {
      context.source = source;
      return withStatementContext("exec", source, () =>
        (db.execAsync as (...args: unknown[]) => Promise<unknown>).call(
          db,
          source,
        ),
      );
    },
    getAllAsync: (source, ...params) => {
      context.source = source;
      return withStatementContext("read", source, () =>
        (db.getAllAsync as (...args: unknown[]) => Promise<unknown>).call(
          db,
          source,
          ...params,
        ),
      );
    },
    getFirstAsync: (source, ...params) => {
      context.source = source;
      return withStatementContext("read", source, () =>
        (db.getFirstAsync as (...args: unknown[]) => Promise<unknown>).call(
          db,
          source,
          ...params,
        ),
      );
    },
    runAsync: (source, ...params) => {
      context.source = source;
      return withStatementContext("write", source, () =>
        (db.runAsync as (...args: unknown[]) => Promise<unknown>).call(
          db,
          source,
          ...params,
        ),
      );
    },
    withTransactionAsync: (task) => db.withTransactionAsync(task),
  } as LocalDatabase;
}

export function withStatementErrorContext(
  error: unknown,
  operation: "exec" | "read" | "write" | "operation",
  context: StatementContext,
) {
  if (!hasFinalizingStatementError(error)) return error;
  return new Error(
    `SQLite ${operation} failed for ${sqlTarget(context.source)}: Error finalizing statement`,
  );
}

async function withStatementContext<T>(
  operation: "exec" | "read" | "write",
  source: string,
  task: () => Promise<T>,
): Promise<T> {
  try {
    return await task();
  } catch (error) {
    throw withStatementErrorContext(error, operation, { source });
  }
}

function hasFinalizingStatementError(error: unknown) {
  return (
    error === "Error finalizing statement" ||
    (typeof error === "object" &&
      error !== null &&
      "message" in error &&
      typeof error.message === "string" &&
      error.message.includes("Error finalizing statement"))
  );
}

function sqlTarget(source: string) {
  const normalized = source.replace(/\s+/g, " ").trim();
  const table = normalized.match(
    /\b(?:FROM|INTO|UPDATE|TABLE)\s+([a-z_][a-z0-9_]*)/i,
  )?.[1];
  return table ? `table ${table}` : normalized.slice(0, 80);
}
