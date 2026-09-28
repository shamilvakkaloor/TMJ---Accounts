import { emptyState } from "../domain/seed.js";
import { commit, loadState, initialize } from "./repository.js";
import { uid } from "./browser.js";
import { watchAuth } from "./auth.js";
export const store = {
  state: emptyState(),
  revision: 0,
  admin: false,
  loading: true,
  busy: false,
  error: "",
};
export async function refresh() {
  store.error = "";
  try {
    Object.assign(store, await loadState());
  } catch (e) {
    store.error = e.message;
    throw e;
  }
}
export const ready = new Promise((resolve) => {
  let first = true;
  let authGeneration = 0;
  watchAuth(async (admin) => {
    // Keep a rejected sign-in's form mounted so its error stays visible.
    if (!first && admin === store.admin) return;
    const generation = ++authGeneration;
    store.admin = admin;
    store.loading = true;
    try {
      if (admin) {
        store.error = "";
        const loaded = await loadState();
        if (generation === authGeneration) Object.assign(store, loaded);
      }
      else {
        store.state = emptyState();
        store.error = "";
      }
    } catch (error) {
      if (generation === authGeneration) store.error = error.message;
    } finally {
      if (generation !== authGeneration) return;
      store.loading = false;
      if (first) {
        first = false;
        resolve();
      } else window.dispatchEvent(new Event("mahal-auth"));
    }
  });
});
export async function run(command, operationId = uid()) {
  if (!store.admin) throw new Error("Sign in as the administrator.");
  if (store.busy) throw new Error("Please wait for the current operation.");
  store.busy = true;
  try {
    Object.assign(
      store,
      await commit(store.state, store.revision, command, operationId),
    );
    return operationId;
  } finally {
    store.busy = false;
  }
}
export async function setup() {
  await initialize();
  await refresh();
}
