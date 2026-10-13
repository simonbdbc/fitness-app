const localDatabaseBlockedCode = "LOCAL_DATABASE_BLOCKED";
const localDatabaseUnavailableCode = "LOCAL_DATABASE_UNAVAILABLE";
const localDatabaseBlockedMessage =
  "ACREA Fitness est déjà ouvert dans une autre fenêtre ou instance. Ferme l'autre instance puis réessaie.";
const localDatabaseUnavailableMessage =
  "La base SQLite locale n'a pas pu être initialisée. Recharge l'application pour réessayer.";

export type LocalDatabaseErrorCode =
  | typeof localDatabaseBlockedCode
  | typeof localDatabaseUnavailableCode;

export type LocalDatabaseError = Error & {
  code: LocalDatabaseErrorCode;
};

export function isLocalDatabaseBlockedError(
  error: unknown,
): error is LocalDatabaseError {
  return isLocalDatabaseErrorWithCode(error, localDatabaseBlockedCode);
}

export function isLocalDatabaseUnavailableError(
  error: unknown,
): error is LocalDatabaseError {
  return isLocalDatabaseErrorWithCode(error, localDatabaseUnavailableCode);
}

export function getLocalDatabaseErrorCode(
  error: unknown,
): LocalDatabaseErrorCode | null {
  if (isLocalDatabaseBlockedError(error)) return localDatabaseBlockedCode;
  if (isLocalDatabaseUnavailableError(error)) {
    return localDatabaseUnavailableCode;
  }
  return null;
}

export function normalizeDatabaseError(error: unknown) {
  if (
    isLocalDatabaseBlockedError(error) ||
    isLocalDatabaseUnavailableError(error)
  ) {
    return error;
  }

  if (
    isAccessHandleError(error) ||
    isInvalidVfsStateError(error) ||
    isSharedArrayBufferError(error)
  ) {
    return createLocalDatabaseUnavailableError();
  }

  return error;
}

export function createLocalDatabaseBlockedError(): LocalDatabaseError {
  const error = new Error(localDatabaseBlockedMessage) as LocalDatabaseError;
  error.code = localDatabaseBlockedCode;
  return error;
}

export function createLocalDatabaseUnavailableError(): LocalDatabaseError {
  const error = new Error(
    localDatabaseUnavailableMessage,
  ) as LocalDatabaseError;
  error.code = localDatabaseUnavailableCode;
  return error;
}

function isLocalDatabaseErrorWithCode(
  error: unknown,
  code: LocalDatabaseErrorCode,
): error is LocalDatabaseError {
  return error instanceof Error && "code" in error && error.code === code;
}

function isAccessHandleError(error: unknown) {
  return (
    error instanceof Error &&
    (error.name === "NoModificationAllowedError" ||
      error.message.includes("createSyncAccessHandle") ||
      error.message.includes("Access Handles cannot be created"))
  );
}

function isInvalidVfsStateError(error: unknown) {
  return error instanceof Error && error.message.includes("Invalid VFS state");
}

function isSharedArrayBufferError(error: unknown) {
  return (
    error instanceof Error &&
    (error.message.includes("SharedArrayBuffer") ||
      error.message.includes("cross-origin isolation"))
  );
}
