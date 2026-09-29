// An optional, account-scoped snapshot. It is never used without a server revision check.
const DATABASE = "mahal-startup-v1";
const MAX_AGE = 24 * 60 * 60 * 1000;
let pending, epoch = 0;
function access(mode, action) {
  return new Promise((resolve) => {
    let db, result, finished = false;
    const finish = (value) => {
      if (finished) return;
      finished = true;
      clearTimeout(timeout);
      db?.close();
      resolve(value);
    };
    // Disabled/blocked browser storage must never prevent opening the app.
    const timeout = setTimeout(() => finish(null), 800);
    try {
      const request = indexedDB.open(DATABASE, 1);
      request.onupgradeneeded = () => request.result.createObjectStore("snapshots");
      request.onerror = () => finish(null);
      request.onblocked = () => finish(null);
      request.onsuccess = () => {
        db = request.result;
        if (finished) { db.close(); return; }
        try {
          const tx = db.transaction("snapshots", mode);
          const operation = action(tx.objectStore("snapshots"));
          operation.onsuccess = () => { result = operation.result; };
          tx.oncomplete = () => finish(result);
          tx.onerror = tx.onabort = () => finish(null);
        } catch { finish(null); }
      };
    } catch { finish(null); }
  });
}
export async function readStateCache(key) {
  const cached = await access("readonly", (store) => store.get(key));
  return cached?.savedAt <= Date.now() && Date.now() - cached.savedAt < MAX_AGE ? cached : null;
}
export function saveStateCache(key, snapshot) {
  clearTimeout(pending);
  const generation = epoch;
  // Coalesce imports and avoid serializing the workspace on every row group.
  pending = setTimeout(() => {
    if (generation !== epoch) return;
    void access("readwrite", (store) => generation === epoch
      ? store.put({ ...snapshot, savedAt: Date.now() }, key)
      : store.get(key));
  }, 600);
}
export function clearStateCache() {
  epoch++;
  clearTimeout(pending);
  return access("readwrite", (store) => store.clear());
}
