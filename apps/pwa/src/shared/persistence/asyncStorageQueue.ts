import AsyncStorage from "@react-native-async-storage/async-storage";

import { reportTechnicalDegradationOnce } from "@shared/observability/technicalDiagnostics";

const pendingOperations = new Map<string, Promise<void>>();

export function waitForAsyncStorageOperation(key: string) {
  return pendingOperations.get(key) ?? Promise.resolve();
}

export async function waitForAsyncStorageOperations() {
  while (pendingOperations.size > 0) {
    await Promise.all([...pendingOperations.values()]);
  }
}

export async function enqueueAsyncStorageOperation(
  key: string,
  operation: () => Promise<void>,
  diagnosticScope: string,
  context: Record<string, string | number | boolean | null | undefined> = {},
) {
  const previous = waitForAsyncStorageOperation(key);
  const current = previous
    .then(operation)
    .catch((error: unknown) => {
      const diagnostics: Record<string, string | number | boolean | null> = {};
      for (const [contextKey, value] of Object.entries(context)) {
        if (value !== undefined) diagnostics[contextKey] = value;
      }
      reportTechnicalDegradationOnce(
        diagnosticScope,
        error,
        diagnostics,
      );
    })
    .finally(() => {
      if (pendingOperations.get(key) === current) {
        pendingOperations.delete(key);
      }
    });

  pendingOperations.set(key, current);
  await current;
}

export async function clearAsyncStorageKeys(keys: readonly string[]) {
  await Promise.all(keys.map(waitForAsyncStorageOperation));
  if (keys.length === 0) return;
  await AsyncStorage.multiRemove([...keys]);
}
