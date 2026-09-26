import { useEffect, useState } from "react";
import { CalendarDays, Coins, Pencil, Plus } from "lucide-react";
import { useApp } from "../data/context";
import type { Due, Fund } from "../domain/types";
import { assessmentPreview } from "../domain/engine";
import {
  dueStatus,
  money,
  outstanding,
  paise,
  sum,
  today,
  uid,
} from "../domain/utils";
import {
  AsyncForm,
  Badge,
  Dialog,
  Empty,
  ErrorBox,
  Field,
  PageTitle,
  Pagination,
  str,
} from "../ui/components";
export function Funds() {
  const { state: s, run, getCurrent, notify } = useApp();
  const [tab, setTab] = useState("funds"),
    [edit, setEdit] = useState<Fund | "new" | null>(null),
    [generate, setGenerate] = useState<Fund | null>(null),
    [period, setPeriod] = useState(today().slice(0, 4)),
    [progress, setProgress] = useState(""),
    [error, setError] = useState(""),
    [selected, setSelected] = useState<Due | null>(null),
    [action, setAction] = useState("waive"),
    [filter, setFilter] = useState(""),
    [status, setStatus] = useState(""),
    [page, setPage] = useState(1);
  useEffect(() => setPage(1), [filter, status]);
  let candidates: { id: string; name: string }[] = [];
  const generationId = generate ? `generation-${generate.id}-${period}` : "";
  const savedJob = s.importJobs.find(
    (j) => j.id === generationId && j.status === "running",
  );
  if (generate) {
    try {
      const payers = generate.target === "member" ? s.members : s.houses;
      candidates = savedJob?.payerIds
        ? payers.filter(
            (p) =>
              savedJob.payerIds!.includes(p.id) &&
              !savedJob.completed.includes(p.id),
          )
        : assessmentPreview(s, generate.id, period);
    } catch {
      /* period input may be incomplete */
    }
  }
  const dues = s.dues.filter(
    (d) =>
      (!filter || d.fundId === filter) && (!status || dueStatus(d) === status),
  );
  async function generateDues() {
    if (!generate) return;
    setError("");
    try {
      const job = {
        id: generationId,
        kind: "assessment",
        fileName: `${generate.title} · ${period}`,
        payerIds: savedJob?.payerIds || candidates.map((p) => p.id),
        completed: [...(savedJob?.completed || [])],
        errors: [],
        createdAt: savedJob?.createdAt || new Date().toISOString(),
        status: "running",
      };
      await run({ type: "saveImportJob", value: job });
      for (let i = 0; i < candidates.length; i++) {
        const p = candidates[i];
        setProgress(`Generating ${i + 1} of ${candidates.length}…`);
        await run(
          {
            type: "assess",
            payerId: p.id,
            fundId: generate.id,
            period,
          },
          `${generationId}-assess-${p.id}`,
        );
        const did = `${p.id}_${generate.id}_${period}`;
        for (const c of getCurrent().credits.filter(
          (c) =>
            c.payerId === p.id &&
            c.fundId === generate.id &&
            c.amount > 0 &&
            c.period <= period,
        )) {
          const d = getCurrent().dues.find((d) => d.id === did)!;
          const n = Math.min(c.amount, outstanding(d));
          if (n > 0)
            await run(
              {
                type: "applyCredit",
                creditId: c.id,
                dueId: did,
                amount: n,
              },
              `${generationId}-credit-${c.id}`,
            );
        }
        job.completed.push(p.id);
        if ((i + 1) % 10 === 0 || i === candidates.length - 1)
          await run({
            type: "saveImportJob",
            value: {
              ...job,
              completed: [...job.completed],
              status: i === candidates.length - 1 ? "complete" : "running",
            },
          });
      }
      notify("Assessments generated. Available advances were applied.");
      setGenerate(null);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setProgress("");
    }
  }
  return (
    <>
      <PageTitle
        title="A purpose for every contribution."
        description="Configure funds, assess dues and keep every balance clear."
        action={
          <button className="button primary" onClick={() => setEdit("new")}>
            <Plus size={17} />
            Create fund
          </button>
        }
      />
      <div className="tabs page-tabs">
        <button
          className={tab === "funds" ? "active" : ""}
          onClick={() => setTab("funds")}
        >
          Fund directory
        </button>
        <button
          className={tab === "dues" ? "active" : ""}
          onClick={() => setTab("dues")}
        >
          Dues & waivers <span>{s.dues.length}</span>
        </button>
      </div>
      {tab === "funds" ? (
        <div className="fund-grid">
          {s.funds.map((f) => {
            const ds = s.dues.filter((d) => d.fundId === f.id);
            const rates = [...f.rates].sort((a, b) =>
              b.from.localeCompare(a.from),
            );
            const rate = rates.find((r) => r.from <= today());
            return (
              <section className="panel fund-card" key={f.id}>
                <div className="fund-card-top">
                  <div className="fund-icon">
                    <Coins size={23} />
                  </div>
                  <Badge tone={f.active ? "green" : "neutral"}>
                    {f.active ? "Active" : "Inactive"}
                  </Badge>
                  <button
                    className="icon-button"
                    aria-label={"Edit " + f.title}
                    onClick={() => setEdit(f)}
                  >
                    <Pencil size={16} />
                  </button>
                </div>
                <h2>{f.title}</h2>
                <p>
                  {f.target === "member" ? "Per member" : "Per house"}{" "}
                  <span>·</span> {f.frequency.replace("_", " ")}
                </p>
                <div className="fund-price">
                  {f.mode === "voluntary"
                    ? "Any contribution"
                    : money(rate?.amount || 0)}
                  <small>
                    {f.mode === "voluntary"
                      ? "No assessed dues"
                      : "Current rate"}
                  </small>
                </div>
                <div className="fund-card-summary">
                  <div>
                    <span>Assessed</span>
                    <strong>{money(sum(ds, (d) => d.assessed))}</strong>
                  </div>
                  <div>
                    <span>Outstanding</span>
                    <strong>{money(sum(ds, outstanding))}</strong>
                  </div>
                </div>
                {f.mode === "fixed" ? (
                  <button
                    className="button secondary full"
                    onClick={() => {
                      setPeriod(
                        f.frequency === "annual"
                          ? today().slice(0, 4)
                          : f.frequency === "monthly"
                            ? today().slice(0, 7)
                            : f.campaign,
                      );
                      setGenerate(f);
                      setError("");
                    }}
                  >
                    <CalendarDays size={16} />
                    Generate assessments
                  </button>
                ) : (
                  <div className="voluntary-note">
                    Voluntary gifts never create an unpaid balance.
                  </div>
                )}
              </section>
            );
          })}
          {!s.funds.length && (
            <Empty
              title="Create your first fund"
              text="Choose who contributes, how often, and the amount."
            />
          )}
        </div>
      ) : (
        <section className="panel">
          <div className="toolbar">
            <h2>Assessed dues</h2>
            <div className="filters">
              <select
                aria-label="Filter fund"
                value={filter}
                onChange={(e) => setFilter(e.target.value)}
              >
                <option value="">All funds</option>
                {s.funds.map((f) => (
                  <option key={f.id} value={f.id}>
                    {f.title}
                  </option>
                ))}
              </select>
              <select
                aria-label="Filter payment status"
                value={status}
                onChange={(e) => setStatus(e.target.value)}
              >
                <option value="">All statuses</option>
                {["unpaid", "partial", "paid", "waived"].map((x) => (
                  <option key={x}>{x}</option>
                ))}
              </select>
            </div>
          </div>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>PAYER</th>
                  <th>FUND / PERIOD</th>
                  <th>ASSESSED</th>
                  <th>PAID / WAIVED</th>
                  <th>OUTSTANDING</th>
                  <th>STATUS</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {dues.slice((page - 1) * 10, page * 10).map((d) => (
                  <tr key={d.id}>
                    <td>
                      <strong>
                        {s.members.find((p) => p.id === d.payerId)?.name ||
                          s.houses.find((p) => p.id === d.payerId)?.name}
                      </strong>
                      <small>{d.payerId}</small>
                    </td>
                    <td>
                      {d.fundTitle}
                      <small>{d.period}</small>
                    </td>
                    <td>{money(d.assessed)}</td>
                    <td>
                      {money(d.paid)}
                      <small>{money(d.waived)} waived</small>
                    </td>
                    <td className="amount">{money(outstanding(d))}</td>
                    <td>
                      <Badge
                        tone={
                          dueStatus(d) === "paid"
                            ? "green"
                            : dueStatus(d) === "partial"
                              ? "gold"
                              : "neutral"
                        }
                      >
                        {dueStatus(d)}
                      </Badge>
                    </td>
                    <td>
                      <button
                        className="text-link"
                        onClick={() => {
                          setSelected(d);
                          setAction("waive");
                        }}
                      >
                        Manage
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {!dues.length && <Empty title="No assessments match" />}
          <Pagination page={page} setPage={setPage} total={dues.length} />
        </section>
      )}
      {generate && (
        <Dialog
          title={`Generate · ${generate.title}`}
          onClose={() => {
            if (!progress) setGenerate(null);
          }}
        >
          <Field
            label={
              generate.frequency === "one_time"
                ? "Campaign"
                : "Assessment period"
            }
          >
            <input
              value={period}
              onChange={(e) => setPeriod(e.target.value)}
              disabled={!!progress || generate.frequency === "one_time"}
              type={generate.frequency === "monthly" ? "month" : "text"}
            />
          </Field>
          <div className="generation-preview">
            <strong>{candidates.length}</strong>
            <span>
              {savedJob
                ? "payers remaining in the saved generation"
                : "eligible payers with no assessment"}
            </span>
            <p>
              Existing dues are preserved. This operation is safe to resume if
              interrupted.
            </p>
          </div>
          <div className="preview-list">
            {candidates.slice(0, 8).map((p) => (
              <div key={p.id}>
                <span>{p.name}</span>
                <small>{p.id}</small>
              </div>
            ))}
            {candidates.length > 8 && (
              <small>and {candidates.length - 8} more</small>
            )}
          </div>
          <ErrorBox error={error} />
          <div className="form-actions">
            <button
              className="button primary"
              onClick={() => void generateDues()}
              disabled={!candidates.length || !!progress}
            >
              {progress || "Confirm & generate"}
            </button>
          </div>
        </Dialog>
      )}
      {edit && (
        <Dialog
          title={
            edit === "new" ? "Create a fund" : "Edit fund & add future rate"
          }
          onClose={() => setEdit(null)}
          wide
        >
          <AsyncForm
            onCancel={() => setEdit(null)}
            onSubmit={async (f) => {
              const old = edit === "new" ? null : edit;
              const mode = str(f, "mode") as Fund["mode"];
              const rates = old ? [...old.rates] : [];
              if (str(f, "amount"))
                rates.push({
                  from: str(f, "rateFrom"),
                  amount: paise(str(f, "amount")),
                });
              const v: Fund = {
                id: old?.id || "fund-" + uid().slice(0, 8),
                title: str(f, "title"),
                target: str(f, "target") as Fund["target"],
                frequency: str(f, "frequency") as Fund["frequency"],
                mode,
                start: str(f, "start"),
                end: str(f, "end"),
                active: f.has("active"),
                rates: mode === "voluntary" ? [] : rates,
                dueDay: Number(str(f, "dueDay")),
                advance: f.has("advance"),
                campaign: str(f, "campaign"),
                eligibleIds: str(f, "eligibleIds")
                  .split(/[\s,]+/)
                  .filter(Boolean),
              };
              await run({ type: "saveFund", value: v });
              notify("Fund saved");
              setEdit(null);
            }}
          >
            <div className="form-grid">
              <Field label="Fund title">
                <input
                  name="title"
                  required
                  defaultValue={edit === "new" ? "" : edit.title}
                />
              </Field>
              <Field label="Payer">
                <select
                  name="target"
                  defaultValue={edit === "new" ? "member" : edit.target}
                >
                  <option value="member">Member</option>
                  <option value="house">House</option>
                </select>
              </Field>
              <Field label="Frequency">
                <select
                  name="frequency"
                  defaultValue={edit === "new" ? "annual" : edit.frequency}
                >
                  <option value="annual">Annual</option>
                  <option value="monthly">Monthly</option>
                  <option value="one_time">One time</option>
                </select>
              </Field>
              <Field label="Amount mode">
                <select
                  name="mode"
                  defaultValue={edit === "new" ? "fixed" : edit.mode}
                >
                  <option value="fixed">Fixed due</option>
                  <option value="voluntary">Voluntary donation</option>
                </select>
              </Field>
              <Field
                label={edit === "new" ? "Rate (₹)" : "Add future rate (₹)"}
                hint="Leave empty to keep existing rates."
              >
                <input name="amount" type="number" step="0.01" min="0.01" />
              </Field>
              <Field label="Rate effective from">
                <input name="rateFrom" type="date" defaultValue={today()} />
              </Field>
              <Field label="Fund starts">
                <input
                  name="start"
                  type="date"
                  required
                  defaultValue={
                    edit === "new" ? today().slice(0, 4) + "-01-01" : edit.start
                  }
                />
              </Field>
              <Field label="Fund ends (optional)">
                <input
                  name="end"
                  type="date"
                  defaultValue={edit === "new" ? "" : edit.end}
                />
              </Field>
              <Field label="Payment due day (1–28)">
                <input
                  name="dueDay"
                  type="number"
                  min="1"
                  max="28"
                  required
                  defaultValue={edit === "new" ? 28 : edit.dueDay}
                />
              </Field>
              <Field label="One-time campaign ID">
                <input
                  name="campaign"
                  defaultValue={edit === "new" ? "" : edit.campaign}
                />
              </Field>
            </div>
            <Field
              label="One-time eligible payer IDs"
              hint="Comma-separated IDs, e.g. H-000001, H-000002."
            >
              <textarea
                name="eligibleIds"
                defaultValue={edit === "new" ? "" : edit.eligibleIds.join(", ")}
              />
            </Field>
            <label className="check">
              <input
                type="checkbox"
                name="active"
                defaultChecked={edit === "new" || edit.active}
              />
              Active fund
            </label>
            <label className="check">
              <input
                type="checkbox"
                name="advance"
                defaultChecked={edit !== "new" && edit.advance}
              />
              Allow next-year advances (annual member fund only)
            </label>
            {edit !== "new" && edit.rates.length > 0 && (
              <div className="hint-box">
                Rate history:{" "}
                {edit.rates
                  .map((r) => `${r.from}: ${money(r.amount)}`)
                  .join(" · ")}
                . Existing rates are preserved.
              </div>
            )}
          </AsyncForm>
        </Dialog>
      )}
      {selected && (
        <Dialog
          title={`Manage due · ${selected.payerId}`}
          onClose={() => setSelected(null)}
        >
          <AsyncForm
            onCancel={() => setSelected(null)}
            onSubmit={async (f) => {
              const amount = paise(str(f, "amount"));
              if (action === "credit")
                await run({
                  type: "applyCredit",
                  creditId: str(f, "creditId"),
                  dueId: selected.id,
                  amount,
                });
              else
                await run({
                  type: action === "waive" ? "waive" : "restoreWaiver",
                  dueId: selected.id,
                  amount,
                  reason: str(f, "reason"),
                });
              notify("Balance updated");
              setSelected(null);
            }}
          >
            <p>
              {selected.fundTitle} · {selected.period} ·{" "}
              {money(outstanding(selected))} outstanding
            </p>
            <Field label="Action">
              <select
                value={action}
                onChange={(e) => setAction(e.target.value)}
              >
                <option value="waive">Waive outstanding amount</option>
                <option value="restore">Restore an earlier waiver</option>
                <option value="credit">Apply prepaid credit</option>
              </select>
            </Field>
            {action === "credit" && (
              <Field label="Available credit">
                <select name="creditId" required>
                  <option value="">Choose credit</option>
                  {s.credits
                    .filter(
                      (c) =>
                        c.payerId === selected.payerId &&
                        c.fundId === selected.fundId &&
                        c.amount > 0,
                    )
                    .map((c) => (
                      <option key={c.id} value={c.id}>
                        {money(c.amount)} · for {c.period} onwards
                      </option>
                    ))}
                </select>
              </Field>
            )}
            <Field label="Amount (₹)">
              <input
                name="amount"
                required
                type="number"
                min="0.01"
                step="0.01"
              />
            </Field>
            {action !== "credit" && (
              <Field label="Reason">
                <textarea name="reason" required minLength={3} />
              </Field>
            )}
          </AsyncForm>
        </Dialog>
      )}
    </>
  );
}
