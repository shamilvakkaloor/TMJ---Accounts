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
  table,
  badge,
  str,
  notify,
  alertBox,
  showError,
} from "../lib/dom.js";
import { store, run } from "../lib/store.js";
import { assessmentPreview, periodStart, rateFor } from "../domain/engine.js";
import { money, sum, outstanding, dueStatus, paise } from "../domain/utils.js";
import { today, uid } from "../lib/browser.js";
export function render() {
  const root = el("div"),
    content = el("div");
  let tab = "funds";
  const fundTab = button(
      "Fund directory",
      () => {
        tab = "funds";
        draw();
      },
      "active",
    ),
    dueTab = button(
      "Dues & waivers",
      () => {
        tab = "dues";
        draw();
      },
      "",
    );
  root.append(
    pageTitle(
      "A purpose for every contribution.",
      "Configure funds, generate assessments and manage balances.",
      [button("+ Create fund", () => edit(), "button primary")],
    ),
    el("div", { class: "tabs page-tabs" }, fundTab, dueTab),
    content,
  );
  function draw() {
    const s = store.state;
    fundTab.className = tab === "funds" ? "active" : "";
    dueTab.className = tab === "dues" ? "active" : "";
    if (tab === "funds") {
      content.className = "fund-grid";
      replace(
        content,
        ...s.funds.map((f) => {
          const dues = s.dues.filter((d) => d.fundId === f.id),
            rate = [...f.rates]
              .sort((a, b) => b.from.localeCompare(a.from))
              .find((r) => r.from <= today());
          return el(
            "section",
            { class: "panel fund-card" },
            el(
              "div",
              { class: "fund-card-top" },
              badge(
                f.active ? "Active" : "Inactive",
                f.active ? "green" : "neutral",
              ),
              button("Edit", () => edit(f), "button secondary", {
                "aria-label": "Edit " + f.title,
              }),
            ),
            el("h2", {}, f.title),
            el("p", {}, `${f.target} · ${f.frequency.replace("_", " ")}`),
            el(
              "div",
              { class: "fund-price" },
              f.mode === "voluntary"
                ? "Any contribution"
                : money(rate?.amount || 0),
            ),
            el(
              "div",
              { class: "fund-card-summary" },
              el(
                "div",
                {},
                "Assessed",
                el("strong", {}, money(sum(dues, (d) => d.assessed))),
              ),
            ),
            el("p", {}, `Outstanding ${money(sum(dues, outstanding))}`),
            f.mode === "fixed"
              ? button(
                  "Generate assessments",
                  () => generate(f),
                  "button secondary full",
                )
              : el(
                  "p",
                  { class: "muted" },
                  "Voluntary gifts create no unpaid balance.",
                ),
          );
        }),
      );
      if (!s.funds.length)
        content.append(
          el(
            "p",
            { class: "panel panel-body" },
            "Create your first fund to start collecting contributions.",
          ),
        );
    } else {
      content.className = "panel";
      const rows = el("div"),
        filter = select(
          "fund",
          [["", "All funds"], ...s.funds.map((f) => [f.id, f.title])],
          "",
          { onChange: drawDues, "aria-label": "Filter fund" },
        ),
        status = select(
          "status",
          [["", "All statuses"], "unpaid", "partial", "paid", "waived"],
          "",
          { onChange: drawDues, "aria-label": "Filter due status" },
        );
      function drawDues() {
        replace(
          rows,
          pagedTable(
            [
              "PAYER",
              "FUND / PERIOD",
              "ASSESSED",
              "PAID",
              "WAIVED",
              "OUTSTANDING",
              "STATUS",
              "",
            ],
            store.state.dues
              .filter(
                (d) =>
                  (!filter.value || d.fundId === filter.value) &&
                  (!status.value || dueStatus(d) === status.value),
              )
              .map((d) => [
                d.payerId,
                `${d.fundTitle} · ${d.period}`,
                money(d.assessed),
                money(d.paid),
                money(d.waived),
                money(outstanding(d)),
                badge(dueStatus(d)),
                button("Manage", () => manage(d)),
              ]),
          ),
        );
      }
      replace(content, el("div", { class: "toolbar" }, filter, status), rows);
      drawDues();
    }
  }
  function edit(old = {}) {
    const date = today(),
      modal = dialog(old.id ? "Edit fund" : "Create fund", [], true);
    const rateRows = el("div");
    const mode = select("mode", [["fixed", "Fixed due"], ["voluntary", "Voluntary donation"]], old.mode || "fixed");
    const startInput = input("start", old.start || date.slice(0, 4) + "-01-01", { type: "date", required: true });
    function addRate() {
      const row = el("div", { class: "rate-entry" });
      row.append(grid(
        field("Rate effective from", input("rateFrom", old.id ? "" : startInput.value, { type: "date", required: true })),
        field("Amount (₹)", input("rateAmount", "", { type: "number", min: "0.01", step: "0.01", required: true })),
        button("Remove rate", () => row.remove(), "text-link danger-text"),
      ));
      rateRows.append(row);
    }
    const rateEditor = el("section", { class: "fund-rate-editor" },
      el("h3", {}, "Rate history"),
      el("p", { class: "muted" }, "Add each amount and the date it started. Example: ₹500 from 01-01-2016, then ₹1,000 from 01-01-2020. Historical and future dates are accepted. Saved dues and receipts retain their original amounts."),
      old.rates?.length ? table(["Effective from", "Saved amount"], [...old.rates].sort((a, b) => a.from.localeCompare(b.from)).map(r => [r.from, money(r.amount)])) : null,
      rateRows, button("+ Add rate", addRate, "button secondary"),
      el("p", { class: "muted" }, "New dues use the rate effective at the start of the assessment period (January 1 for annual dues, month start for monthly dues), or the fund start date if later. Rates are not prorated. Saved rate entries are read-only."),
    );
    if (!old.id) addRate();
    function toggleRates() {
      rateEditor.hidden = mode.value !== "fixed";
      rateRows.querySelectorAll("input").forEach(control => { control.disabled = mode.value !== "fixed"; });
    }
    mode.addEventListener("change", toggleRates); toggleRates();
    modal.body.append(
      form(
        [
          grid(
            field("Fund title", input("title", old.title, { required: true })),
            field(
              "Payer",
              select(
                "target",
                [
                  ["member", "Member"],
                  ["house", "House"],
                ],
                old.target || "member",
              ),
            ),
            field(
              "Frequency",
              select(
                "frequency",
                [
                  ["annual", "Annual"],
                  ["monthly", "Monthly"],
                  ["one_time", "One time"],
                ],
                old.frequency || "annual",
              ),
            ),
            field(
              "Amount mode",
              mode,
            ),
            field(
              "Fund starts",
              startInput,
            ),
            field(
              "Fund ends (optional)",
              input("end", old.end, { type: "date" }),
            ),
            field(
              "Payment due day (optional, 1–28)",
              input("dueDay", old.dueDay ?? "", {
                type: "number",
                min: 1,
                max: 28,
              }),
              "Leave blank for no payment deadline. Applies to newly generated dues.",
            ),
            field("One-time campaign ID", input("campaign", old.campaign)),
          ),
          field(
            "One-time eligible payer IDs",
            el(
              "textarea",
              { name: "eligibleIds" },
              (old.eligibleIds || []).join(", "),
            ),
          ),
          check("Active fund", "active", old.active ?? true),
          el("p", { class: "hint-box" }, "Advance payments are available for all funds. Fixed-fund advances stay as credit; voluntary contributions are recorded for the selected period."),
          rateEditor,
        ],
        "Save fund",
        async (data) => {
          const rates = [...(old.rates || [])];
          if (str(data, "mode") === "fixed") {
            const dates = data.getAll("rateFrom"), amounts = data.getAll("rateAmount");
            for (let i = 0; i < dates.length; i++) rates.push({ from: String(dates[i]), amount: paise(String(amounts[i])) });
          }
          const value = {
            id: old.id || "fund-" + uid().slice(0, 8),
            title: str(data, "title"),
            target: str(data, "target"),
            frequency: str(data, "frequency"),
            mode: str(data, "mode"),
            start: str(data, "start"),
            end: str(data, "end"),
            dueDay: str(data, "dueDay") ? Number(str(data, "dueDay")) : null,
            campaign: str(data, "campaign"),
            active: data.has("active"),
            advance: true,
            eligibleIds: str(data, "eligibleIds")
              .split(/[\s,]+/)
              .filter(Boolean),
            rates: str(data, "mode") === "voluntary" ? [] : rates,
          };
          await run({ type: "saveFund", value });
          modal.close();
          draw();
          notify("Fund saved");
        },
        modal.close,
      ),
    );
  }
  function generate(fund) {
    const date = today(),
      period = input(
        "period",
        fund.frequency === "annual"
          ? date.slice(0, 4)
          : fund.frequency === "monthly"
            ? date.slice(0, 7)
            : fund.campaign,
        { required: true },
      ),
      preview = el("div", { class: "hint-box" }),
      progress = el("p", { role: "status" }),
      modal = dialog("Generate assessments", [], true);
    function candidates() {
      const s = store.state,
        id = `generation-${fund.id}-${period.value}`,
        saved = s.importJobs.find((j) => j.id === id && j.status === "running");
      const payers = fund.target === "member" ? s.members : s.houses;
      return {
        id,
        saved,
        payers: saved?.payerIds
          ? payers.filter(
              (p) =>
                saved.payerIds.includes(p.id) &&
                !saved.completed.includes(p.id),
            )
          : assessmentPreview(s, fund.id, period.value),
      };
    }
    function show() {
      try {
        const start = periodStart(fund, period.value), rate = rateFor(fund, start < fund.start ? fund.start : start);
        if (!rate) throw new Error("No rate covers this period. Add its historical rate before generating dues.");
        preview.textContent = `${candidates().payers.length} eligible payers · ${money(rate.amount)} each (rate from ${rate.from}). Existing assessments are never duplicated. Available advances will be applied.`;
      } catch (e) {
        preview.textContent = e.message;
      }
    }
    period.addEventListener("input", show);
    show();
    modal.body.append(
      form(
        [
          field(
            "Assessment period",
            period,
            "YYYY for annual, YYYY-MM for monthly, or campaign ID.",
          ),
          preview,
          progress,
        ],
        "Generate dues",
        async () => {
          const { id, saved, payers } = candidates(),
            job = {
              id,
              kind: "assessment",
              fileName: `${fund.title} · ${period.value}`,
              payerIds: saved?.payerIds || payers.map((p) => p.id),
              completed: [...(saved?.completed || [])],
              errors: [],
              createdAt: saved?.createdAt || new Date().toISOString(),
              status: "running",
            };
          period.disabled = true;
          await run({ type: "saveImportJob", value: job });
          try {
            for (const [i, payer] of payers.entries()) {
              progress.textContent = `Generating ${i + 1} of ${payers.length}…`;
              await run(
                {
                  type: "assess",
                  payerId: payer.id,
                  fundId: fund.id,
                  period: period.value,
                },
                `${id}-assess-${payer.id}`,
              );
              const dueId = `${payer.id}_${fund.id}_${period.value}`;
              for (const credit of store.state.credits.filter(
                (c) =>
                  c.payerId === payer.id &&
                  c.fundId === fund.id &&
                  c.amount > 0 &&
                  (fund.frequency === "one_time" ? c.period === period.value : c.period <= period.value),
              )) {
                const due = store.state.dues.find((d) => d.id === dueId),
                  amount = Math.min(credit.amount, outstanding(due));
                if (amount > 0)
                  await run(
                    { type: "applyCredit", creditId: credit.id, dueId, amount },
                    `${id}-credit-${credit.id}`,
                  );
              }
              job.completed.push(payer.id);
              if ((i + 1) % 10 === 0 || i === payers.length - 1)
                await run({
                  type: "saveImportJob",
                  value: {
                    ...job,
                    completed: [...job.completed],
                    status: i === payers.length - 1 ? "complete" : "running",
                  },
                });
            }
            if (!payers.length)
              await run({
                type: "saveImportJob",
                value: { ...job, status: "complete" },
              });
            modal.close();
            draw();
            notify("Assessments generated; available advances applied.");
          } finally {
            period.disabled = false;
          }
        },
        modal.close,
      ),
    );
  }
  function manage(due) {
    const operationId = uid();
    const modal = dialog("Manage due", [], true),
      action = select(
        "action",
        [
          ["waive", "Waive outstanding"],
          ["restoreWaiver", "Restore waived amount"],
          ["applyCredit", "Apply advance"],
        ],
        "waive",
      ),
      credits = store.state.credits.filter(
        (c) =>
          c.payerId === due.payerId && c.fundId === due.fundId && c.amount > 0,
      );
    modal.body.append(
      form(
        [
          el("p", {}, `${due.payerId} · ${due.fundTitle} · ${due.period}`),
          grid(
            field("Action", action),
            field(
              "Amount (₹)",
              input("amount", "", {
                required: true,
                type: "number",
                min: "0.01",
                step: "0.01",
              }),
            ),
          ),
          field(
            "Available advance",
            select("creditId", [
              ["", "Choose an advance"],
              ...credits.map((c) => [c.id, `${c.period} · ${money(c.amount)}`]),
            ]),
          ),
          field("Reason", el("textarea", { name: "reason" })),
        ],
        "Apply change",
        async (data) => {
          const type = str(data, "action"),
            command = {
              type,
              dueId: due.id,
              amount: paise(str(data, "amount")),
            };
          if (type === "applyCredit") command.creditId = str(data, "creditId");
          else command.reason = str(data, "reason");
          await run(command, operationId);
          modal.close();
          draw();
          notify("Due updated");
        },
        modal.close,
      ),
    );
  }
  draw();
  return root;
}
