import { useState } from "react";
import { Download, Printer } from "lucide-react";
import Papa from "papaparse";
import { useApp } from "../data/context";
import {
  displayDate,
  download,
  money,
  outstanding,
  sum,
  today,
} from "../domain/utils";
import { PageTitle, Pagination, SearchBox, Stat } from "../ui/components";
import { Badge } from "../ui/components";
import { HandCoins, ReceiptText, ArrowUpRight, Wallet } from "lucide-react";
export function Reports() {
  const { state: s } = useApp();
  const [from, setFrom] = useState(today().slice(0, 4) + "-01-01"),
    [to, setTo] = useState(today()),
    [sub, setSub] = useState(""),
    [fund, setFund] = useState(""),
    [tab, setTab] = useState("collections");
  const led = s.ledger.filter((l) => l.date >= from && l.date <= to);
  const collectionOps = s.operations.filter(
    (o) =>
      ["payment", "refund", "void"].includes(o.kind) &&
      o.date >= from &&
      o.date <= to &&
      s.receipts.some(
        (r) =>
          r.id === o.receiptId &&
          !r.historical &&
          (!sub || r.subMahalId === sub),
      ),
  );
  const net = (subId?: string, fundId?: string) =>
    sum(
      collectionOps.filter(
        (o) =>
          !subId ||
          s.receipts.find((r) => r.id === o.receiptId)?.subMahalId === subId,
      ),
      (o) =>
        sum(
          o.fundAmounts.filter(
            (l) =>
              (!fund || l.fundId === fund) && (!fundId || l.fundId === fundId),
          ),
          (l) => l.amount,
        ),
    );
  const totals = s.subMahals.map((m) => ({ name: m.name, amount: net(m.id) }));
  const outstandingRows = s.dues.filter(
    (d) =>
      (!fund || d.fundId === fund) &&
      d.dueDate >= from &&
      d.dueDate <= to &&
      outstanding(d) > 0,
  );
  const max = Math.max(...totals.map((t) => t.amount), 1);
  const exportCsv = () => {
    const rows =
      tab === "outstanding"
        ? outstandingRows.map((d) => ({
            payer: d.payerId,
            fund: d.fundTitle,
            period: d.period,
            assessed: d.assessed / 100,
            waived: d.waived / 100,
            paid: d.paid / 100,
            outstanding: outstanding(d) / 100,
          }))
        : tab === "cashbook"
          ? led.map((l) => ({
              date: l.date,
              wallet: s.wallets.find((w) => w.id === l.walletId)?.name,
              type: l.kind,
              category: l.category,
              description: l.description,
              amount: l.amount / 100,
            }))
          : collectionOps.flatMap((o) =>
              o.fundAmounts
                .filter((l) => !fund || l.fundId === fund)
                .map((l) => {
                  const r = s.receipts.find((r) => r.id === o.receiptId)!;
                  return {
                    date: o.date,
                    receipt: r.number,
                    payer: r.payerName,
                    subMahal: r.subMahalName,
                    fund: s.funds.find((f) => f.id === l.fundId)?.title,
                    type: o.kind,
                    amount: l.amount / 100,
                  };
                }),
            );
    download(
      `mahal-${tab}-${from}-${to}.csv`,
      "\ufeff" +
        Papa.unparse<Record<string, unknown>>(rows, { escapeFormulae: true }),
      "text/csv;charset=utf-8",
    );
  };
  return (
    <>
      <PageTitle
        title="Numbers you can account for."
        description="Trace collections, understand outstanding dues and reconcile your cashbook."
        action={
          <>
            <button className="button secondary" onClick={() => window.print()}>
              <Printer size={16} />
              Print
            </button>
            <button className="button primary" onClick={exportCsv}>
              <Download size={16} />
              Export CSV
            </button>
          </>
        }
      />
      <section className="panel report-filters">
        <label>
          From
          <input
            aria-label="Report from"
            type="date"
            value={from}
            onChange={(e) => setFrom(e.target.value)}
          />
        </label>
        <label>
          To
          <input
            aria-label="Report to"
            type="date"
            value={to}
            onChange={(e) => setTo(e.target.value)}
          />
        </label>
        <label>
          Fund
          <select value={fund} onChange={(e) => setFund(e.target.value)}>
            <option value="">All funds</option>
            {s.funds.map((f) => (
              <option key={f.id} value={f.id}>
                {f.title}
              </option>
            ))}
          </select>
        </label>
        <label>
          Payment-date Sub Mahal
          <select value={sub} onChange={(e) => setSub(e.target.value)}>
            <option value="">All Sub Mahals</option>
            {s.subMahals.map((m) => (
              <option key={m.id} value={m.id}>
                {m.name}
              </option>
            ))}
          </select>
        </label>
      </section>
      <div className="stats-grid">
        <Stat
          label="Net collections"
          value={money(net())}
          detail="Receipts less dated refunds & reversals"
          icon={<HandCoins />}
          tone="featured"
        />
        <Stat
          label="Other income"
          value={money(
            sum(
              led.filter((l) => l.kind === "income"),
              (l) => l.amount,
            ),
          )}
          detail="Central accounts · no Sub Mahal tag"
          icon={<Wallet />}
        />
        <Stat
          label="Expenditure"
          value={money(
            -sum(
              led.filter((l) => l.kind === "expense"),
              (l) => l.amount,
            ),
          )}
          detail="Transfers excluded"
          icon={<ArrowUpRight />}
        />
        <Stat
          label="Outstanding"
          value={money(sum(outstandingRows, outstanding))}
          detail="Current balance of dues dated in range"
          icon={<ReceiptText />}
        />
      </div>
      <div className="tabs page-tabs">
        <button
          className={tab === "collections" ? "active" : ""}
          onClick={() => setTab("collections")}
        >
          Collection summary
        </button>
        <button
          className={tab === "outstanding" ? "active" : ""}
          onClick={() => setTab("outstanding")}
        >
          Outstanding dues
        </button>
        <button
          className={tab === "cashbook" ? "active" : ""}
          onClick={() => setTab("cashbook")}
        >
          Cashbook reconciliation
        </button>
      </div>
      {tab === "collections" ? (
        <div className="report-grid">
          <section className="panel">
            <div className="panel-heading">
              <div>
                <h2>Collections by Sub Mahal</h2>
                <p>Attribution preserved from the original payment</p>
              </div>
            </div>
            <div className="sub-chart">
              {totals.map((t) => (
                <div key={t.name}>
                  <span>{t.name}</span>
                  <div className="bar">
                    <i
                      style={{
                        width: `${(Math.max(0, t.amount) / max) * 100}%`,
                      }}
                    />
                  </div>
                  <strong>{money(t.amount)}</strong>
                </div>
              ))}
            </div>
            <div className="panel-footer">
              <strong>Total across ten Sub Mahals</strong>
              <strong>{money(sum(totals, (t) => t.amount))}</strong>
            </div>
          </section>
          <section className="panel">
            <div className="panel-heading">
              <h2>Collections by fund</h2>
            </div>
            <div className="fund-report">
              {s.funds
                .filter((f) => !fund || f.id === fund)
                .map((f) => (
                  <div key={f.id}>
                    <div>
                      <strong>{f.title}</strong>
                      <small>
                        {f.target} · {f.mode}
                      </small>
                    </div>
                    <strong>{money(net(undefined, f.id))}</strong>
                  </div>
                ))}
            </div>
            <div className="hint-box">
              Cash receipts include advance payments. Advances remain separately
              identifiable; this report is not an accrual revenue statement.
            </div>
          </section>
        </div>
      ) : tab === "outstanding" ? (
        <section className="panel">
          <div className="panel-heading">
            <h2>Outstanding by assessment period</h2>
          </div>
          <p className="table-note">
            Fund and due-date filters apply. Sub Mahal filter applies to
            collections only.
          </p>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>PAYER</th>
                  <th>FUND</th>
                  <th>PERIOD</th>
                  <th>DUE DATE</th>
                  <th>WAIVED</th>
                  <th className="right">OUTSTANDING</th>
                </tr>
              </thead>
              <tbody>
                {outstandingRows.map((d) => (
                  <tr key={d.id}>
                    <td>{d.payerId}</td>
                    <td>{d.fundTitle}</td>
                    <td>{d.period}</td>
                    <td>{displayDate(d.dueDate)}</td>
                    <td>{money(d.waived)}</td>
                    <td className="right amount">{money(outstanding(d))}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      ) : (
        <section className="panel">
          <div className="panel-heading">
            <div>
              <h2>Wallet reconciliation</h2>
              <p>Opening balance + movements = closing balance</p>
            </div>
          </div>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>WALLET</th>
                  <th>OPENING AT {from}</th>
                  <th>INFLOWS</th>
                  <th>OUTFLOWS</th>
                  <th>CLOSING AT {to}</th>
                </tr>
              </thead>
              <tbody>
                {s.wallets.map((w) => {
                  const opening = sum(
                    s.ledger.filter(
                      (l) => l.walletId === w.id && l.date < from,
                    ),
                    (l) => l.amount,
                  );
                  const rows = led.filter((l) => l.walletId === w.id);
                  return (
                    <tr key={w.id}>
                      <td>{w.name}</td>
                      <td>{money(opening)}</td>
                      <td>
                        {money(
                          sum(
                            rows.filter((l) => l.amount > 0),
                            (l) => l.amount,
                          ),
                        )}
                      </td>
                      <td>
                        {money(
                          -sum(
                            rows.filter((l) => l.amount < 0),
                            (l) => l.amount,
                          ),
                        )}
                      </td>
                      <td className="amount">
                        {money(opening + sum(rows, (l) => l.amount))}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <div className="hint-box">
            Reconciliation includes transfers and opening entries. Income and
            expenditure totals exclude both. Fund and Sub Mahal filters do not
            apply to central wallets.
          </div>
        </section>
      )}
    </>
  );
}
export function Audit() {
  const { state: s } = useApp();
  const [search, setSearch] = useState(""),
    [page, setPage] = useState(1);
  const rows = [...s.operations]
    .reverse()
    .filter((o) =>
      (o.description + " " + o.kind + " " + o.reason)
        .toLowerCase()
        .includes(search.toLowerCase()),
    );
  return (
    <>
      <PageTitle
        title="A history that stays intact."
        description="Every registration, collection and correction leaves a trace."
      />
      <section className="panel">
        <div className="toolbar">
          <h2>Activity log</h2>
          <SearchBox
            value={search}
            onChange={(v) => {
              setSearch(v);
              setPage(1);
            }}
            placeholder="Search activity…"
          />
        </div>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>POSTED</th>
                <th>EVENT</th>
                <th>DESCRIPTION / REASON</th>
                <th>ADMIN</th>
              </tr>
            </thead>
            <tbody>
              {rows.slice((page - 1) * 10, page * 10).map((o) => (
                <tr key={o.id}>
                  <td>
                    {displayDate(o.createdAt)}
                    <small>{o.createdAt.slice(11, 19)} UTC</small>
                  </td>
                  <td>
                    <Badge>{o.kind}</Badge>
                  </td>
                  <td>
                    <strong>{o.description}</strong>
                    <small>{o.reason || o.id}</small>
                  </td>
                  <td className="mono">{o.actor}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <Pagination page={page} setPage={setPage} total={rows.length} />
      </section>
    </>
  );
}
