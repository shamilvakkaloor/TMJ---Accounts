import {
  el,
  replace,
  link,
  button,
  input,
  select,
  field,
  form,
  dialog,
  pageTitle,
  pagedTable,
  table,
  badge,
  str,
  notify,
  empty,
} from "../lib/dom.js";
import { store, run } from "../lib/store.js";
import { publicDoc } from "../lib/repository.js";
import { money, norm, displayDate, paise } from "../domain/utils.js";
import { today, uid } from "../lib/browser.js";
import { appUrl, assetUrl } from "../lib/urls.js";
import { qr } from "../lib/qr.js";
export function render() {
  const rows = el("section", { class: "panel" }),
    search = input("search", "", {
      placeholder: "Search receipt or payer…",
      "aria-label": "Search receipts",
      onInput: draw,
    }),
    filter = select(
      "status",
      [
        ["", "All receipts"],
        ["valid", "Valid"],
        ["void", "Voided"],
      ],
      "",
      { "aria-label": "Receipt status", onChange: draw },
    );
  function draw() {
    const s = store.state;
    replace(
      rows,
      pagedTable(
        ["RECEIPT", "PAYER", "DATE", "AMOUNT", "STATUS"],
        [...s.receipts]
          .reverse()
          .filter(
            (r) =>
              norm(`${r.number} ${r.payerName} ${r.payerId}`).includes(
                norm(search.value),
              ) &&
              (!filter.value ||
                (filter.value === "void") ===
                  !!s.receiptStates.find((rs) => rs.id === r.id)?.voided),
          )
          .map((r) => {
            const rs = s.receiptStates.find((x) => x.id === r.id);
            return [
              link(r.number, `/receipt/${r.id}`, "record-id"),
              el(
                "span",
                {},
                el("strong", {}, r.payerName),
                el("small", {}, r.payerId),
              ),
              displayDate(r.date),
              money(r.total),
              badge(
                rs?.voided
                  ? "Void"
                  : rs?.refunded
                    ? "Adjusted"
                    : r.historical
                      ? "Historical"
                      : "Valid",
                rs?.voided ? "gold" : "green",
              ),
            ];
          }),
      ),
    );
  }
  draw();
  return el(
    "div",
    {},
    pageTitle(
      "Every payment has a story.",
      "Find, verify and reprint the original contribution record.",
      [link("+ Receive payment", "/admin/receive", "button primary")],
    ),
    el("div", { class: "panel toolbar" }, search, filter),
    rows,
  );
}
export function receiptPaper(r, s) {
  return el(
    "article",
    { class: "receipt-paper" },
    el(
      "div",
      { class: "receipt-brand" },
      s.logo && el("img", { src: assetUrl(s.logo), alt: "Mahal logo" }),
      el("h2", {}, s.name),
      el("p", {}, s.address),
      el("p", {}, s.contact),
    ),
    el(
      "div",
      { class: "receipt-caption" },
      "PAYMENT RECEIPT ",
      r.voided && el("strong", { class: "void-label" }, "VOID"),
    ),
    el(
      "div",
      { class: "receipt-meta" },
      el("strong", {}, r.number),
      el("span", {}, displayDate(r.date)),
    ),
    el(
      "div",
      { class: "receipt-payer" },
      el("small", {}, "RECEIVED FROM"),
      el("strong", {}, r.payerName),
      el("p", {}, `${r.payerId} · ${r.houseName}`),
      el("p", {}, r.subMahalName),
    ),
    table(
      ["Fund / period", "Amount"],
      r.lines.map((l) => [
        el(
          "span",
          {},
          l.fundTitle,
          el("small", {}, `${l.period}${l.creditId ? " · advance" : ""}`),
        ),
        money(l.amount),
      ]),
    ),
    el(
      "div",
      { class: "receipt-total" },
      el("span", {}, "Amount received"),
      el("strong", {}, money(r.total)),
    ),
    el(
      "p",
      { class: "receipt-method" },
      `Paid by ${r.method}${r.refunded > 0 ? ` · Returned ${money(r.refunded)}` : ""}`,
    ),
    r.outstandingAfter !== null &&
      el(
        "p",
        { class: "receipt-method" },
        `At issue · Outstanding ${money(r.outstandingAfter)} · Advance ${money(r.advanceAfter || 0)}`,
      ),
    el(
      "p",
      { class: "receipt-method" },
      "Issued " +
        new Intl.DateTimeFormat("en-IN", {
          dateStyle: "short",
          timeStyle: "short",
          timeZone: s.timezone || "Asia/Kolkata",
        }).format(new Date(r.postedAt)),
    ),
    r.historical &&
      el("p", {}, `Historical statement only · ${r.legacyNumber}`),
    el(
      "div",
      { class: "receipt-bottom" },
      qr(appUrl(`/receipt/${r.id}`), 65),
      el(
        "div",
        {},
        el("strong", {}, "Thank you for your contribution."),
        el("p", {}, "Scan to verify this receipt and its current status."),
        el(
          "small",
          {},
          r.voided
            ? "Reversed receipt"
            : r.refunded === r.total
              ? "Fully refunded"
              : r.refunded > 0
                ? "Partially refunded"
                : "Valid receipt",
        ),
      ),
    ),
  );
}
export async function detail({ id }) {
  const root = el("div", { class: "standalone receipt-page" });
  async function draw() {
    const s = store.state,
      original = store.admin && s.receipts.find((r) => r.id === id),
      rs = s.receiptStates.find((r) => r.id === id);
    const [data, settings] = original
      ? [
          {
            ...original,
            voided: rs?.voided || false,
            refunded: rs?.refunded || 0,
          },
          s.settings[0],
        ]
      : await Promise.all([
          publicDoc("publicReceipts", id),
          publicDoc("publicSettings", "mahal"),
        ]);
    replace(
      root,
      el(
        "div",
        { class: "print-toolbar" },
        link("← Back", store.admin ? "/admin/receipts" : "/", "back-link"),
        el(
          "div",
          {},
          store.admin &&
            data &&
            !data.voided &&
            !data.historical &&
            data.refunded < data.total &&
            button("Correct / refund", () => correct(data)),
          button("Print A6 receipt", () => window.print(), "button primary", {
            disabled: !data,
          }),
        ),
      ),
      data && settings
        ? receiptPaper(data, settings)
        : empty(
            "Receipt unavailable",
            "Check the verification link or contact the administrator.",
          ),
      el(
        "p",
        { class: "print-help" },
        "Print on A6 portrait paper at 100% scale. Disable browser headers and footers.",
      ),
    );
  }
  function correct(receipt) {
    const operationId = uid(),
      modal = dialog("Correct " + receipt.number, []),
      action = select(
        "action",
        [
          ["refund", "Refund some or all of the payment"],
          ["void", "Void the remaining receipt"],
        ],
        "refund",
      ),
      amount = input("amount", (receipt.total - receipt.refunded) / 100, {
        type: "number",
        min: "0.01",
        step: "0.01",
        max: (receipt.total - receipt.refunded) / 100,
        required: true,
      }),
      amountField = field("Refund amount (₹)", amount);
    action.addEventListener("change", () => {
      amountField.hidden = action.value === "void";
      amount.required = action.value !== "void";
    });
    modal.body.append(
      form(
        [
          el(
            "div",
            { class: "hint-box" },
            "Paid allocations reopen their dues. Refunds reduce cash; waivers are separate. Original receipt details are retained.",
          ),
          field("Correction", action),
          amountField,
          field(
            "Refund from",
            select(
              "wallet",
              store.state.wallets
                .filter((w) => w.active)
                .map((w) => [w.id, w.name]),
              receipt.walletId,
            ),
          ),
          field(
            "Correction date",
            input("date", today(), {
              type: "date",
              max: today(),
              required: true,
            }),
          ),
          field(
            "Reason",
            el("textarea", { name: "reason", required: true, minLength: 3 }),
          ),
        ],
        "Record correction",
        async (data) => {
          const command = {
            type: str(data, "action"),
            receiptId: id,
            date: str(data, "date"),
            reason: str(data, "reason"),
          };
          if (command.type === "refund")
            Object.assign(command, {
              walletId: str(data, "wallet"),
              amount: paise(str(data, "amount")),
            });
          await run(command, operationId);
          modal.close();
          await draw();
          notify("Correction recorded with its audit history");
        },
        modal.close,
      ),
    );
  }
  await draw();
  return root;
}
