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
import { MAX_SUB_MAHALS, subMahalDeletionError } from "../domain/submahals.js";
import { uid, download } from "../lib/browser.js";
import { csvString } from "../lib/csv-export.js";
export function render() {
  const s = store.state,
    settings = s.settings[0],
    subTable = el("section", { class: "panel" });
  function drawSubs() {
    replace(
      subTable,
      el("div", { class: "panel-heading" }, el("h2", {}, "Sub Mahals")),
      el("div", { class: "form-actions" },
        button("Add Sub Mahal", () => editSub(), "button primary", { disabled: store.state.subMahals.length >= MAX_SUB_MAHALS }),
        button("Download Sub Mahal IDs for CSV", () => download("sub-mahals.csv", csvString(store.state.subMahals.map(({ id, name, order }) => ({ id, name, order }))), "text/csv;charset=utf-8")),
      ),
      el("p", { class: "muted" }, "Up to 25 Sub Mahals. IDs are assigned automatically; download the list when preparing a house CSV. Unused Sub Mahals can be deleted; used ones can be made inactive."),
      table(
        ["NAME", "ORDER", "STATUS", ""],
        store.state.subMahals.map((m) => [
          m.name,
          m.order,
          m.active ? "Active" : "Inactive",
          el("div", { class: "form-actions" }, button("Edit", () => editSub(m), "button secondary", {
            "aria-label": "Edit " + m.name,
          }), button("Delete", () => deleteSub(m), "button secondary", { "aria-label": "Delete " + m.name })),
        ]),
      ),
    );
  }
  function deleteSub(sub) {
    const error = subMahalDeletionError(store.state, sub.id);
    const modal = dialog("Delete Sub Mahal", []);
    if (error) {
      modal.body.append(el("p", {}, error), button("Close", modal.close));
      return;
    }
    const operationId = uid();
    modal.body.append(form([el("p", {}, `Delete ${sub.name}? This unused Sub Mahal will be removed. The deletion remains in the audit log.`)], "Delete Sub Mahal", async () => {
      await run({ type: "deleteSubMahal", id: sub.id }, operationId);
      modal.close();
      drawSubs();
      notify("Sub Mahal deleted");
    }, modal.close));
  }
  function editSub(existing) {
    const old = existing || { id: "", name: "", order: Math.min(25, Math.max(0, ...store.state.subMahals.map((m) => m.order)) + 1), active: true };
    const operationId = uid();
    const modal = dialog(existing ? "Edit Sub Mahal" : "Add Sub Mahal", []);
    modal.body.append(
      form(
        [
          field("Name", input("name", old.name, { required: true })),
          field(
            "Display order",
            input("order", old.order, {
              type: "number",
              min: 1,
              max: MAX_SUB_MAHALS,
              step: 1,
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
          }, operationId);
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
        field("Receipt contact", input("contact", settings.contact), "Public office phone or email printed on receipts and the member portal. This is not your login address."),
        field(
          "Reporting timezone",
          input("timezone", settings.timezone, { required: true }),
        ),
        field(
          "Accounting cutover date",
          input("cutover", settings.cutover, { type: "date", required: true }),
          "The date live accounting starts. Earlier receipts are statement-only history and do not change cash; cashbook entries start on this date. This is separate from a house joining date.",
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
  if (!isDemo && config.additionalAdminUids?.length)
    access.append(el("p", {}, "Google and password sign-in use separately authorized administrator accounts. Both are already configured; account linking is not required."));
  if (!isDemo && !config.additionalAdminUids?.length && !providers.includes("google.com"))
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
  if (!isDemo && !config.additionalAdminUids?.length && !providers.includes("password"))
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
