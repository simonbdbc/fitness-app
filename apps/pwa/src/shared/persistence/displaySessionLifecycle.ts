import { AppState, Platform } from "react-native";

const checkpointCallbacks = new Set<() => void>();
let removeGlobalListeners: (() => void) | null = null;

export function subscribeDisplaySessionCheckpoint(callback: () => void) {
  checkpointCallbacks.add(callback);
  if (!removeGlobalListeners) removeGlobalListeners = installGlobalListeners();

  return () => {
    checkpointCallbacks.delete(callback);
    if (checkpointCallbacks.size === 0) {
      removeGlobalListeners?.();
      removeGlobalListeners = null;
    }
  };
}

function checkpointDisplaySession() {
  for (const callback of checkpointCallbacks) callback();
}

function installGlobalListeners() {
  if (Platform.OS === "web" && typeof document !== "undefined") {
    const onVisibilityChange = () => {
      if (document.visibilityState === "hidden") checkpointDisplaySession();
    };
    document.addEventListener("visibilitychange", onVisibilityChange);
    window.addEventListener("pagehide", checkpointDisplaySession);
    return () => {
      document.removeEventListener("visibilitychange", onVisibilityChange);
      window.removeEventListener("pagehide", checkpointDisplaySession);
    };
  }

  const subscription = AppState.addEventListener("change", (state) => {
    if (state !== "active") checkpointDisplaySession();
  });
  return () => subscription.remove();
}
