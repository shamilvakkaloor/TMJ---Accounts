import { readFileSync } from "node:fs";
import { applicationDefault, initializeApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { validateBackup } from "../src/domain/backup";
import { documents } from "../src/data/projection";
const [file, projectId, mode] = process.argv.slice(2);
if (!file || !projectId)
  throw new Error(
    "Usage: npx tsx scripts/restore.ts backup.json target-project [--apply]",
  );
const state = validateBackup(JSON.parse(readFileSync(file, "utf8")));
const docs = documents(state);
console.log(
  `Validated ${Object.keys(docs).length} documents, ${state.members.length} members and ${state.receipts.length} receipts for ${projectId}.`,
);
if (mode !== "--apply") {
  console.log("Validation only. Add --apply to restore into an empty project.");
  process.exit(0);
}
initializeApp({ projectId, credential: applicationDefault() });
const db = getFirestore();
const marker = db.doc("meta/restore");
const existing = await marker.get();
if (!existing.exists && (await db.listCollections()).length)
  throw new Error(
    "Target is not empty. Restore into a new test/recovery project.",
  );
const { createHash } = await import("node:crypto");
const hash = createHash("sha256").update(JSON.stringify(state)).digest("hex");
if (existing.exists && existing.data()!.hash !== hash)
  throw new Error("This target has a different in-progress restore.");
if (existing.exists && existing.data()!.status === "complete")
  throw new Error(
    "This restore is already complete. Use a new empty project for another restore.",
  );
await marker.set(
  { hash, status: "running", startedAt: new Date().toISOString() },
  { merge: true },
);
const entries = Object.entries(docs);
for (let i = 0; i < entries.length; i += 200) {
  const batch = db.batch();
  for (const [path, data] of entries.slice(i, i + 200))
    batch.set(db.doc(path), data);
  await batch.commit();
  console.log(
    `Restored ${Math.min(i + 200, entries.length)} / ${entries.length}`,
  );
}
await db.doc("meta/revision").set({ value: 0, lastOperation: "restored" });
let count = 0;
for (const collection of await db.listCollections())
  count += (await collection.count().get()).data().count;
if (count !== entries.length + 2)
  throw new Error(
    `Verification failed: expected ${entries.length + 2} documents, found ${count}.`,
  );
await marker.set({
  hash,
  status: "complete",
  completedAt: new Date().toISOString(),
});
console.log(
  `Restore verified: ${count} documents. Deploy rules and indexes separately, then reconcile wallet and dues totals.`,
);
