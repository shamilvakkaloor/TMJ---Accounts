import { collections } from "../domain/types.js";
import { emptyState } from "../domain/seed.js";

export async function loadWorkspace({ readRevision, readCollection, readCache, saveCache }, force = false) {
  const [revision, cached] = await Promise.all([
    readRevision(), force ? null : readCache().catch(() => null),
  ]);
  if (revision === -1) return { state: emptyState(), revision };
  if (cached?.revision === revision && collections.every((name) => Array.isArray(cached.state?.[name])))
    return { state: cached.state, revision };
  let expected = revision;
  for (let attempt = 0; attempt < 3; attempt++) {
    // One request per collection, all in parallel; no serial 250-row pages.
    const entries = await Promise.all(collections.map(async (name) => [name, await readCollection(name)]));
    const current = await readRevision();
    if (current === expected) {
      const snapshot = { state: Object.fromEntries(entries), revision: current };
      saveCache(snapshot);
      return snapshot;
    }
    if (current === -1) return { state: emptyState(), revision: -1 };
    expected = current;
  }
  throw new Error("Records changed while loading. Please refresh again.");
}
