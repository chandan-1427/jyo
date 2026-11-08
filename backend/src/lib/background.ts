// Work a request or job starts without waiting for it: notifications, push
// messages, emails, deleting files, seeding demo data. Tracked so tests can
// wait until it has actually finished, instead of guessing how long it takes
// (a fixed wait failed CI on a slow runner).
const pending = new Set<Promise<unknown>>();

export function inBackground<T>(promise: Promise<T>): Promise<T> {
  pending.add(promise);
  promise.then(
    () => pending.delete(promise),
    () => pending.delete(promise)
  );
  return promise;
}

// Resolves once everything started so far, and anything it started in turn,
// has settled.
export async function backgroundSettled() {
  while (pending.size) await Promise.allSettled([...pending]);
}
