import {
  el,
  replace,
  link,
  button,
  input,
  select,
  field,
  grid,
  pageTitle,
  alertBox,
  showError,
  notify,
} from "../lib/dom.js";
import { store, run } from "../lib/store.js";
import { execute } from "../domain/engine.js";
import { money, sum, outstanding, paise } from "../domain/utils.js";
import { today, uid } from "../lib/browser.js";
export function render({ params }) {
  const s = store.state,
    operationId = uid(),
    initial = params.get("payer") || "";
  let type = initial.startsWith("H-") ? "house" : "member",
    lines = [],
    command,
    preview;
  const root = el("div"),
    payer = select("payer", [], initial, { "aria-label": "Payer" }),
    allocations = el("div"),
    summary = el("aside", { class: "payment-summary panel" }),
    error = alertBox();
  const date = input("date", today(s.settings[0].timezone), {
      type: "date",
      required: true,
      max: today(s.settings[0].timezone),
    }),
    method = select(
      "method",
      ["Cash", "Bank transfer", "UPI", "Cheque"],
      "Cash",
    ),
    wallet = select(
      "wallet",
      s.wallets.filter((w) => w.active).map((w) => [w.id, w.name]),
      "cash",
    ),
    reference = input("reference"),
    tendered = input("tendered", "", { type: "number", min: 0, step: "0.01" });
  const post = button(
    "Post payment & issue receipt",
    async () => {
      post.disabled = true;
      showError(error, "");
      try {
        if (!preview)
          throw new Error("Choose a payer and add a valid payment.");
        if (tendered.value && paise(tendered.value) < preview.total)
          throw new Error("Tendered amount is less than the collection.");
        await run(command, operationId);
        notify("Payment posted and receipt issued");
        location.hash = `/receipt/${operationId}`;
      } catch (e) {
        showError(error, e);
        post.disabled = false;
      }
    },
    "button primary full",
  );
  const add = button("+ Add another fund", () => {
    lines.push({ fundId: "", amount: "", dueId: "" });
    drawLines();
    update();
  });
  const member = button("Member payment", () => changeType("member"), "active"),
    house = button("House payment", () => changeType("house"), "");
  function changeType(value) {
    type = value;
    replace(
      payer,
      ...(type === "member" ? s.members : s.houses).map((p) =>
        el("option", { value: p.id }, `${p.name} · ${p.id}`),
      ),
    );
    payer.prepend(
      el("option", { value: "", selected: true }, `Select ${type}…`),
    );
    lines = [{ fundId: "", amount: "", dueId: "" }];
    member.className = type === "member" ? "active" : "";
    house.className = type === "house" ? "active" : "";
    drawLines();
    update();
  }
  function drawLines() {
    replace(
      allocations,
      ...lines.map((line, index) => {
        const fund = select(
            "fund",
            [
              ["", "Choose fund"],
              ...s.funds
                .filter((f) => f.target === type && f.active)
                .map((f) => [f.id, f.title]),
            ],
            line.fundId,
          ),
          amount = input("amount", line.amount, {
            type: "number",
            min: "0.01",
            step: "0.01",
            placeholder: "0.00",
          }),
          due = select(
            "due",
            [
              ["", "Oldest outstanding first"],
              ...s.dues
                .filter(
                  (d) =>
                    d.payerId === payer.value &&
                    d.fundId === line.fundId &&
                    outstanding(d) > 0,
                )
                .map((d) => [d.id, `${d.period} · ${money(outstanding(d))}`]),
            ],
            line.dueId,
          );
        fund.addEventListener("change", () => {
          line.fundId = fund.value;
          line.dueId = "";
          drawLines();
          update();
        });
        amount.addEventListener("input", () => {
          line.amount = amount.value;
          update();
        });
        due.addEventListener("change", () => {
          line.dueId = due.value;
          update();
        });
        return el(
          "div",
          { class: "payment-line" },
          grid(
            field("Fund", fund),
            field("Amount (₹)", amount),
            field("Period allocation", due),
            lines.length > 1 &&
              button(
                "Remove line",
                () => {
                  lines.splice(index, 1);
                  drawLines();
                  update();
                },
                "text-link danger-text",
              ),
          ),
        );
      }),
    );
    add.disabled = lines.length >= 4;
  }
  function update() {
    let message = "";
    preview = null;
    try {
      command = {
        type: "payment",
        payerId: payer.value,
        date: date.value,
        walletId: wallet.value,
        method: method.value,
        reference: reference.value,
        lines: lines
          .filter((l) => l.fundId && l.amount)
          .map((l) => ({
            fundId: l.fundId,
            amount: paise(l.amount),
            ...(l.dueId ? { dueId: l.dueId } : {}),
          })),
      };
      if (payer.value && command.lines.length)
        preview = execute(store.state, command, {
          operationId,
          now: new Date().toISOString(),
          actor: "preview",
        }).receipts.at(-1);
    } catch (e) {
      message = e.message;
    }
    post.disabled = !preview || store.busy;
    replace(
      summary,
      el("h2", {}, "Receipt summary"),
      el("p", {}, "Review before you post"),
      el(
        "div",
        { class: "summary-payer" },
        [...s.members, ...s.houses].find((p) => p.id === payer.value)?.name ||
          "Choose a payer",
        el("small", {}, payer.value),
      ),
      el(
        "div",
        { class: "summary-lines" },
        preview?.lines.map((l) =>
          el(
            "div",
            {},
            el(
              "span",
              {},
              l.fundTitle,
              el("small", {}, `${l.creditId ? "Advance · " : ""}${l.period}`),
            ),
            el("strong", {}, money(l.amount)),
          ),
        ) || el("p", { class: "muted" }, "Your allocation will appear here."),
      ),
      el(
        "div",
        { class: "summary-total" },
        el("span", {}, "Total collected"),
        el("strong", {}, money(preview?.total || 0)),
      ),
      preview &&
        tendered.value &&
        Number(tendered.value) * 100 >= preview.total &&
        el(
          "p",
          {},
          `Return change ${money(Math.round(Number(tendered.value) * 100) - preview.total)}`,
        ),
      message && el("div", { class: "hint-box amber" }, message),
      error,
      post,
      el(
        "p",
        { class: "secure-note" },
        "Saved together with allocations and cashbook.",
      ),
    );
  }
  payer.addEventListener("change", () => {
    lines = [{ fundId: "", amount: "", dueId: "" }];
    drawLines();
    update();
  });
  method.addEventListener("change", () => {
    wallet.value = method.value === "Cash" ? "cash" : "bank";
    update();
  });
  for (const control of [date, wallet, reference, tendered])
    control.addEventListener("input", update);
  root.append(
    link("← Back to overview", "/admin", "back-link"),
    pageTitle(
      "Receive a contribution.",
      "One payer, one receipt. Every fund and period stays accounted for.",
    ),
    el(
      "div",
      { class: "payment-layout" },
      el(
        "div",
        {},
        el(
          "section",
          { class: "panel form-panel" },
          el("h2", {}, "1. Who is paying?"),
          el("div", { class: "segmented" }, member, house),
          field("Payer", payer),
        ),
        el(
          "section",
          { class: "panel form-panel" },
          el("h2", {}, "2. Allocate the payment"),
          allocations,
          add,
        ),
        el(
          "section",
          { class: "panel form-panel" },
          el("h2", {}, "3. Payment details"),
          grid(
            field("Payment date", date),
            field("Payment method", method),
            field("Deposit into", wallet),
            field("Reference (private)", reference),
            field("Cash tendered (optional)", tendered),
          ),
        ),
      ),
      summary,
    ),
  );
  changeType(type);
  if (initial) {
    payer.value = initial;
    drawLines();
    update();
  }
  return root;
}
