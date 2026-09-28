// Optional administrator recovery utility. Node 22+ built-ins only; no npm packages.
import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { validateBackup } from "../domain/backup.js";
import { documents } from "../domain/projection.js";
import { config } from "../config.js";
const [file, project, ...flags] = process.argv.slice(2);
if (!file || !project)
  throw new Error(
    "Usage: node tools/restore.mjs backup.json RECOVERY_PROJECT_ID [--apply]",
  );
if (!/^[a-z][a-z0-9-]{4,62}$/.test(project))
  throw new Error("Invalid recovery project ID.");
if (flags.some((f) => f !== "--apply")) throw new Error("Unknown option.");
const raw = readFileSync(file, "utf8"),
  state = validateBackup(JSON.parse(raw)),
  records = documents(state);
records["meta/revision"] = { value: 0, lastOperation: "recovery" };
const entries = Object.entries(records).sort(([a], [b]) => a.localeCompare(b)),
  hash = createHash("sha256").update(raw).digest("hex");
console.log(
  `Validated backup: ${state.members.length} members, ${state.receipts.length} receipts, ${entries.length} documents.`,
);
if (!flags.includes("--apply")) {
  console.log("Validation only. No database was contacted or changed.");
  process.exit(0);
}
if (project === config.firebase.projectId)
  throw new Error(
    "Recovery must use a separate empty project, never the configured live project.",
  );
const emulator = process.env.FIRESTORE_EMULATOR_HOST;
if (
  emulator &&
  (!/^(127\.0\.0\.1|localhost):\d+$/.test(emulator) ||
    !project.startsWith("demo-"))
)
  throw new Error(
    "Emulator recovery requires localhost and a demo- project ID.",
  );
const token = process.env.GOOGLE_OAUTH_ACCESS_TOKEN;
if (!emulator && !token)
  throw new Error(
    "Set GOOGLE_OAUTH_ACCESS_TOKEN from your authorized Google Cloud CLI session; see SETUP.md.",
  );
const host = emulator
    ? `http://${emulator}`
    : "https://firestore.googleapis.com",
  root = `projects/${project}/databases/(default)/documents`,
  marker = "_recovery/session";
async function api(path, body, method = "POST") {
  const response = await fetch(`${host}/v1/${path}`, {
    method,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${emulator ? "owner" : token}`,
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const data = await response.json();
  if (!response.ok) {
    const e = new Error(
      `${response.status}: ${data.error?.message || "Firestore request failed"}`,
    );
    e.status = response.status;
    throw e;
  }
  return data;
}
function encode(value) {
  if (value === null) return { nullValue: null };
  if (typeof value === "string") return { stringValue: value };
  if (typeof value === "boolean") return { booleanValue: value };
  if (typeof value === "number")
    return Number.isInteger(value)
      ? { integerValue: String(value) }
      : { doubleValue: value };
  if (Array.isArray(value))
    return { arrayValue: { values: value.map(encode) } };
  return {
    mapValue: {
      fields: Object.fromEntries(
        Object.entries(value).map(([k, v]) => [k, encode(v)]),
      ),
    },
  };
}
function decode(value) {
  if ("nullValue" in value) return null;
  if ("stringValue" in value) return value.stringValue;
  if ("booleanValue" in value) return value.booleanValue;
  if ("integerValue" in value) return Number(value.integerValue);
  if ("doubleValue" in value) return value.doubleValue;
  if ("arrayValue" in value) return (value.arrayValue.values || []).map(decode);
  if ("mapValue" in value)
    return Object.fromEntries(
      Object.entries(value.mapValue.fields || {}).map(([k, v]) => [
        k,
        decode(v),
      ]),
    );
  throw new Error("Unexpected Firestore value type in recovery verification.");
}
const fields = (value) =>
  Object.fromEntries(Object.entries(value).map(([k, v]) => [k, encode(v)]));
const canonical = (value) =>
  JSON.stringify(value, (_, v) =>
    v && typeof v === "object" && !Array.isArray(v)
      ? Object.fromEntries(
          Object.entries(v).sort(([a], [b]) => a.localeCompare(b)),
        )
      : v,
  );
let session, updateTime;
try {
  const doc = await api(`${root}/${marker}`, undefined, "GET");
  session = decode({ mapValue: { fields: doc.fields } });
  updateTime = doc.updateTime;
} catch (e) {
  if (e.status !== 404) throw e;
}
if (session) {
  if (
    session.hash !== hash ||
    session.project !== project ||
    session.total !== entries.length
  )
    throw new Error("Recovery marker belongs to a different backup/project.");
  if (session.status === "complete")
    throw new Error(
      "This recovery was already completed; refusing to overwrite later changes.",
    );
} else {
  const existing = await api(`${root}:listCollectionIds`, { pageSize: 1 });
  if (existing.collectionIds?.length)
    throw new Error("Recovery database is not empty. No data was changed.");
  session = {
    hash,
    project,
    total: entries.length,
    completed: 0,
    status: "running",
    startedAt: new Date().toISOString(),
  };
  const result = await api(`${root}:commit`, {
    writes: [
      {
        update: { name: `${root}/${marker}`, fields: fields(session) },
        currentDocument: { exists: false },
      },
    ],
  });
  updateTime = result.writeResults[0].updateTime;
}
for (let i = session.completed; i < entries.length; i += 200) {
  const batch = entries.slice(i, i + 200),
    next = { ...session, completed: i + batch.length };
  const result = await api(`${root}:commit`, {
    writes: [
      ...batch.map(([path, data]) => ({
        update: { name: `${root}/${path}`, fields: fields(data) },
        currentDocument: { exists: false },
      })),
      {
        update: { name: `${root}/${marker}`, fields: fields(next) },
        currentDocument: { updateTime },
      },
    ],
  });
  session = next;
  updateTime = result.writeResults.at(-1).updateTime;
  console.log(`Restored ${session.completed}/${entries.length} documents.`);
}
for (let i = 0; i < entries.length; i += 100) {
  const batch = entries.slice(i, i + 100),
    result = await api(`${root}:batchGet`, {
      documents: batch.map(([path]) => `${root}/${path}`),
    });
  const found = new Map(
    result
      .filter((r) => r.found)
      .map((r) => [
        r.found.name,
        decode({ mapValue: { fields: r.found.fields } }),
      ]),
  );
  for (const [path, expected] of batch)
    if (canonical(found.get(`${root}/${path}`)) !== canonical(expected))
      throw new Error(`Recovery verification mismatch: ${path}`);
}
await api(`${root}:commit`, {
  writes: [
    {
      update: {
        name: `${root}/${marker}`,
        fields: fields({
          ...session,
          status: "complete",
          verifiedAt: new Date().toISOString(),
        }),
      },
      currentDocument: { updateTime },
    },
  ],
});
console.log(
  "Recovery verified. Configure Auth, administrator UID, rules and indexes for the recovery project separately before using it.",
);
