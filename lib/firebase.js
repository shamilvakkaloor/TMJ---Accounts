import { initializeApp } from "https://www.gstatic.com/firebasejs/12.19.0/firebase-app.js";
import {
  getAuth,
  connectAuthEmulator,
} from "https://www.gstatic.com/firebasejs/12.19.0/firebase-auth.js";
import {
  getFirestore,
  connectFirestoreEmulator,
} from "https://www.gstatic.com/firebasejs/12.19.0/firebase-firestore.js";
import { config } from "../config.js";
export const isDemo = config.demo === true;
if (
  !isDemo &&
  (!config.firebase.apiKey || !config.firebase.projectId || !config.adminUid)
) {
  throw new Error("Complete config.js using SETUP.md before opening the app.");
}
export const app = isDemo ? null : initializeApp(config.firebase);
export const auth = app ? getAuth(app) : null;
export const db = app ? getFirestore(app) : null;
export const adminUid = config.adminUid;
if (config.emulators && auth && db) {
  if (!["localhost", "127.0.0.1"].includes(location.hostname))
    throw new Error("Emulators are restricted to localhost.");
  connectAuthEmulator(auth, "http://127.0.0.1:9099", { disableWarnings: true });
  connectFirestoreEmulator(db, "127.0.0.1", 8080);
}
