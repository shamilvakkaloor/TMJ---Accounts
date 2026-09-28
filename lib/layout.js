import { el, link, button, alertBox, showError } from "./dom.js";
import { store, refresh } from "./store.js";
import { logout } from "./auth.js";
import { isDemo } from "./firebase.js";
export const navLinks = [
  ["/admin", "Overview"],
  ["/admin/directory", "Members & houses"],
  ["/admin/funds", "Funds & dues"],
  ["/admin/receipts", "Receipts"],
  ["/admin/accounts", "Cashbook & wallets"],
  ["/admin/reports", "Reports"],
  ["/admin/import", "Import & backup"],
  ["/admin/audit", "Activity log"],
  ["/admin/settings", "Settings"],
];
export function layout(content, path, redraw) {
  const s = store.state.settings[0],
    error = alertBox();
  const sidebar = el("aside", { class: "sidebar" });
  const scrim = el("div", {
    class: "sidebar-scrim",
    hidden: true,
    onClick: () => toggle(false),
  });
  function toggle(open) {
    sidebar.classList.toggle("open", open);
    scrim.hidden = !open;
  }
  sidebar.append(
    link(
      el("div", {}, "Mahal", el("span", {}, "COMMUNITY ACCOUNTS")),
      "/admin",
      "brand",
    ),
    button("×", () => toggle(false), "mobile-close icon-button", {
      "aria-label": "Close navigation",
    }),
    el(
      "div",
      { class: "workspace-card" },
      el("div", { class: "workspace-avatar" }, s.name[0]),
      el(
        "div",
        {},
        el("strong", {}, s.name),
        el("span", {}, "Central administration"),
      ),
    ),
    el("div", { class: "nav-caption" }, "WORKSPACE"),
    el(
      "nav",
      {},
      navLinks.map(([route, label]) =>
        link(label, route, path === route ? "active" : ""),
      ),
    ),
    el(
      "div",
      { class: "sidebar-bottom" },
      link("Public member portal ↗", "/", "public-link"),
      el(
        "div",
        { class: "help-card" },
        el("p", {}, "Every contribution, accounted for."),
      ),
      el(
        "div",
        { class: "admin-card" },
        el("span", { class: "avatar small" }, "A"),
        el("strong", {}, "Administrator"),
        button(
          "↪",
          async () => {
            await logout();
            location.hash = "/login";
          },
          "icon-button",
          { "aria-label": "Sign out" },
        ),
      ),
    ),
  );
  const top = el(
    "header",
    { class: "topbar" },
    el(
      "div",
      {},
      button("☰", () => toggle(true), "icon-button mobile-menu", {
        "aria-label": "Open navigation",
      }),
      el("span", { class: "topbar-context" }, "Central Mahal / Administration"),
    ),
    el(
      "div",
      { class: "topbar-right" },
      el("span", { class: "live-dot" }),
      isDemo ? "Demo workspace" : "Connected workspace",
      button(
        "↻",
        async () => {
          try {
            await refresh();
            redraw();
          } catch (e) {
            showError(error, e);
          }
        },
        "icon-button",
        { "aria-label": "Refresh data" },
      ),
    ),
  );
  return el(
    "div",
    { class: "app-shell" },
    sidebar,
    scrim,
    el(
      "div",
      { class: "workspace" },
      top,
      isDemo &&
        el(
          "div",
          { class: "demo-banner" },
          el("strong", {}, "DEMO"),
          " Fictional data stored only in this browser.",
        ),
      el("main", { class: "main" }, error, content),
      el(
        "footer",
        { class: "app-footer" },
        "Mahal Accounts · Community, connected.",
      ),
    ),
  );
}
