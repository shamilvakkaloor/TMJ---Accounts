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
  pagedTable,
  badge,
  str,
  notify,
} from "../lib/dom.js";
import { store, run } from "../lib/store.js";
import { money, balance, displayDate, paise } from "../domain/utils.js";
import { today, uid } from "../lib/browser.js";
export function render() {
  const root = el("div"),
    wallets = el("div", { class: "wallet-grid" }),
    rows = el("section", { class: "panel" }),
    filter = select("wallet", [], "", {
      "aria-label": "Filter wallet",
      onChange: draw,
    });
  root.append(
    pageTitle(
      "Keep your accounts in balance.",
      "Central income, expenditure and wallet transfers.",
      [
        button("Transfer", () => entry("transfer")),
        button("+ Add entry", () => entry("expense"), "button primary"),
      ],
    ),
    wallets,
    el(
      "div",
      { class: "panel toolbar" },
      el("h2", {}, "Cashbook entries"),
      filter,
    ),
    rows,
  );
  function draw() {
    const s = store.state,
      selected = filter.value;
    replace(
      filter,
      el("option", { value: "" }, "All wallets"),
      ...s.wallets.map((w) =>
        el("option", { value: w.id, selected: w.id === selected }, w.name),
      ),
    );
    replace(
      wallets,
      ...s.wallets.map((w) =>
        el(
          "div",
          { class: "panel wallet-card" },
          el(
            "div",
            { class: "wallet-card-head" },
            badge(w.type, w.active ? "green" : "neutral"),
            button("Edit", () => wallet(w)),
          ),
          el("span", {}, w.name),
          el("strong", {}, money(balance(s, w.id))),
          el("small", {}, "Reconciled ledger balance"),
        ),
      ),
      button("+ Add wallet", () => wallet(), "add-wallet"),
    );
    replace(
      rows,
      pagedTable(
        ["DATE", "DESCRIPTION", "ACCOUNT", "TYPE", "MONEY IN", "MONEY OUT"],
        [...s.ledger]
          .reverse()
          .filter((l) => !filter.value || l.walletId === filter.value)
          .map((l) => [
            displayDate(l.date),
            el(
              "span",
              {},
              el("strong", {}, l.description),
              el("small", {}, l.party || l.category),
            ),
            s.wallets.find((w) => w.id === l.walletId)?.name,
            badge(l.kind, l.amount > 0 ? "green" : "gold"),
            l.amount > 0 ? money(l.amount) : "—",
            l.amount < 0 ? money(-l.amount) : "—",
          ]),
      ),
    );
  }
  function entry(initial) {
    const operationId = uid(),
      s = store.state,
      modal = dialog("Record a cashbook entry", [], true),
      kind = select(
        "kind",
        [
          ["expense", "Expense"],
          ["income", "Income"],
          ["transfer", "Transfer"],
          ["opening", "Opening balance"],
        ],
        initial,
      );
    modal.body.append(
      form(
        [
          field("Entry type", kind),
          grid(
            field(
              "Amount (₹)",
              input("amount", "", {
                type: "number",
                min: "0.01",
                step: "0.01",
                required: true,
              }),
            ),
            field(
              "Date",
              input("date", today(), {
                type: "date",
                required: true,
                max: today(),
              }),
            ),
            field(
              "Wallet / from wallet",
              select(
                "walletId",
                s.wallets.filter((w) => w.active).map((w) => [w.id, w.name]),
                "cash",
              ),
            ),
            field(
              "To wallet (transfer only)",
              select(
                "toWalletId",
                s.wallets.filter((w) => w.active).map((w) => [w.id, w.name]),
                "bank",
              ),
            ),
            field(
              "Category",
              input(
                "category",
                initial === "opening" ? "Opening balance" : "Other",
              ),
            ),
            field("Paid to / received from", input("party")),
            field("Reference", input("reference")),
          ),
          field(
            "Explanation",
            el("textarea", { name: "description", required: true }),
          ),
          el(
            "div",
            { class: "hint-box" },
            "Collections are posted automatically from receipts. Transfers are excluded from income and expenditure.",
          ),
        ],
        "Record entry",
        async (data) => {
          await run(
            {
              type: "cashbook",
              kind: str(data, "kind"),
              walletId: str(data, "walletId"),
              toWalletId: str(data, "toWalletId"),
              amount: paise(str(data, "amount")),
              date: str(data, "date"),
              category: str(data, "category"),
              party: str(data, "party"),
              description: str(data, "description"),
              reference: str(data, "reference"),
            },
            operationId,
          );
          modal.close();
          draw();
          notify("Cashbook entry recorded");
        },
        modal.close,
      ),
    );
  }
  function wallet(old = {}) {
    const modal = dialog(old.id ? "Edit wallet" : "Add a central wallet", []);
    modal.body.append(
      form(
        [
          field("Wallet name", input("name", old.name, { required: true })),
          field(
            "Type",
            select(
              "type",
              [
                ["bank", "Bank account"],
                ["cash", "Cash wallet"],
              ],
              old.type || "bank",
            ),
          ),
          check("Active wallet", "active", old.active ?? true),
        ],
        "Save wallet",
        async (data) => {
          await run({
            type: "saveWallet",
            value: {
              id: old.id || "wallet-" + uid().slice(0, 8),
              name: str(data, "name"),
              type: str(data, "type"),
              active: data.has("active"),
            },
          });
          modal.close();
          draw();
          notify("Wallet saved");
        },
        modal.close,
      ),
    );
  }
  draw();
  return root;
}
