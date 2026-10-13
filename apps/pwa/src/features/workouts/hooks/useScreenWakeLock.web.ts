import { useEffect, useId } from "react";

import { reportTechnicalDegradationOnce } from "@shared/observability/technicalDiagnostics";

const activeOwners = new Set<string>();

let requestInFlight: Promise<void> | null = null;
let retryAfterRequest = false;
let wakeLockSentinel: WakeLockSentinel | null = null;
let visibilityListenerInstalled = false;

export function useScreenWakeLock(active: boolean) {
  const ownerId = useId();

  useEffect(() => {
    if (!active) {
      return undefined;
    }

    acquireScreenWakeLock(ownerId);

    return () => {
      releaseScreenWakeLock(ownerId);
    };
  }, [active, ownerId]);
}

function acquireScreenWakeLock(ownerId: string) {
  activeOwners.add(ownerId);
  installVisibilityListener();
  requestScreenWakeLock();
}

function releaseScreenWakeLock(ownerId: string) {
  activeOwners.delete(ownerId);

  if (activeOwners.size > 0) {
    return;
  }

  removeVisibilityListener();
  retryAfterRequest = false;
  void releaseCurrentSentinel();
}

function requestScreenWakeLock() {
  if (
    activeOwners.size === 0 ||
    !isWakeLockAvailable() ||
    document.visibilityState !== "visible" ||
    (wakeLockSentinel && !wakeLockSentinel.released)
  ) {
    return;
  }

  if (requestInFlight) {
    retryAfterRequest = true;
    return;
  }

  requestInFlight = navigator.wakeLock
    .request("screen")
    .then(async (sentinel) => {
      if (
        activeOwners.size === 0 ||
        document.visibilityState !== "visible"
      ) {
        await releaseSentinel(sentinel);
        return;
      }

      wakeLockSentinel = sentinel;
      sentinel.addEventListener("release", handleSentinelRelease);
    })
    .catch((error: unknown) => {
      reportTechnicalDegradationOnce("screen-wake-lock-request", error);
    })
    .finally(() => {
      const shouldRetry = retryAfterRequest;
      retryAfterRequest = false;
      requestInFlight = null;

      if (shouldRetry) {
        requestScreenWakeLock();
      }
    });
}

async function releaseCurrentSentinel() {
  const sentinel = wakeLockSentinel;
  wakeLockSentinel = null;

  if (!sentinel) {
    return;
  }

  sentinel.removeEventListener("release", handleSentinelRelease);

  if (!sentinel.released) {
    await releaseSentinel(sentinel);
  }
}

async function releaseSentinel(sentinel: WakeLockSentinel) {
  try {
    await sentinel.release();
  } catch (error) {
    reportTechnicalDegradationOnce("screen-wake-lock-release", error);
  }
}

function handleSentinelRelease() {
  if (wakeLockSentinel) {
    wakeLockSentinel.removeEventListener("release", handleSentinelRelease);
    wakeLockSentinel = null;
  }

  requestScreenWakeLock();
}

function handleVisibilityChange() {
  if (document.visibilityState === "visible") {
    requestScreenWakeLock();
    return;
  }

  void releaseCurrentSentinel();
}

function installVisibilityListener() {
  if (visibilityListenerInstalled || typeof document === "undefined") {
    return;
  }

  document.addEventListener("visibilitychange", handleVisibilityChange);
  visibilityListenerInstalled = true;
}

function removeVisibilityListener() {
  if (!visibilityListenerInstalled || typeof document === "undefined") {
    return;
  }

  document.removeEventListener("visibilitychange", handleVisibilityChange);
  visibilityListenerInstalled = false;
}

function isWakeLockAvailable(): boolean {
  return (
    typeof document !== "undefined" &&
    typeof navigator !== "undefined" &&
    "wakeLock" in navigator
  );
}
