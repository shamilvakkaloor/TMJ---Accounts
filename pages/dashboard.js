import { el, link, pageTitle, stat, pagedTable, badge } from "../lib/dom.js";
import { store } from "../lib/store.js";
import {
  money,
  sum,
  outstanding,
  balance,
  displayDate,
} from "../domain/utils.js";
import { today } from "../lib/browser.js";
export function render() {
  const s = store.state,
    date = today(s.settings[0].timezone),
    month = date.slice(0, 7);
  const net = sum(
    s.ledger.filter(
      (l) =>
        ["collection", "refund", "reversal"].includes(l.kind) &&
        l.date.startsWith(month),
    ),
    (l) => l.amount,
  );
  return el(
    "div",
    {},
    pageTitle(
      "A clear view of your community.",
      "Membership, contributions and accounts, connected in one place.",
      [link("+ Receive payment", "/admin/receive", "button primary")],
    ),
    el(
      "div",
      { class: "stats-grid" },
      stat(
        "This month's collections",
        money(net),
        "Net of refunds and reversals",
        true,
      ),
      stat(
        "Total outstanding",
        money(sum(s.dues, outstanding)),
        "Current unpaid assessed dues",
      ),
      stat(
        "Registered members",
        s.members.filter((m) => m.active).length,
        `${s.houses.length} registered houses`,
      ),
      stat(
        "Available balance",
        money(sum(s.wallets, (w) => balance(s, w.id))),
        "Across central wallets",
      ),
    ),
    el(
      "div",
      { class: "dashboard-grid" },
      el(
        "section",
        { class: "panel" },
        el(
          "div",
          { class: "panel-heading" },
          el("h2", {}, "Recent receipts"),
          link("View all →", "/admin/receipts"),
        ),
        pagedTable(
          ["RECEIPT", "PAYER", "DATE", "AMOUNT"],
          [...s.receipts]
            .reverse()
            .slice(0, 8)
            .map((r) => [
              link(r.number, `/receipt/${r.id}`, "record-id"),
              r.payerName,
              displayDate(r.date),
              money(r.total),
            ]),
        ),
      ),
      el(
        "section",
        { class: "panel" },
        el(
          "div",
          { class: "panel-heading" },
          el("h2", {}, "Community overview"),
        ),
        el(
          "div",
          { class: "panel-body" },
          s.subMahals.map((m) =>
            el(
              "div",
              { class: "overview-row" },
              el("span", {}, m.name),
              badge(
                `${s.houses.filter((h) => h.subMahalId === m.id).length} houses`,
                "green",
              ),
            ),
          ),
        ),
      ),
    ),
  );
}
