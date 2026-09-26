import { readFileSync, writeFileSync } from "node:fs";
const uid = process.env.VITE_ADMIN_UID;
if (!uid || !/^[a-zA-Z0-9_-]{1,128}$/.test(uid))
  throw new Error("Set VITE_ADMIN_UID to the sole Firebase admin UID.");
const path = "firestore.rules";
const rules = readFileSync(path, "utf8");
if (rules.includes(`request.auth.uid == ${JSON.stringify(uid)}`)) {
  console.log("The admin allowlist already matches this UID.");
  process.exit(0);
}
if (!rules.includes("'REPLACE_WITH_ADMIN_UID'"))
  throw new Error(
    "Rules already contain a UID. Review the allowlist before changing it.",
  );
writeFileSync(
  path,
  rules.replace("'REPLACE_WITH_ADMIN_UID'", JSON.stringify(uid)),
);
console.log("Configured the one-admin allowlist.");
