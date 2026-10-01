import { el, link, button, alertBox, showError } from "./dom.js";
import { store, refresh } from "./store.js";
import { logout } from "./auth.js";
import { isDemo } from "./firebase.js";
import { installButton } from "./install.js";
import { icon } from "./icons.js";
export const navLinks = [
  ["/admin", "Overview"],
  ["/admin/directory", "Members & houses"],
  ["/admin/id-cards", "Bulk ID cards"],
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
  const sidebar = el("aside", {
    class: "sidebar",
    id: "workspace-navigation",
    "aria-label": "Workspace navigation",
  });
  const menu = button(
    icon("menu"),
    () => toggle(true),
    "icon-button mobile-menu",
    {
      "aria-label": "Open navigation",
      "aria-controls": "workspace-navigation",
      "aria-expanded": "false",
    },
  );
  const scrim = el("div", {
    class: "sidebar-scrim",
    hidden: true,
    onClick: () => toggle(false),
  });
  function toggle(open) {
    sidebar.classList.toggle("open", open);
    scrim.hidden = !open;
    menu.setAttribute("aria-expanded", String(open));
    if (open) sidebar.querySelector(".mobile-close").focus();
    else menu.focus();
  }
  sidebar.addEventListener("keydown", (event) => {
    if (
      !sidebar.classList.contains("open") ||
      !matchMedia("(max-width: 900px)").matches
    )
      return;
    if (event.key === "Escape") {
      event.preventDefault();
      toggle(false);
    }
    if (event.key === "Tab") {
      const items = [
        ...sidebar.querySelectorAll("a, button:not([disabled])"),
      ].filter((node) => node.getClientRects().length);
      if (event.shiftKey && document.activeElement === items[0]) {
        event.preventDefault();
        items.at(-1).focus();
      } else if (!event.shiftKey && document.activeElement === items.at(-1)) {
        event.preventDefault();
        items[0].focus();
      }
    }
  });
  sidebar.addEventListener("click", (event) => {
    if (event.target.closest("a") && sidebar.classList.contains("open"))
      toggle(false);
  });
  sidebar.append(
    link(
      el(
        "div",
        { class: "brand-lockup" },
        el("span", { class: "brand-symbol" }, icon("funds", 25)),
        el("div", {}, "Mahal", el("span", {}, "COMMUNITY ACCOUNTS")),
      ),
      "/admin",
      "brand",
    ),
    button(icon("close"), () => toggle(false), "mobile-close icon-button", {
      "aria-label": "Close navigation",
    }),
    el(
      "div",
      { class: "workspace-card" },
      el("div", { class: "workspace-avatar" }, s.name[0]),
      el(
        "div",
        {},
        el("strong", { title: s.name }, s.name),
        el("span", {}, "Central administration"),
      ),
    ),
    el("div", { class: "nav-caption" }, "WORKSPACE"),
    el(
      "nav",
      { "aria-label": "Main navigation" },
      navLinks.map(([route, label], index) => {
        const node = link(
          el(
            "span",
            { class: "nav-item-content" },
            icon(
              [
                "overview",
                "people",
                "cards",
                "funds",
                "receipt",
                "wallet",
                "chart",
                "import",
                "activity",
                "settings",
              ][index],
            ),
            el("span", {}, label),
          ),
          route,
          path === route ? "active" : "",
        );
        if (path === route) node.setAttribute("aria-current", "page");
        return node;
      }),
    ),
    el(
      "div",
      { class: "sidebar-bottom" },
      installButton(),
      link("Public member portal ↗", "/", "public-link"),
      el(
        "div",
        { class: "admin-card" },
        el("span", { class: "avatar small" }, "A"),
        el("strong", {}, "Administrator"),
        button(
          icon("exit", 18),
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
      menu,
      el(
        "span",
        { class: "topbar-context" },
        el("span", {}, "Workspace"),
        el(
          "strong",
          {},
          navLinks.find(([route]) => route === path)?.[1] || "Receive payment",
        ),
      ),
    ),
    el(
      "div",
      { class: "topbar-right" },
      el(
        "span",
        { class: "connection-label" },
        el("span", { class: "live-dot" }),
        isDemo ? "Demo workspace" : "Administrator",
      ),
      button(
        icon("refresh", 18),
        async (event) => {
          const control = event.currentTarget;
          control.disabled = true;
          try {
            await refresh();
            redraw();
          } catch (e) {
            showError(error, e);
          } finally {
            control.disabled = false;
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
      el(
        "main",
        { class: "main", id: "main-content", tabIndex: -1 },
        error,
        content,
      ),
      el(
        "footer",
        { class: "app-footer" },
        "Mahal Accounts · Community, connected.",
      ),
    ),
  );
}
