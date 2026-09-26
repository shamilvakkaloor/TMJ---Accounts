import React from "react";
import ReactDOM from "react-dom/client";
import {
  HashRouter,
  Link,
  Navigate,
  Outlet,
  Route,
  Routes,
  useNavigate,
} from "react-router-dom";
import { Home, ShieldCheck } from "lucide-react";
import { Provider, useApp } from "./data/context";
import { isDemo } from "./data/firebase";
import { Layout } from "./ui/Layout";
import { AsyncForm, Field, str } from "./ui/components";
const Dashboard = React.lazy(() =>
  import("./pages/Dashboard").then((m) => ({ default: m.Dashboard })),
);
const Directory = React.lazy(() =>
  import("./pages/Directory").then((m) => ({ default: m.Directory })),
);
const Funds = React.lazy(() =>
  import("./pages/Funds").then((m) => ({ default: m.Funds })),
);
const Payments = React.lazy(() =>
  import("./pages/Payments").then((m) => ({ default: m.Payments })),
);
const ReceiptPage = React.lazy(() =>
  import("./pages/Receipts").then((m) => ({ default: m.ReceiptPage })),
);
const Receipts = React.lazy(() =>
  import("./pages/Receipts").then((m) => ({ default: m.Receipts })),
);
const Accounts = React.lazy(() =>
  import("./pages/Accounts").then((m) => ({ default: m.Accounts })),
);
const Audit = React.lazy(() =>
  import("./pages/Reports").then((m) => ({ default: m.Audit })),
);
const Reports = React.lazy(() =>
  import("./pages/Reports").then((m) => ({ default: m.Reports })),
);
const SettingsPage = React.lazy(() =>
  import("./pages/Settings").then((m) => ({ default: m.SettingsPage })),
);
const PublicHome = React.lazy(() =>
  import("./pages/Public").then((m) => ({ default: m.PublicHome })),
);
const PublicProfile = React.lazy(() =>
  import("./pages/Public").then((m) => ({ default: m.PublicProfile })),
);
const CardPage = React.lazy(() =>
  import("./pages/Public").then((m) => ({ default: m.CardPage })),
);
const ImportPage = React.lazy(() =>
  import("./pages/Import").then((m) => ({ default: m.ImportPage })),
);
import "./styles.css";
function Guard() {
  const { admin, loading } = useApp();
  return loading ? (
    <div className="loading">Opening your workspace…</div>
  ) : admin ? (
    <Outlet />
  ) : (
    <Navigate to="/login" replace />
  );
}
function Login() {
  const { login, admin } = useApp();
  const navigate = useNavigate();
  return (
    <div className="login-page">
      <Link className="public-brand" to="/">
        <div className="brand-mark">
          <Home />
        </div>
        <strong>Mahal Accounts</strong>
      </Link>
      <section className="panel login-panel">
        <div className="login-icon">
          <ShieldCheck size={28} />
        </div>
        <h1>Welcome back.</h1>
        <p>Sign in to manage your community's accounts.</p>
        {admin ? (
          <>
            <div className="hint-box">
              {isDemo
                ? "The isolated demo is ready. No password is needed."
                : "You are signed in."}
            </div>
            <Link className="button primary full" to="/admin">
              Open workspace →
            </Link>
          </>
        ) : (
          <AsyncForm
            submit="Sign in securely"
            onSubmit={async (f) => {
              await login(str(f, "email"), str(f, "password"));
              navigate("/admin");
            }}
          >
            <Field label="Email">
              <input
                name="email"
                type="email"
                autoComplete="username"
                required
              />
            </Field>
            <Field label="Password">
              <input
                name="password"
                type="password"
                autoComplete="current-password"
                required
              />
            </Field>
          </AsyncForm>
        )}
        <Link className="back-link" to="/">
          ← Public member portal
        </Link>
      </section>
      <small>One community. Every contribution accounted for.</small>
    </div>
  );
}
class ErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { error: string }
> {
  state = { error: "" };
  static getDerivedStateFromError(e: Error) {
    return { error: e.message };
  }
  render() {
    return this.state.error ? (
      <div className="standalone">
        <h1>Something went wrong</h1>
        <p>{this.state.error}</p>
        <button className="button primary" onClick={() => location.reload()}>
          Reload workspace
        </button>
      </div>
    ) : (
      this.props.children
    );
  }
}
ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <ErrorBoundary>
      <HashRouter>
        <Provider>
          <React.Suspense
            fallback={<div className="loading">Opening page…</div>}
          >
            <Routes>
              <Route path="/" element={<PublicHome />} />
              <Route path="/login" element={<Login />} />
              <Route path="/p/:type/:id" element={<PublicProfile />} />
              <Route path="/receipt/:id" element={<ReceiptPage />} />
              <Route element={<Guard />}>
                <Route path="/card/:type/:id" element={<CardPage />} />
                <Route path="/admin" element={<Layout />}>
                  <Route index element={<Dashboard />} />
                  <Route path="directory" element={<Directory />} />
                  <Route path="funds" element={<Funds />} />
                  <Route path="receive" element={<Payments />} />
                  <Route path="receipts" element={<Receipts />} />
                  <Route path="accounts" element={<Accounts />} />
                  <Route path="reports" element={<Reports />} />
                  <Route path="audit" element={<Audit />} />
                  <Route path="import" element={<ImportPage />} />
                  <Route path="settings" element={<SettingsPage />} />
                </Route>
              </Route>
              <Route
                path="*"
                element={
                  <div className="standalone">
                    <h1>Page not found</h1>
                    <Link to="/">Go to the Mahal portal</Link>
                  </div>
                }
              />
            </Routes>
          </React.Suspense>
        </Provider>
      </HashRouter>
    </ErrorBoundary>
  </React.StrictMode>,
);
