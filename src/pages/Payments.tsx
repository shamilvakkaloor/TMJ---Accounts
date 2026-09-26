import { useMemo, useRef, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import {
  ArrowLeft,
  Check,
  Plus,
  ReceiptText,
  ShieldCheck,
  Trash2,
} from "lucide-react";
import type { Command, Receipt } from "../domain/types";
import { useApp } from "../data/context";
import { execute } from "../domain/engine";
import { money, outstanding, paise, sum, today, uid } from "../domain/utils";
import { Badge, ErrorBox, Field, PageTitle } from "../ui/components";
export function Payments() {
  const { state: s, run, busy, notify } = useApp();
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const initial = params.get("payer") || "";
  const [type, setType] = useState(
      initial.startsWith("H-") ? "house" : "member",
    ),
    [payer, setPayer] = useState(initial),
    [date, setDate] = useState(today(s.settings[0].timezone)),
    [wallet, setWallet] = useState("cash"),
    [method, setMethod] = useState("Cash"),
    [reference, setReference] = useState(""),
    [tendered, setTendered] = useState(""),
    [lines, setLines] = useState([{ fundId: "", amount: "", dueId: "" }]),
    [error, setError] = useState("");
  const operationId = useRef(uid());
  const payers = type === "member" ? s.members : s.houses;
  const funds = s.funds.filter((f) => f.target === type && f.active);
  const dues = s.dues.filter((d) => d.payerId === payer && outstanding(d) > 0);
  const amounts = lines.map((l) => {
    try {
      return paise(l.amount);
    } catch {
      return 0;
    }
  });
  const total = sum(amounts, (n) => n);
  const command = useMemo<Command>(
    () => ({
      type: "payment",
      payerId: payer,
      date,
      walletId: wallet,
      method,
      reference,
      lines: lines
        .filter((l) => l.fundId && l.amount)
        .map((l) => ({
          fundId: l.fundId,
          amount: (() => {
            try {
              return paise(l.amount);
            } catch {
              return 0;
            }
          })(),
          dueId: l.dueId || undefined,
        })),
    }),
    [payer, date, wallet, method, reference, lines],
  );
  let preview: Receipt | undefined,
    previewError = "";
  try {
    if (payer && command.type === "payment" && command.lines.length) {
      const next = execute(s, command, {
        operationId: operationId.current,
        now: new Date().toISOString(),
        actor: "preview",
      });
      preview = next.receipts.at(-1);
    }
  } catch (e) {
    previewError = (e as Error).message;
  }
  async function submit() {
    setError("");
    try {
      if (!preview)
        throw new Error(previewError || "Choose a payer and add a payment.");
      if (tendered && paise(tendered) < total)
        throw new Error("Tendered amount is less than the collection.");
      const id = await run(command, operationId.current);
      notify("Payment posted and receipt issued");
      navigate("/receipt/" + id);
    } catch (e) {
      setError((e as Error).message);
    }
  }
  return (
    <>
      <Link className="back-link" to="/admin">
        <ArrowLeft size={15} />
        Back to overview
      </Link>
      <PageTitle
        title="Receive a contribution."
        description="One payer, one receipt. Every fund and period stays accounted for."
      />
      <div className="payment-layout">
        <div>
          <section className="panel form-panel">
            <div className="section-step">
              <span>1</span>
              <div>
                <h2>Who is paying?</h2>
                <p>Select a member or a house.</p>
              </div>
            </div>
            <div className="segmented">
              <button
                className={type === "member" ? "active" : ""}
                onClick={() => {
                  setType("member");
                  setPayer("");
                  setLines([{ fundId: "", amount: "", dueId: "" }]);
                }}
              >
                Member payment
              </button>
              <button
                className={type === "house" ? "active" : ""}
                onClick={() => {
                  setType("house");
                  setPayer("");
                  setLines([{ fundId: "", amount: "", dueId: "" }]);
                }}
              >
                House payment
              </button>
            </div>
            <Field label={type === "member" ? "Member" : "House"}>
              <select
                value={payer}
                onChange={(e) => {
                  setPayer(e.target.value);
                  setLines([{ fundId: "", amount: "", dueId: "" }]);
                }}
              >
                <option value="">Select {type}…</option>
                {payers.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name} · {p.id}
                  </option>
                ))}
              </select>
            </Field>
            {payer && (
              <div className="payer-info">
                <span>Total outstanding</span>
                <strong>{money(sum(dues, outstanding))}</strong>
                <Badge tone="gold">{dues.length} unpaid assessments</Badge>
              </div>
            )}
          </section>
          <section className="panel form-panel">
            <div className="section-step">
              <span>2</span>
              <div>
                <h2>Allocate the payment</h2>
                <p>Choose a fund and the amount collected.</p>
              </div>
            </div>
            {lines.map((l, i) => (
              <div className="payment-line" key={i}>
                <div className="form-grid">
                  <Field label="Fund">
                    <select
                      value={l.fundId}
                      onChange={(e) =>
                        setLines(
                          lines.map((x, j) =>
                            j === i
                              ? { ...x, fundId: e.target.value, dueId: "" }
                              : x,
                          ),
                        )
                      }
                    >
                      <option value="">Choose fund</option>
                      {funds.map((f) => (
                        <option value={f.id} key={f.id}>
                          {f.title}
                        </option>
                      ))}
                    </select>
                  </Field>
                  <Field label="Amount (₹)">
                    <input
                      type="number"
                      min="0.01"
                      step="0.01"
                      placeholder="0.00"
                      value={l.amount}
                      onChange={(e) =>
                        setLines(
                          lines.map((x, j) =>
                            j === i ? { ...x, amount: e.target.value } : x,
                          ),
                        )
                      }
                    />
                  </Field>
                  <Field label="Period allocation">
                    <select
                      value={l.dueId}
                      onChange={(e) =>
                        setLines(
                          lines.map((x, j) =>
                            j === i ? { ...x, dueId: e.target.value } : x,
                          ),
                        )
                      }
                    >
                      <option value="">Oldest outstanding first</option>
                      {dues
                        .filter((d) => d.fundId === l.fundId)
                        .map((d) => (
                          <option key={d.id} value={d.id}>
                            {d.period} · {money(outstanding(d))}
                          </option>
                        ))}
                    </select>
                  </Field>
                  <div className="line-remove">
                    {lines.length > 1 && (
                      <button
                        className="text-link danger-text"
                        onClick={() =>
                          setLines(lines.filter((_, j) => j !== i))
                        }
                      >
                        <Trash2 size={15} />
                        Remove line
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))}
            <button
              className="button secondary"
              disabled={lines.length >= 4}
              onClick={() =>
                setLines([...lines, { fundId: "", amount: "", dueId: "" }])
              }
            >
              <Plus size={16} />
              Add another fund
            </button>
            {previewError && (
              <div className="hint-box amber">{previewError}</div>
            )}
          </section>
          <section className="panel form-panel">
            <div className="section-step">
              <span>3</span>
              <div>
                <h2>Payment details</h2>
                <p>Record when and how the money was received.</p>
              </div>
            </div>
            <div className="form-grid">
              <Field label="Payment date">
                <input
                  type="date"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  max={today()}
                />
              </Field>
              <Field label="Payment method">
                <select
                  value={method}
                  onChange={(e) => {
                    setMethod(e.target.value);
                    setWallet(e.target.value === "Cash" ? "cash" : "bank");
                  }}
                >
                  {["Cash", "Bank transfer", "UPI", "Cheque"].map((v) => (
                    <option key={v}>{v}</option>
                  ))}
                </select>
              </Field>
              <Field label="Deposit into">
                <select
                  value={wallet}
                  onChange={(e) => setWallet(e.target.value)}
                >
                  {s.wallets
                    .filter((w) => w.active)
                    .map((w) => (
                      <option key={w.id} value={w.id}>
                        {w.name}
                      </option>
                    ))}
                </select>
              </Field>
              <Field label="Reference (private)">
                <input
                  placeholder="Optional transaction reference"
                  value={reference}
                  onChange={(e) => setReference(e.target.value)}
                />
              </Field>
              {method === "Cash" && (
                <Field label="Cash tendered (optional)">
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={tendered}
                    onChange={(e) => setTendered(e.target.value)}
                    placeholder={(total / 100).toFixed(2)}
                  />
                </Field>
              )}
            </div>
          </section>
        </div>
        <aside className="payment-summary panel">
          <div className="receipt-summary-icon">
            <ReceiptText size={25} />
          </div>
          <h2>Receipt summary</h2>
          <p>Review before you post</p>
          <div className="summary-payer">
            {payers.find((p) => p.id === payer)?.name || "Choose a payer"}
            <small>{payer || "Member or house"}</small>
          </div>
          <div className="summary-lines">
            {preview?.lines.map((l, i) => (
              <div key={i}>
                <span>
                  {l.fundTitle}
                  <small>
                    {l.creditId ? "Advance · " : ""}
                    {l.period}
                  </small>
                </span>
                <strong>{money(l.amount)}</strong>
              </div>
            )) || <p className="muted">Your allocation will appear here.</p>}
          </div>
          <div className="summary-total">
            <span>Total collected</span>
            <strong>{money(total)}</strong>
          </div>
          {tendered && Number(tendered) * 100 >= total && (
            <div className="summary-change">
              Return change{" "}
              <strong>
                {money(Math.round(Number(tendered) * 100) - total)}
              </strong>
            </div>
          )}
          <ErrorBox error={error} />
          <button
            className="button primary full"
            disabled={!preview || busy}
            onClick={() => void submit()}
          >
            <Check size={17} />
            {busy ? "Posting payment…" : "Post payment & issue receipt"}
          </button>
          <div className="secure-note">
            <ShieldCheck size={15} />
            Saved together with allocations and cashbook.
          </div>
        </aside>
      </div>
    </>
  );
}
