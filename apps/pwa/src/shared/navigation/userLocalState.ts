import AsyncStorage from "@react-native-async-storage/async-storage";

import { reportTechnicalDegradationOnce } from "@shared/observability/technicalDiagnostics";
import {
  clearAsyncStorageKeys,
  clearDisplaySessionForUser,
  waitForAsyncStorageOperations,
} from "@shared/persistence";

function isUserLocalStateKey(key: string, userId: string) {
  const encodedUserId = encodeURIComponent(userId);
  const guidedTrainingPrefix = "acrea-fitness.guided-training.v1:";
  const directPrefixes = [
    "acrea-fitness.guided-training-feedback.v1:",
    "acrea-fitness.level-evaluation-feedback.v1:",
    "acrea-fitness.level-evaluation-feedback.v2:",
  ];
  const timerPrefixes = [
    "acrea-fitness.session-timer.v1:",
    "acrea-fitness.session-timer.v2:",
  ];

  return (
    key === `${guidedTrainingPrefix}${encodedUserId}` ||
    directPrefixes.some(
      (prefix) =>
        key.startsWith(prefix) &&
        key.slice(prefix.length).startsWith(`${encodedUserId}%3A`),
    ) ||
    (timerPrefixes.some((prefix) => key.startsWith(prefix)) &&
      key.includes(`%3A${encodedUserId}%3A`)) ||
    key === `acrea-fitness.timer-screen.v1:${encodedUserId}` ||
    key === `catalog-library-filter-preferences:v1:${userId}`
  );
}

export async function clearUserLocalState(
  userId: string | null | undefined,
) {
  if (!userId) return;

  try {
    await waitForAsyncStorageOperations();
    await clearDisplaySessionForUser(userId);
    const keys = await AsyncStorage.getAllKeys();
    const keysToRemove = keys.filter((key) =>
      isUserLocalStateKey(key, userId),
    );

    await clearAsyncStorageKeys(keysToRemove);
  } catch (error) {
    reportTechnicalDegradationOnce("clear-user-local-state", error, {
      userId,
    });
  }
}
