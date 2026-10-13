export type AsyncTaskQueue = ReturnType<typeof createAsyncTaskQueue>;

export function createAsyncTaskQueue() {
  let tail: Promise<void> = Promise.resolve();

  return {
    enqueue<T>(task: () => Promise<T>) {
      const taskPromise = tail.then(task, task);
      tail = taskPromise.then(
        () => undefined,
        () => undefined,
      );
      return taskPromise;
    },
    reset() {
      tail = Promise.resolve();
    },
  };
}
