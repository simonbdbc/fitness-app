import {
  createLocalDatabaseBlockedError,
  createLocalDatabaseUnavailableError,
} from "./databaseErrors";
import { reportTechnicalDegradationOnce } from "../observability/technicalDiagnostics";

type BrowserLockManager = {
  request<T>(
    name: string,
    options: { ifAvailable?: boolean; mode: "exclusive" },
    callback: (lock: unknown | null) => Promise<T> | T,
  ): Promise<T>;
};

type RuntimeLease = {
  expiresAt: number;
  instanceId: string;
};

type RuntimeLockEnvironment = {
  clearInterval: (intervalId: number) => void;
  locks?: BrowserLockManager;
  now: () => number;
  setInterval: (callback: () => void, timeoutMs: number) => number;
  storage: Pick<Storage, "getItem" | "removeItem" | "setItem">;
};

type RuntimeLockOptions = {
  createBlockedError: () => Error;
  createUnavailableError: () => Error;
  getEnvironment: () => RuntimeLockEnvironment;
  heartbeatMs: number;
  instanceId: string;
  leaseKey: string;
  leaseTtlMs: number;
  lockName: string;
};

const defaultOptions: RuntimeLockOptions = {
  createBlockedError: createLocalDatabaseBlockedError,
  createUnavailableError: createLocalDatabaseUnavailableError,
  getEnvironment: () => ({
    clearInterval: (intervalId) => window.clearInterval(intervalId),
    locks: (
      navigator as Navigator & { locks?: BrowserLockManager }
    ).locks,
    now: Date.now,
    setInterval: (callback, timeoutMs) =>
      window.setInterval(callback, timeoutMs),
    storage: window.localStorage,
  }),
  heartbeatMs: 4_000,
  instanceId: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
  leaseKey: "acrea-fitness-public-demo.sqlite-runtime-lease",
  leaseTtlMs: 12_000,
  lockName: "acrea-fitness-public-demo.sqlite.runtime",
};

export function createBrowserRuntimeLock(
  overrides: Partial<RuntimeLockOptions> = {},
) {
  const options = { ...defaultOptions, ...overrides };
  let acquirePromise: Promise<void> | null = null;
  let releaseCurrentLock: (() => void) | null = null;
  let lockRequestPromise: Promise<unknown> | null = null;

  const acquire = () => {
    if (!acquirePromise) {
      acquirePromise = acquireFromEnvironment().catch((error: unknown) => {
        acquirePromise = null;
        throw error;
      });
    }
    return acquirePromise;
  };

  const acquireFromEnvironment = async () => {
    const environment = options.getEnvironment();
    if (environment.locks) {
      await acquireWebLock(environment.locks);
    } else {
      acquireFallbackLease(environment);
    }
  };

  const acquireWebLock = async (locks: BrowserLockManager) => {
    let resolveAcquired: () => void = () => undefined;
    let rejectAcquired: (error: unknown) => void = () => undefined;
    let releaseLock: () => void = () => undefined;
    const acquiredPromise = new Promise<void>((resolve, reject) => {
      resolveAcquired = resolve;
      rejectAcquired = reject;
    });
    const releasePromise = new Promise<void>((resolve) => {
      releaseLock = resolve;
    });

    lockRequestPromise = locks.request(
      options.lockName,
      { ifAvailable: true, mode: "exclusive" },
      async (lock) => {
        if (!lock) {
          rejectAcquired(options.createBlockedError());
          return null;
        }

        releaseCurrentLock = () => {
          releaseCurrentLock = null;
          releaseLock();
        };
        resolveAcquired();
        await releasePromise;
        return null;
      },
    );
    void lockRequestPromise.catch((error: unknown) => {
      reportTechnicalDegradationOnce("local-database-web-lock", error);
      rejectAcquired(options.createUnavailableError());
    });
    await acquiredPromise;
  };

  const acquireFallbackLease = (environment: RuntimeLockEnvironment) => {
    const now = environment.now();
    const currentLease = readRuntimeLease(environment);

    if (
      currentLease &&
      currentLease.instanceId !== options.instanceId &&
      currentLease.expiresAt > now
    ) {
      throw options.createBlockedError();
    }

    writeRuntimeLease(environment, now);
    const nextLease = readRuntimeLease(environment);
    if (nextLease?.instanceId !== options.instanceId) {
      throw options.createBlockedError();
    }

    const heartbeat = environment.setInterval(() => {
      writeRuntimeLease(environment, environment.now());
    }, options.heartbeatMs);
    releaseCurrentLock = () => {
      environment.clearInterval(heartbeat);
      const activeLease = readRuntimeLease(environment);
      if (activeLease?.instanceId === options.instanceId) {
        environment.storage.removeItem(options.leaseKey);
      }
      releaseCurrentLock = null;
    };
  };

  const readRuntimeLease = (
    environment: RuntimeLockEnvironment,
  ): RuntimeLease | null => {
    try {
      const rawValue = environment.storage.getItem(options.leaseKey);
      return rawValue ? (JSON.parse(rawValue) as RuntimeLease) : null;
    } catch {
      throw options.createUnavailableError();
    }
  };

  const writeRuntimeLease = (
    environment: RuntimeLockEnvironment,
    now: number,
  ) => {
    try {
      environment.storage.setItem(
        options.leaseKey,
        JSON.stringify({
          expiresAt: now + options.leaseTtlMs,
          instanceId: options.instanceId,
        } satisfies RuntimeLease),
      );
    } catch {
      throw options.createUnavailableError();
    }
  };

  return {
    acquire,
    release() {
      releaseCurrentLock?.();
      acquirePromise = null;
      lockRequestPromise = null;
    },
  };
}
