import {
  GoogleAuthProvider,
  EmailAuthProvider,
  onAuthStateChanged,
  signInWithPopup,
  signInWithEmailAndPassword,
  signOut,
  linkWithPopup,
  linkWithCredential,
} from "https://www.gstatic.com/firebasejs/12.19.0/firebase-auth.js";
import { auth, isDemo } from "./firebase.js";
import { config } from "../config.js";
import { loginCredentials } from "../domain/credentials.js";
import { isAdministrator } from "../domain/access.js";
export const isAdmin = () => isDemo || isAdministrator(auth?.currentUser?.uid, config);
async function check(result) {
  if (!isAdministrator(result.user.uid, config)) {
    await signOut(auth);
    throw new Error(
      "This Google/Firebase account is not the configured administrator. Check the UID in config.js and Firestore rules.",
    );
  }
}
export function watchAuth(callback) {
  if (isDemo) {
    queueMicrotask(() => callback(true));
    return () => {};
  }
  return onAuthStateChanged(auth, () => callback(isAdmin()));
}
export async function googleLogin() {
  const provider = new GoogleAuthProvider();
  provider.setCustomParameters({ prompt: "select_account" });
  await check(await signInWithPopup(auth, provider));
}
export async function passwordLogin(id, password) {
  const credential = loginCredentials(id, password, config.login);
  await check(
    await signInWithEmailAndPassword(
      auth,
      credential.email,
      credential.password,
    ),
  );
}
export async function linkGoogle() {
  if (!isAdmin() || isDemo)
    throw new Error("Sign in as the administrator first.");
  await linkWithPopup(auth.currentUser, new GoogleAuthProvider());
}
export async function linkPassword(password) {
  if (!isAdmin() || isDemo)
    throw new Error("Sign in as the administrator first.");
  const value = loginCredentials(config.login.userId, password, config.login);
  await linkWithCredential(
    auth.currentUser,
    EmailAuthProvider.credential(value.email, value.password),
  );
}
export async function logout() {
  if (auth) await signOut(auth);
}
