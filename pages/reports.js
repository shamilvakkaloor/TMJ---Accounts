import {
  el,
  replace,
  button,
  input,
  select,
  field,
  pageTitle,
  table,
  pagedTable,
  stat,
  badge,
} from "../lib/dom.js";
import { store } from "../lib/store.js";
import { money, sum, outstanding, displayDate, norm } from "../domain/utils.js";
import { reportData } from "../domain/reports.js";
import { today, download } from "../lib/browser.js";
import { csvString } from "../lib/csv-export.js";
export function render() {
  const s = store.state,
    root = el("div"),
    content = el("div"),
    from = input("from", today().slice(0, 4) + "-01-01", {
      type: "date",
      "aria-label": "Report from",
      onChange: draw,
    }),
    to = input("to", today(), {
      type: "date",
      "aria-label": "Report to",
      onChange: draw,
    }),
    sub = select(
      "sub",
      [["", "All Sub Mahals"], ...s.subMahals.map((m) => [m.id, m.name])],
      "",
      { onChange: draw },
    ),
    fund = select(
      "fund",
      [["", "All funds"], ...s.funds.map((f) => [f.id, f.title])],
      "",
      { onChange: draw },
    ),
    kind = select(
      "kind",
      [
        ["collections", "Collections"],
        ["outstanding", "Outstanding dues"],
        ["cashbook", "Cashbook & reconciliation"],
      ],
      "collections",
      { onChange: draw },
    );
  let csvRows = [];
  root.append(
    pageTitle(
      "Numbers you can account for.",
      "Trace collections, outstanding dues and cashbook balances.",
      [
        button("Print", () => window.print()),
        button(
          "Export CSV",
          () =>
            download(
              `mahal-${kind.value}-${from.value}-${to.value}.csv`,
              "\ufeff" + csvString(csvRows),
              "text/csv;charset=utf-8",
            ),
          "button primary",
        ),
      ],
    ),
    el(
      "section",
      { class: "panel report-filters" },
      field("From", from),
      field("To", to),
      field("Fund", fund),
      field("Sub Mahal", sub),
      field("Report", kind),
    ),
    content,
  );
  function draw() {
    if (from.value > to.value) {
      replace(
        content,
        el(
          "p",
          { class: "alert danger" },
          "The start date must be before the end date.",
        ),
      );
      return;
    }
    const data = reportData(store.state, {
        from: from.value,
        to: to.value,
        sub: sub.value,
        fund: fund.value,
      }),
      stats = el(
        "div",
        { class: "stats-grid" },
        stat(
          "Net collections",
          money(data.net),
          "Receipts less dated refunds & reversals",
          true,
        ),
        stat("Other income", money(data.income), "Central accounts"),
        stat("Expenditure", money(data.expense), "Excludes transfers"),
        stat(
          "Outstanding",
          money(sum(data.dues, outstanding)),
          "Current balances of selected dues",
        ),
      );
    let body;
    if (kind.value === "collections") {
      csvRows = data.collections.map(({ subMahalId, ...r }) => ({
        ...r,
        amount: r.amount / 100,
      }));
      body = el(
        "div",
        {},
        el(
          "section",
          { class: "panel panel-body" },
          el("h2", {}, "Collections by Sub Mahal"),
          store.state.subMahals.map((m) => {
            const amount = sum(
              data.collections.filter((r) => r.subMahalId === m.id),
              (r) => r.amount,
            );
            return el(
              "div",
              { class: "overview-row" },
              el("span", {}, m.name),
              el("strong", {}, money(amount)),
            );
          }),
        ),
        el(
          "section",
          { class: "panel" },
          table(
            ["DATE", "RECEIPT", "PAYER", "FUND", "TYPE", "NET AMOUNT"],
            data.collections.map((r) => [
              displayDate(r.date),
              r.receipt,
              r.payer,
              r.fund,
              r.type,
              money(r.amount),
            ]),
          ),
        ),
      );
    } else if (kind.value === "outstanding") {
      csvRows = data.dues.map((d) => ({
        payer: d.payerId,
        fund: d.fundTitle,
        period: d.period,
        assessed: d.assessed / 100,
        waived: d.waived / 100,
        paid: d.paid / 100,
        outstanding: outstanding(d) / 100,
      }));
      body = el(
        "section",
        { class: "panel" },
        el(
          "p",
          { class: "table-note" },
          "Current balances for dues dated in this range; Sub Mahal uses current household assignment. This is not a historical as-of receivable statement.",
        ),
        table(
          [
            "PAYER",
            "FUND",
            "PERIOD",
            "ASSESSED",
            "PAID",
            "WAIVED",
            "OUTSTANDING",
          ],
          data.dues.map((d) => [
            d.payerId,
            d.fundTitle,
            d.period,
            money(d.assessed),
            money(d.paid),
            money(d.waived),
            money(outstanding(d)),
          ]),
        ),
      );
    } else {
      csvRows = data.ledger.map((l) => ({
        date: l.date,
        wallet: s.wallets.find((w) => w.id === l.walletId)?.name,
        type: l.kind,
        category: l.category,
        description: l.description,
        amount: l.amount / 100,
      }));
      body = el(
        "section",
        { class: "panel" },
        el(
          "p",
          { class: "table-note" },
          "Cashbook and wallet reconciliation cover all central wallets; fund/Sub Mahal filters apply to collection and due reports only.",
        ),
        table(
          ["WALLET", "OPENING", "NET MOVEMENT", "CLOSING"],
          data.wallets.map((w) => [
            w.name,
            money(w.opening),
            money(w.movement),
            money(w.closing),
          ]),
        ),
        table(
          ["DATE", "WALLET", "TYPE", "DESCRIPTION", "AMOUNT"],
          data.ledger.map((l) => [
            displayDate(l.date),
            s.wallets.find((w) => w.id === l.walletId)?.name,
            l.kind,
            l.description,
            money(l.amount),
          ]),
        ),
      );
    }
    replace(content, stats, body);
  }
  draw();
  return root;
}
export function audit() {
  const rows = el("section", { class: "panel" }),
    search = input("search", "", {
      placeholder: "Search activity…",
      "aria-label": "Search activity",
      onInput: draw,
    });
  function draw() {
    replace(
      rows,
      pagedTable(
        ["DATE", "ACTION", "DETAILS", "AMOUNT", "REASON", "ACTOR"],
        [...store.state.operations]
          .reverse()
          .filter((o) =>
            norm(`${o.kind} ${o.description} ${o.reason} ${o.actor}`).includes(
              norm(search.value),
            ),
          )
          .map((o) => [
            displayDate(o.createdAt),
            badge(o.kind),
            o.description,
            o.amount ? money(o.amount) : "—",
            o.reason || "—",
            o.actor,
          ]),
      ),
    );
  }
  draw();
  return el(
    "div",
    {},
    pageTitle(
      "A record of every change.",
      "Immutable activity and financial correction history.",
    ),
    el("div", { class: "panel toolbar" }, search),
    rows,
  );
}
