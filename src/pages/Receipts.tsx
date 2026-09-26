import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import {
  ArrowLeft,
  ArrowUpRight,
  Plus,
  Printer,
  RotateCcw,
} from "lucide-react";
import { QRCodeSVG } from "qrcode.react";
import type { Receipt, Settings } from "../domain/types";
import { useApp } from "../data/context";
import { publicDoc } from "../data/repository";
import { appUrl, assetUrl } from "../data/urls";
import { displayDate, money, norm, paise, today } from "../domain/utils";
import {
  AsyncForm,
  Badge,
  Dialog,
  Empty,
  ErrorBox,
  Field,
  PageTitle,
  Pagination,
  SearchBox,
  str,
} from "../ui/components";
export type PrintableReceipt = Receipt & { voided: boolean; refunded: number };
export function ReceiptPaper({
  receipt: r,
  settings: s,
}: {
  receipt: PrintableReceipt;
  settings: Settings;
}) {
  return (
    <article className="receipt-paper">
      <div className="receipt-brand">
        {s.logo && <img src={assetUrl(s.logo)} alt="Mahal logo" />}
        <h2>{s.name}</h2>
        <p>{s.address}</p>
        <p>{s.contact}</p>
      </div>
      <div className="receipt-caption">
        PAYMENT RECEIPT{" "}
        {r.voided && <strong className="void-label">VOID</strong>}
      </div>
      <div className="receipt-meta">
        <strong>{r.number}</strong>
        <span>{displayDate(r.date)}</span>
      </div>
      <div className="receipt-payer">
        <small>RECEIVED FROM</small>
        <strong>{r.payerName}</strong>
        <p>
          {r.payerId} · {r.houseName}
        </p>
        <p>{r.subMahalName}</p>
      </div>
      <table>
        <thead>
          <tr>
            <th>Fund / period</th>
            <th className="right">Amount</th>
          </tr>
        </thead>
        <tbody>
          {r.lines.map((l, i) => (
            <tr key={i}>
              <td>
                {l.fundTitle}
                <small>
                  {l.period}
                  {l.creditId ? " · advance" : ""}
                </small>
              </td>
              <td className="right">{money(l.amount)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <div className="receipt-total">
        <span>Amount received</span>
        <strong>{money(r.total)}</strong>
      </div>
      <p className="receipt-method">
        Paid by {r.method}
        {r.refunded > 0 ? ` · Returned ${money(r.refunded)}` : ""}
      </p>
      {r.outstandingAfter !== null && (
        <p className="receipt-method">
          At issue · Outstanding {money(r.outstandingAfter)} · Advance{" "}
          {money(r.advanceAfter || 0)}
        </p>
      )}
      <p className="receipt-method">
        Issued{" "}
        {new Intl.DateTimeFormat("en-IN", {
          dateStyle: "short",
          timeStyle: "short",
          timeZone: s.timezone,
        }).format(new Date(r.postedAt))}
      </p>
      {r.historical && <p>Historical statement only · {r.legacyNumber}</p>}
      <div className="receipt-bottom">
        <QRCodeSVG
          value={appUrl(`/receipt/${r.id}`)}
          title={appUrl(`/receipt/${r.id}`)}
          size={65}
        />
        <div>
          <strong>Thank you for your contribution.</strong>
          <p>Scan to verify this receipt and its current status.</p>
          <small>
            {r.voided
              ? "Reversed receipt"
              : r.refunded === r.total
                ? "Fully refunded"
                : r.refunded > 0
                  ? "Partially refunded"
                  : "Valid receipt"}
          </small>
        </div>
      </div>
    </article>
  );
}
export function Receipts() {
  const { state: s } = useApp();
  const [search, setSearch] = useState(""),
    [page, setPage] = useState(1),
    [status, setStatus] = useState("");
  useEffect(() => setPage(1), [search, status]);
  const rows = [...s.receipts]
    .reverse()
    .filter(
      (r) =>
        norm(r.number + " " + r.payerName + " " + r.payerId).includes(
          norm(search),
        ) &&
        (!status ||
          (status === "void"
            ? s.receiptStates.find((x) => x.id === r.id)?.voided
            : !s.receiptStates.find((x) => x.id === r.id)?.voided)),
    );
  return (
    <>
      <PageTitle
        title="Every payment has a story."
        description="Find, verify and reprint the original record of each contribution."
        action={
          <Link className="button primary" to="/admin/receive">
            <Plus size={17} />
            Receive payment
          </Link>
        }
      />
      <section className="panel">
        <div className="toolbar">
          <SearchBox
            value={search}
            onChange={setSearch}
            placeholder="Search receipt or payer…"
          />
          <select
            aria-label="Receipt status"
            value={status}
            onChange={(e) => setStatus(e.target.value)}
          >
            <option value="">All receipts</option>
            <option value="valid">Valid</option>
            <option value="void">Void</option>
          </select>
        </div>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>RECEIPT NUMBER</th>
                <th>DATE</th>
                <th>PAYER</th>
                <th>SUB MAHAL</th>
                <th>STATUS</th>
                <th className="right">AMOUNT</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {rows.slice((page - 1) * 10, page * 10).map((r) => {
                const rs = s.receiptStates.find((x) => x.id === r.id);
                return (
                  <tr key={r.id}>
                    <td>
                      <Link className="record-id" to={"/receipt/" + r.id}>
                        {r.number}
                      </Link>
                    </td>
                    <td>{displayDate(r.date)}</td>
                    <td>
                      <strong>{r.payerName}</strong>
                      <small>{r.payerId}</small>
                    </td>
                    <td>{r.subMahalName}</td>
                    <td>
                      <Badge
                        tone={
                          rs?.voided ? "red" : rs?.refunded ? "gold" : "green"
                        }
                      >
                        {rs?.voided
                          ? "Void"
                          : rs?.refunded
                            ? "Refunded"
                            : "Valid"}
                      </Badge>
                    </td>
                    <td className="amount right">{money(r.total)}</td>
                    <td>
                      <Link
                        aria-label={"Open " + r.number}
                        to={"/receipt/" + r.id}
                      >
                        <ArrowUpRight size={18} />
                      </Link>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        {!rows.length && <Empty title="No receipts found" />}
        <Pagination page={page} setPage={setPage} total={rows.length} />
      </section>
    </>
  );
}
export function ReceiptPage() {
  const { id = "" } = useParams();
  const { state: s, admin, run, notify } = useApp();
  const [data, setData] = useState<PrintableReceipt | null>(null),
    [settings, setSettings] = useState<Settings>(s.settings[0]),
    [error, setError] = useState(""),
    [correction, setCorrection] = useState(false),
    [action, setAction] = useState("refund"),
    [loading, setLoading] = useState(true);
  const original = s.receipts.find((r) => r.id === id);
  const rs = s.receiptStates.find((r) => r.id === id);
  useEffect(() => {
    let active = true;
    if (admin && original) {
      setData({
        ...original,
        voided: rs?.voided || false,
        refunded: rs?.refunded || 0,
      });
      setSettings(s.settings[0]);
      setLoading(false);
      return;
    }
    Promise.all([
      publicDoc("publicReceipts", id),
      publicDoc("publicSettings", "mahal"),
    ])
      .then(([r, st]) => {
        if (active) {
          setData(r as PrintableReceipt | null);
          if (st) setSettings(st as Settings);
        }
      })
      .catch((e) => active && setError(e.message))
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
  }, [id, admin, original, rs, s.settings]);
  return (
    <div className="standalone receipt-page">
      <div className="print-toolbar">
        <Link className="back-link" to={admin ? "/admin/receipts" : "/"}>
          <ArrowLeft size={16} />
          Back
        </Link>
        <div>
          {admin &&
            data &&
            !data.voided &&
            !data.historical &&
            data.refunded < data.total && (
              <button
                className="button secondary"
                onClick={() => setCorrection(true)}
              >
                <RotateCcw size={16} />
                Correct / refund
              </button>
            )}
          <button
            className="button primary"
            onClick={() => window.print()}
            disabled={!data}
          >
            <Printer size={16} />
            Print A6 receipt
          </button>
        </div>
      </div>
      <ErrorBox error={error} />
      {loading ? (
        <div className="loading">Loading receipt…</div>
      ) : data ? (
        <>
          <ReceiptPaper receipt={data} settings={settings} />
          <p className="print-help">
            Print on A6 portrait paper at 100% scale. Disable browser headers
            and footers.
          </p>
        </>
      ) : (
        <Empty
          title="Receipt unavailable"
          text="Check the verification link or contact the Mahal administrator."
        />
      )}
      {correction && data && (
        <Dialog
          title={"Correct " + data.number}
          onClose={() => setCorrection(false)}
        >
          <AsyncForm
            onCancel={() => setCorrection(false)}
            submit={
              action === "void" ? "Void remaining receipt" : "Issue refund"
            }
            onSubmit={async (f) => {
              await run(
                action === "void"
                  ? {
                      type: "void",
                      receiptId: id,
                      date: str(f, "date"),
                      reason: str(f, "reason"),
                    }
                  : {
                      type: "refund",
                      receiptId: id,
                      date: str(f, "date"),
                      walletId: str(f, "wallet"),
                      amount: paise(str(f, "amount")),
                      reason: str(f, "reason"),
                    },
              );
              notify("Correction recorded with its audit history");
              setCorrection(false);
            }}
          >
            <div className="hint-box">
              Paid allocations reopen their dues. Refunds reduce cash; waivers
              are separate. Original receipt details are retained.
            </div>
            <Field label="Correction">
              <select
                value={action}
                onChange={(e) => setAction(e.target.value)}
              >
                <option value="refund">
                  Refund some or all of the payment
                </option>
                <option value="void">Void the remaining receipt</option>
              </select>
            </Field>
            {action === "refund" && (
              <>
                <Field label="Refund amount (₹)">
                  <input
                    name="amount"
                    type="number"
                    min="0.01"
                    step="0.01"
                    max={(data.total - data.refunded) / 100}
                    required
                    defaultValue={(data.total - data.refunded) / 100}
                  />
                </Field>
                <Field label="Refund from">
                  <select name="wallet" defaultValue={data.walletId}>
                    {s.wallets.map((w) => (
                      <option key={w.id} value={w.id}>
                        {w.name}
                      </option>
                    ))}
                  </select>
                </Field>
              </>
            )}
            <Field label="Correction date">
              <input
                name="date"
                type="date"
                required
                defaultValue={today()}
                max={today()}
              />
            </Field>
            <Field label="Reason">
              <textarea name="reason" required minLength={3} />
            </Field>
          </AsyncForm>
        </Dialog>
      )}
    </div>
  );
}
