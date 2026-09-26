import { mkdtempSync, writeFileSync, unlinkSync, rmdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import { initializeApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { demoState } from "../src/domain/seed";
import { documents } from "../src/data/projection";
import { assert } from "../src/domain/utils";

assert(
  process.env.FIRESTORE_EMULATOR_HOST === "127.0.0.1:8080",
  "Run this check only against the local Firestore emulator on port 8080.",
);
const projectId = `demo-recovery-${Date.now()}`;
const folder = mkdtempSync(join(tmpdir(), "mahal-restore-"));
const file = join(folder, "backup.json");
const state = demoState();
writeFileSync(file, JSON.stringify({ format: "mahal-backup-v1", data: state }));
try {
  const invoke = () =>
    spawnSync(
      process.execPath,
      ["--import", "tsx", "scripts/restore.ts", file, projectId, "--apply"],
      { encoding: "utf8", env: process.env },
    );
  const first = invoke();
  assert(
    first.status === 0,
    first.stderr || first.stdout || "Restore process failed.",
  );
  console.log(first.stdout.trim());
  initializeApp({ projectId });
  const db = getFirestore();
  const expected = documents(state);
  for (const collection of await db.listCollections()) {
    if (collection.id === "meta") continue;
    for (const document of (await collection.get()).docs) {
      const source = expected[document.ref.path];
      assert(source, `Unexpected restored document: ${document.ref.path}`);
      const canonical = (value: unknown): string =>
        JSON.stringify(value, (_, v) =>
          v && typeof v === "object" && !Array.isArray(v)
            ? Object.fromEntries(
                Object.entries(v).sort(([a], [b]) => a.localeCompare(b)),
              )
            : v,
        );
      assert(
        canonical(source) === canonical(document.data()),
        `Restored data differs at ${document.ref.path}.`,
      );
    }
  }
  const repeated = invoke();
  assert(
    repeated.status !== 0 && repeated.stderr.includes("already complete"),
    "A completed restore must refuse a repeated write.",
  );
  console.log(
    `Recovery smoke test passed: ${Object.keys(expected).length} source/projection documents match; repeated restore refused.`,
  );
} finally {
  unlinkSync(file);
  rmdirSync(folder);
}
