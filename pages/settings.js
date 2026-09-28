import {
  el,
  replace,
  button,
  input,
  select,
  field,
  check,
  grid,
  form,
  dialog,
  pageTitle,
  table,
  str,
  notify,
} from "../lib/dom.js";
import { store, run, refresh } from "../lib/store.js";
import { rebuildPublic, resetDemo } from "../lib/repository.js";
import { isDemo, auth } from "../lib/firebase.js";
import { linkGoogle, linkPassword } from "../lib/auth.js";
import { config } from "../config.js";
export function render() {
  const s = store.state,
    settings = s.settings[0],
    subTable = el("section", { class: "panel" });
  function drawSubs() {
    replace(
      subTable,
      el("div", { class: "panel-heading" }, el("h2", {}, "Sub Mahals")),
      table(
        ["NAME", "ORDER", ""],
        store.state.subMahals.map((m) => [
          m.name,
          m.order,
          button("Edit", () => editSub(m), "button secondary", {
            "aria-label": "Edit " + m.name,
          }),
        ]),
      ),
    );
  }
  function editSub(old) {
    const modal = dialog("Edit Sub Mahal", []);
    modal.body.append(
      form(
        [
          field("Name", input("name", old.name, { required: true })),
          field(
            "Display order",
            input("order", old.order, {
              type: "number",
              min: 1,
              required: true,
            }),
          ),
          check("Active", "active", old.active),
        ],
        "Save Sub Mahal",
        async (data) => {
          await run({
            type: "saveSubMahal",
            value: {
              ...old,
              name: str(data, "name"),
              order: Number(str(data, "order")),
              active: data.has("active"),
            },
          });
          modal.close();
          drawSubs();
          notify("Sub Mahal saved");
        },
        modal.close,
      ),
    );
  }
  const details = form(
    [
      grid(
        field("Mahal name", input("name", settings.name, { required: true })),
        field("Receipt contact", input("contact", settings.contact)),
        field(
          "Reporting timezone",
          input("timezone", settings.timezone, { required: true }),
        ),
        field(
          "Accounting cutover date",
          input("cutover", settings.cutover, { type: "date", required: true }),
        ),
      ),
      field("Address", el("textarea", { name: "address" }, settings.address)),
      field(
        "Logo path or HTTPS URL",
        input("logo", settings.logo),
        "Place your logo in assets/ and enter assets/logo.png.",
      ),
      el("h3", {}, "Public profile information"),
      el(
        "p",
        { class: "muted" },
        "Published fields are available to anyone. DOB, age evidence, references and audit notes remain private.",
      ),
      check(
        "Publish phone numbers and allow phone search",
        "publicPhone",
        settings.publicPhone,
      ),
      check(
        "Publish full house addresses",
        "publicAddress",
        settings.publicAddress,
      ),
      check(
        "Publish dues, receipts, waivers and advance balances",
        "publicHistory",
        settings.publicHistory,
      ),
    ],
    "Save settings",
    async (data) => {
      const timezone = str(data, "timezone");
      new Intl.DateTimeFormat("en", { timeZone: timezone });
      await run({
        type: "saveSettings",
        value: {
          ...store.state.settings[0],
          name: str(data, "name"),
          address: str(data, "address"),
          contact: str(data, "contact"),
          timezone,
          cutover: str(data, "cutover"),
          logo: str(data, "logo"),
          publicPhone: data.has("publicPhone"),
          publicAddress: data.has("publicAddress"),
          publicHistory: data.has("publicHistory"),
        },
      });
      notify("Settings saved");
    },
  );
  const providers =
    auth?.currentUser?.providerData.map((p) => p.providerId) || [];
  const access = form(
    [
      el(
        "p",
        {},
        "Only the UID configured in config.js and the Firestore rules can manage this workspace.",
      ),
      el("p", {}, `User ID: ${config.login.userId}`),
      el(
        "p",
        {},
        isDemo
          ? "Authentication is disabled in this explicit local demo."
          : `Linked providers: ${providers.join(", ") || "none"}`,
      ),
    ],
    "Refresh public profiles",
    async () => {
      await rebuildPublic();
      notify("Public profiles refreshed");
    },
  );
  if (!isDemo && !providers.includes("google.com"))
    access.append(
      button("Link administrator Google account", async () => {
        try {
          await linkGoogle();
          notify("Google account linked to the same administrator UID.");
          location.reload();
        } catch (e) {
          notify(e.message);
        }
      }),
    );
  if (!isDemo && !providers.includes("password"))
    access.append(
      button("Enable user ID/password login", () => {
        const modal = dialog("Enable administrator password login", []);
        modal.body.append(
          form(
            [
              el(
                "p",
                {},
                `This links user ID ${config.login.userId} to your current administrator UID.`,
              ),
              field(
                "New password",
                input("password", "", {
                  type: "password",
                  required: true,
                  autoComplete: "new-password",
                }),
              ),
              field(
                "Confirm password",
                input("confirm", "", {
                  type: "password",
                  required: true,
                  autoComplete: "new-password",
                }),
              ),
            ],
            "Link password",
            async (data) => {
              if (data.get("password") !== data.get("confirm"))
                throw new Error("Passwords do not match.");
              await linkPassword(data.get("password"));
              modal.close();
              notify(
                "Password linked. Use your user ID and the password you entered.",
              );
            },
            modal.close,
          ),
        );
      }),
    );
  if (isDemo)
    access.append(
      button("Reset demo data", () => {
        const modal = dialog("Reset demo data?", []);
        modal.body.append(
          form(
            [
              el(
                "p",
                {},
                "This replaces only fictional records in this browser.",
              ),
            ],
            "Reset demo",
            async () => {
              resetDemo();
              await refresh();
              modal.close();
              location.hash = "/admin";
            },
            modal.close,
          ),
        );
      }),
    );
  drawSubs();
  return el(
    "div",
    {},
    pageTitle(
      "Make this your Mahal.",
      "Community details, publication choices, access and Sub Mahals.",
    ),
    el(
      "div",
      { class: "settings-grid" },
      el(
        "section",
        { class: "panel" },
        el("div", { class: "panel-heading" }, el("h2", {}, "Mahal details")),
        el("div", { class: "panel-body" }, details),
      ),
      el(
        "div",
        {},
        subTable,
        el(
          "section",
          { class: "panel panel-body" },
          el("h2", {}, "Access & publication"),
          access,
        ),
      ),
    ),
  );
}
