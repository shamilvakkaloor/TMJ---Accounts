import { NavLink, Outlet, useNavigate } from "react-router-dom";
import {
  BookOpen,
  CircleHelp,
  ClipboardList,
  Coins,
  ExternalLink,
  FileDown,
  HandCoins,
  Home,
  LayoutDashboard,
  LogOut,
  Menu,
  Plus,
  ReceiptText,
  RefreshCw,
  Settings,
  ShieldCheck,
  Users,
  Wallet,
  X,
} from "lucide-react";
import { useState } from "react";
import { useApp } from "../data/context";
import { isDemo } from "../data/firebase";
import { displayDate, today } from "../domain/utils";
import { ErrorBox } from "./components";
const links = [
  ["/admin", "Overview", LayoutDashboard],
  ["/admin/directory", "Members & houses", Users],
  ["/admin/funds", "Funds & dues", Coins],
  ["/admin/receipts", "Receipts", ReceiptText],
  ["/admin/accounts", "Cashbook & wallets", Wallet],
  ["/admin/reports", "Reports", BookOpen],
  ["/admin/import", "Import & backup", FileDown],
  ["/admin/audit", "Activity log", ClipboardList],
  ["/admin/settings", "Settings", Settings],
] as const;
export function Layout() {
  const { state, loading, error, toast, refresh, logout, needsSetup, setup } =
    useApp();
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();
  return (
    <div className="app-shell">
      <aside className={`sidebar ${open ? "open" : ""}`}>
        <NavLink className="brand" to="/admin">
          <div className="brand-mark">
            <Home size={25} />
          </div>
          <div>
            Mahal<span>COMMUNITY ACCOUNTS</span>
          </div>
        </NavLink>
        <button
          className="mobile-close icon-button"
          aria-label="Close navigation"
          onClick={() => setOpen(false)}
        >
          <X />
        </button>
        <div className="workspace-card">
          <div className="workspace-avatar">
            {state.settings[0].name.slice(0, 1)}
          </div>
          <div>
            <strong>{state.settings[0].name}</strong>
            <span>Central administration</span>
          </div>
          <ShieldCheck size={17} />
        </div>
        <div className="nav-caption">WORKSPACE</div>
        <nav>
          {links.map(([to, label, Icon]) => (
            <NavLink
              key={to}
              to={to}
              end={to === "/admin"}
              onClick={() => setOpen(false)}
            >
              <Icon size={19} />
              <span>{label}</span>
              {to === "/admin/receipts" && (
                <small>{state.receipts.length}</small>
              )}
            </NavLink>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <NavLink to="/" className="public-link">
            <ExternalLink size={17} /> Public member portal <span>↗</span>
          </NavLink>
          <div className="help-card">
            <CircleHelp size={19} />
            <div>
              <strong>Every collection, accounted for.</strong>
              <p>One connected record for your community.</p>
            </div>
          </div>
          <div className="admin-card">
            <div className="avatar small">A</div>
            <div>
              <strong>Administrator</strong>
              <span>{isDemo ? "Demo workspace" : "Full access"}</span>
            </div>
            <button
              className="icon-button"
              aria-label="Sign out"
              onClick={() => {
                void logout();
                navigate("/login");
              }}
            >
              <LogOut size={17} />
            </button>
          </div>
        </div>
      </aside>
      {open && <div className="sidebar-scrim" onClick={() => setOpen(false)} />}
      <div className="workspace">
        <header className="topbar">
          <div>
            <button
              className="icon-button mobile-menu"
              aria-label="Open navigation"
              onClick={() => setOpen(true)}
            >
              <Menu />
            </button>
            <span className="topbar-context">
              Central Mahal <span>/</span> Administration
            </span>
          </div>
          <div className="topbar-right">
            <span className="live-dot" />
            <span>{isDemo ? "Demo workspace" : "Connected workspace"}</span>
            <button
              className="icon-button"
              aria-label="Refresh data"
              onClick={() => void refresh()}
            >
              <RefreshCw size={17} />
            </button>
            <span className="avatar small">A</span>
          </div>
        </header>
        {isDemo && (
          <div className="demo-banner">
            <span>DEMO</span> Explore with fictional sample data. Changes stay
            in this browser.
            <NavLink to="/admin/settings">
              Set up your Mahal <ExternalLink size={12} />
            </NavLink>
          </div>
        )}
        <main className="main">
          <ErrorBox error={error} />
          {loading ? (
            <div className="loading">
              <div className="spinner" />
              Loading your workspace…
            </div>
          ) : needsSetup ? (
            <div className="setup-card">
              <Home size={40} />
              <h1>Welcome to your Mahal</h1>
              <p>
                Initialize the ten Sub Mahals and central wallets, then
                configure your community.
              </p>
              <button
                className="button primary"
                onClick={() =>
                  void setup().catch((e) => window.alert(e.message))
                }
              >
                Initialize workspace
              </button>
            </div>
          ) : (
            <Outlet />
          )}
        </main>
        <footer className="app-footer">
          <span>
            <ShieldCheck size={13} /> Mahal Accounts · Community, connected.
          </span>
          <span>{displayDate(today(state.settings[0].timezone))}</span>
        </footer>
      </div>
      {toast && (
        <div className="toast" role="status">
          <ShieldCheck size={18} />
          {toast}
        </div>
      )}
      <NavLink
        className="floating-payment"
        aria-label="Receive payment"
        to="/admin/receive"
      >
        <Plus size={21} />
        <HandCoins size={20} />
      </NavLink>
    </div>
  );
}
