import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import type { ReactNode } from "react";
import {
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut,
} from "firebase/auth";
import type { Command, State } from "../domain/types";
import { emptyState } from "../domain/seed";
import { uid } from "../domain/utils";
import { adminUid, auth, isDemo } from "./firebase";
import { commit, initialize, loadState } from "./repository";
type AppContext = {
  state: State;
  getCurrent: () => State;
  loading: boolean;
  error: string;
  admin: boolean;
  needsSetup: boolean;
  busy: boolean;
  toast: string;
  notify: (s: string) => void;
  run: (c: Command, id?: string) => Promise<string>;
  refresh: () => Promise<void>;
  login: (e: string, p: string) => Promise<void>;
  logout: () => Promise<void>;
  setup: () => Promise<void>;
};
const Context = createContext<AppContext>(null!);
export function Provider({ children }: { children: ReactNode }) {
  const [state, setState] = useState(emptyState),
    [revision, setRevision] = useState(0),
    [loading, setLoading] = useState(true),
    [admin, setAdmin] = useState(isDemo),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [toast, setToast] = useState("");
  const current = useRef({ state, revision });
  current.current = { state, revision };
  const pending = useRef(false);
  const notify = useCallback((s: string) => setToast(s), []);
  useEffect(() => {
    if (toast) {
      const t = setTimeout(() => setToast(""), 5000);
      return () => clearTimeout(t);
    }
  }, [toast]);
  const refresh = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const r = await loadState();
      setState(r.state);
      setRevision(r.revision);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => {
    if (isDemo) {
      void refresh();
      return;
    }
    return onAuthStateChanged(auth!, (user) => {
      const allowed = !!user && user.uid === adminUid;
      setAdmin(allowed);
      if (allowed) void refresh();
      else {
        setState(emptyState());
        setLoading(false);
      }
    });
  }, [refresh]);
  const run = async (c: Command, id: string = uid()) => {
    if (pending.current)
      throw new Error("Please wait for the current operation.");
    pending.current = true;
    setBusy(true);
    try {
      const r = await commit(
        current.current.state,
        current.current.revision,
        c,
        id,
      );
      current.current = r;
      setState(r.state);
      setRevision(r.revision);
      return id;
    } finally {
      pending.current = false;
      setBusy(false);
    }
  };
  const login = async (e: string, p: string) => {
    const user = await signInWithEmailAndPassword(auth!, e, p);
    if (user.user.uid !== adminUid) {
      await signOut(auth!);
      throw new Error("This account is not the configured administrator.");
    }
  };
  return (
    <Context.Provider
      value={{
        state,
        getCurrent: () => current.current.state,
        loading,
        error,
        admin,
        needsSetup: revision === -1,
        busy,
        toast,
        notify,
        run,
        refresh,
        login,
        logout: async () => {
          if (auth) await signOut(auth);
        },
        setup: async () => {
          await initialize();
          await refresh();
        },
      }}
    >
      {children}
    </Context.Provider>
  );
}
export const useApp = () => useContext(Context);
