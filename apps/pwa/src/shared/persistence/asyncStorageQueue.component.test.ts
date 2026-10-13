import { describe, expect, it } from "vitest";

import {
  enqueueAsyncStorageOperation,
  waitForAsyncStorageOperations,
} from "./asyncStorageQueue";

describe("asyncStorageQueue", () => {
  it("drains operations added while a previous drain is waiting", async () => {
    const firstRelease = deferred<void>();
    const secondRelease = deferred<void>();
    const events: string[] = [];

    const first = enqueueAsyncStorageOperation(
      "drain:first",
      async () => {
        events.push("first-start");
        await firstRelease.promise;
        events.push("first-end");
      },
      "test-first",
    );
    await Promise.resolve();

    let drained = false;
    const drain = waitForAsyncStorageOperations().then(() => {
      drained = true;
    });
    const second = enqueueAsyncStorageOperation(
      "drain:second",
      async () => {
        events.push("second-start");
        await secondRelease.promise;
        events.push("second-end");
      },
      "test-second",
    );

    firstRelease.resolve();
    await first;
    await Promise.resolve();
    expect(drained).toBe(false);

    secondRelease.resolve();
    await Promise.all([second, drain]);

    expect(events).toEqual([
      "first-start",
      "second-start",
      "first-end",
      "second-end",
    ]);
    expect(drained).toBe(true);
  });
});

function deferred<TValue>() {
  let resolve!: (value: TValue) => void;
  const promise = new Promise<TValue>((resolvePromise) => {
    resolve = resolvePromise;
  });
  return { promise, resolve };
}
