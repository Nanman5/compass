/**
 * Compass — tiny in-process keyed mutex for the local JSON stores.
 *
 * The local stores (memory, family directory, drops) persist by read-modify-writing a whole
 * JSON file. Two concurrent requests touching the same file (a coach turn's addLearning +
 * addEpisode racing another request, two co-parents at once) could otherwise interleave and
 * lose a write. `withLock` serializes critical sections per key by chaining them on a promise.
 *
 * In-process only — exactly the scope of the local backend (one dev/demo server). The
 * Firestore backend doesn't need this: its writes are atomic per document.
 */

const chains = new Map<string, Promise<unknown>>();

/** Run `fn` exclusively among all `withLock` calls that share the same `key`. */
export async function withLock<T>(key: string, fn: () => Promise<T>): Promise<T> {
  const prev = chains.get(key) ?? Promise.resolve();
  // Chain after the previous holder regardless of how it settled.
  const run = prev.catch(() => {}).then(fn);
  chains.set(key, run);
  try {
    return await run;
  } finally {
    // Last one out cleans up so the map doesn't grow with one entry per family forever.
    if (chains.get(key) === run) chains.delete(key);
  }
}
