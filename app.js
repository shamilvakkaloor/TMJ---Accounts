import "./lib/install.js";
import {
  el,
  button,
  link,
  empty,
  alertBox,
  showError,
  form,
} from "./lib/dom.js";
const root = document.getElementById("app");
let generation = 0;
try {
  const [{ store, ready, setup, refresh }, { layout }, { routeInfo }] =
    await Promise.all([
      import("./lib/store.js"),
      import("./lib/layout.js"),
      import("./lib/router.js"),
    ]);
  const routes = {
    "/": "public",
    "/login": "login",
    "/admin": "dashboard",
    "/admin/directory": "directory",
    "/admin/funds": "funds",
    "/admin/receive": "payments",
    "/admin/receipts": "receipts",
    "/admin/accounts": "accounts",
    "/admin/reports": "reports",
    "/admin/import": "import",
    "/admin/settings": "settings",
    "/admin/audit": "reports",
  };
  async function render() {
    const sequence = ++generation,
      info = routeInfo();
    document.querySelectorAll("dialog").forEach((node) => node.close());
    root.replaceChildren(el("div", { class: "loading" }, "Opening page…"));
    await ready;
    if (store.loading) {
      await new Promise((resolve) =>
        window.addEventListener("mahal-auth", resolve, { once: true }),
      );
    }
    if (sequence !== generation) return;
    const protectedRoute =
      info.path.startsWith("/admin") || info.path.startsWith("/card/");
    if (protectedRoute && !store.admin) {
      location.replace("#/login");
      return;
    }
    try {
      let content;
      if (protectedRoute && store.error) throw new Error(store.error);
      if (protectedRoute && store.revision === -1) {
        content = el(
          "div",
          { class: "setup-card" },
          el("h1", {}, "Welcome to your Mahal"),
          form(
            [
              el(
                "p",
                {},
                "Initialize ten Sub Mahals and zero-balance central wallets.",
              ),
            ],
            "Initialize workspace",
            async () => {
              await setup();
              render();
            },
          ),
        );
      } else if (info.path === "/admin/audit")
        content = (await import("./pages/reports.js")).audit();
      else if (routes[info.path])
        content = await (
          await import(`./pages/${routes[info.path]}.js`)
        ).render(info);
      else {
        const profile = info.path.match(/^\/p\/(member|house)\/([\w-]+)$/),
          card = info.path.match(/^\/card\/(member|house)\/([\w-]+)$/),
          receipt = info.path.match(/^\/receipt\/([\w-]+)$/);
        if (profile)
          content = await (
            await import("./pages/public.js")
          ).profile({ type: profile[1], id: profile[2] });
        else if (card)
          content = await (
            await import("./pages/public.js")
          ).card({ type: card[1], id: card[2] });
        else if (receipt)
          content = await (
            await import("./pages/receipts.js")
          ).detail({ id: receipt[1] });
        else
          content = el(
            "div",
            { class: "standalone" },
            empty("Page not found"),
            link("Go to the Mahal portal", "/"),
          );
      }
      if (sequence === generation) {
        root.replaceChildren(
          info.path.startsWith("/admin")
            ? layout(content, info.path, render)
            : content,
        );
        window.scrollTo(0, 0);
      }
    } catch (error) {
      if (sequence === generation)
        root.replaceChildren(
          el(
            "div",
            { class: "standalone" },
            el("h1", {}, "Unable to open this page"),
            el("p", { class: "alert danger", role: "alert" }, error.message),
            button("Retry", async () => {
              if (protectedRoute && store.admin && store.error) {
                try { await refresh(); } catch { /* render the latest load error */ }
              }
              await render();
            }),
            link("Back to portal", "/"),
          ),
        );
    }
  }
  window.addEventListener("hashchange", render);
  window.addEventListener("mahal-auth", render);
  await render();
} catch (error) {
  root.replaceChildren(
    el(
      "div",
      { class: "standalone" },
      el("h1", {}, "Connection or setup required"),
      el("p", { role: "alert" }, error.message),
      el(
        "p",
        {},
        "Check config.js and SETUP.md, and allow Firebase's browser SDK to load.",
      ),
      button("Retry", () => location.reload()),
    ),
  );
}
