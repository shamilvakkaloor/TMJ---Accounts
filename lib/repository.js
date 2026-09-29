import {
  collection,
  doc,
  documentId,
  getDoc,
  getDocFromServer,
  getDocs,
  getDocsFromServer,
  limit,
  orderBy,
  query,
  runTransaction,
  startAfter,
  where,
  writeBatch,
} from "https://www.gstatic.com/firebasejs/12.19.0/firebase-firestore.js";
import { execute } from "../domain/engine.js";
import { demoState, emptyState } from "../domain/seed.js";
import { assert, norm } from "../domain/utils.js";
import { changes, documents } from "../domain/projection.js";
import { auth, db, isDemo } from "./firebase.js";
import { loadWorkspace } from "./load-state.js";
import { readStateCache, saveStateCache } from "./state-cache.js";
const KEY = "mahal-accounts-demo-v1-final";
export const demoRead = () => {
  const data = localStorage.getItem(KEY);
  if (data) return JSON.parse(data);
  const s = demoState();
  localStorage.setItem(KEY, JSON.stringify(s));
  return s;
};
const cacheKey = () => `${db.app.options.projectId}:${auth.currentUser.uid}`;
export function cacheWorkspace(snapshot) {
  if (!isDemo && auth?.currentUser) saveStateCache(cacheKey(), snapshot);
}
export async function loadState({ force = false } = {}) {
  if (isDemo) return { state: demoRead(), revision: 0 };
  const key = cacheKey();
  return loadWorkspace({
    readRevision: async () => {
      const meta = await getDocFromServer(doc(db, "meta/revision"));
      return meta.exists() ? meta.data().value : -1;
    },
    readCollection: async (name) => (await getDocsFromServer(collection(db, name))).docs.map((d) => d.data()),
    readCache: () => readStateCache(key),
    saveCache: (snapshot) => {
      if (auth.currentUser && cacheKey() === key) saveStateCache(key, snapshot);
    },
  }, force);
}
export async function initialize() {
  if (isDemo) return;
  const s = emptyState();
  const records = documents(s);
  await runTransaction(db, async (tx) => {
    const ref = doc(db, "meta/revision");
    const snap = await tx.get(ref);
    assert(!snap.exists(), "Already initialized.");
    for (const [p, v] of Object.entries(records)) tx.set(doc(db, p), v);
    tx.set(ref, { value: 0, lastOperation: "bootstrap" });
  });
}
export async function commit(state, revision, cmd, operationId) {
  const now = new Date().toISOString();
  if (isDemo) {
    const go = () => {
      const current = demoRead();
      const next = execute(current, cmd, {
        operationId,
        now,
        actor: "demo-admin",
      });
      localStorage.setItem(KEY, JSON.stringify(next));
      return { state: next, revision: 0 };
    };
    return navigator.locks
      ? navigator.locks.request("mahal-demo-write", go)
      : go();
  }
  assert(navigator.onLine, "Connect to the internet to post this operation.");
  assert(auth?.currentUser, "Sign in to continue.");
  const next = execute(state, cmd, {
    operationId,
    now,
    actor: auth.currentUser.uid,
  });
  if (next === state) return { state, revision };
  const patch = changes(documents(state), documents(next));
  // Privacy edits may refresh many identities; finance is always one bounded transaction.
  const delayed =
    cmd.type === "saveSettings" || cmd.type === "saveSubMahal"
      ? patch.filter(
          ([p]) =>
            p.startsWith("publicMembers/") || p.startsWith("publicHouses/"),
        )
      : [];
  const atomic = patch.filter(([p]) => !delayed.some(([d]) => d === p));
  assert(
    atomic.length <= 400,
    "This edit touches too many records. Use the import workflow in smaller chunks.",
  );
  if (["importHouseBatch", "importMemberBatch"].includes(cmd.type)) {
    // Rules require revision+1 and a fresh immutable audit marker. A single
    // write batch therefore rejects concurrent/stale imports without read trips.
    const batch = writeBatch(db);
    for (const [p, v] of atomic) batch.set(doc(db, p), v);
    batch.update(doc(db, "meta/revision"), { value: revision + 1, lastOperation: operationId });
    try {
      await batch.commit();
    } catch (error) {
      // A lost acknowledgement can mean the whole group already committed.
      if ((await getDoc(doc(db, "operations", operationId))).exists()) return loadState();
      throw error;
    }
    return { state: next, revision: revision + 1 };
  }
  const result = await runTransaction(db, async (tx) => {
    const opRef = doc(db, "operations", operationId);
    const existing = await tx.get(opRef);
    if (existing.exists()) return false;
    const metaRef = doc(db, "meta/revision");
    const snap = await tx.get(metaRef);
    assert(snap.exists(), "Complete first-run setup.");
    assert(
      snap.data().value === revision,
      "The data changed in another tab. Refresh and retry; no changes were posted.",
    );
    for (const [p, v] of atomic) {
      if (v === null) {
        assert(cmd.type === "deleteSubMahal" && p === `subMahals/${cmd.id}`, "Unsupported document deletion.");
        tx.delete(doc(db, p));
      } else tx.set(doc(db, p), v);
    }
    tx.update(metaRef, { value: revision + 1, lastOperation: operationId });
    return true;
  });
  if (!result) return loadState();
  try {
    for (let i = 0; i < delayed.length; i += 8) {
      const batch = writeBatch(db);
      for (const [p, v] of delayed.slice(i, i + 8)) batch.set(doc(db, p), v);
      await batch.commit();
    }
  } catch {
    throw new Error(
      "Settings were saved, but publication was interrupted. Refresh this page, then use Settings → Refresh public profiles.",
    );
  }
  return { state: next, revision: revision + 1 };
}
export async function rebuildPublic() {
  if (isDemo) return;
  const { state } = await loadState();
  const rows = Object.entries(documents(state)).filter(([p]) =>
    p.startsWith("public"),
  );
  for (let i = 0; i < rows.length; i += 8) {
    const batch = writeBatch(db);
    for (const [p, v] of rows.slice(i, i + 8)) batch.set(doc(db, p), v);
    await batch.commit();
  }
}
export async function publicDoc(col, id) {
  if (isDemo) return documents(demoRead())[`${col}/${id}`] ?? null;
  const s = await getDoc(doc(db, col, id));
  return s.exists() ? s.data() : null;
}
export async function publicSearch(type, text, field) {
  const col = type === "member" ? "publicMembers" : "publicHouses";
  const settings = await publicDoc("publicSettings", "mahal");
  const key =
    field === "id"
      ? type === "member" ? text.trim() : text.toUpperCase()
      : field === "phoneKey"
        ? text.replace(/\D/g, "")
        : norm(text);
  if (key.length < 2) return [];
  if (isDemo)
    return Object.entries(documents(demoRead()))
      .filter(
        ([p, v]) =>
          p.startsWith(col + "/") &&
          String(v[field] ?? "").startsWith(key) &&
          v.version === settings?.version,
      )
      .slice(0, 20)
      .map(([, v]) => v);
  return (
    await getDocs(
      query(
        collection(db, col),
        where("version", "==", settings.version),
        where(field, ">=", key),
        where(field, "<=", key + "\uf8ff"),
        orderBy(field),
        limit(20),
      ),
    )
  ).docs.map((d) => d.data());
}
export async function publicList(col, payerId, after = "") {
  if (isDemo)
    return Object.entries(documents(demoRead()))
      .filter(
        ([p, v]) =>
          p.startsWith(col + "/") &&
          v.payerId === payerId &&
          String(v.id) > after,
      )
      .map(([, v]) => v)
      .sort((a, b) => String(a.id).localeCompare(String(b.id)))
      .slice(0, 100);
  const constraints = [where("payerId", "==", payerId), orderBy(documentId())];
  if (after) constraints.push(startAfter(after));
  return (
    await getDocs(query(collection(db, col), ...constraints, limit(100)))
  ).docs.map((d) => d.data());
}
export function resetDemo() {
  localStorage.setItem(KEY, JSON.stringify(demoState()));
}
export { validateBackup } from "../domain/backup.js";
export function restoreDemo(s) {
  assert(isDemo, "Live restore uses the offline restore script.");
  localStorage.setItem(KEY, JSON.stringify(s));
}
