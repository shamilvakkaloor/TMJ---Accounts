import { initializeApp, applicationDefault } from "firebase-admin/app";
import { v1 } from "@google-cloud/firestore";
const project = process.env.VITE_FIREBASE_PROJECT_ID;
if (!project) throw new Error("VITE_FIREBASE_PROJECT_ID is required.");
initializeApp({ projectId: project, credential: applicationDefault() });
const client = new v1.FirestoreAdminClient();
for (let attempt = 0; attempt < 60; attempt++) {
  const [indexes] = await client.listIndexes({
    parent: `projects/${project}/databases/(default)/collectionGroups/-`,
  });
  if (indexes.some((i) => i.state === "NEEDS_REPAIR" || i.state === 3))
    throw new Error("A Firestore index needs repair.");
  const pending = indexes.filter(
    (i) => i.state === "CREATING" || i.state === 1,
  );
  if (!pending.length) {
    console.log("Firestore indexes are ready.");
    process.exit(0);
  }
  console.log(`Waiting for ${pending.length} indexes…`);
  await new Promise((r) => setTimeout(r, 10000));
}
throw new Error(
  "Indexes are still building; retry deployment after they become ready.",
);
