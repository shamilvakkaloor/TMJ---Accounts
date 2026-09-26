import {
  ArrowDownLeft,
  ArrowRight,
  ArrowUpRight,
  Banknote,
  Building2,
  CalendarDays,
  Check,
  HandCoins,
  Plus,
  ReceiptText,
  Users,
  Wallet,
} from "lucide-react";
import { Link } from "react-router-dom";
import { useApp } from "../data/context";
import {
  balance,
  displayDate,
  money,
  outstanding,
  sum,
  today,
} from "../domain/utils";
import { assessmentPreview } from "../domain/engine";
import { Badge, Empty, PageTitle, Stat } from "../ui/components";
export function Dashboard() {
  const { state: s } = useApp();
  const date = today(s.settings[0].timezone);
  const year = date.slice(0, 4);
  const dues = s.dues.filter((d) => d.period.startsWith(year));
  const received = sum(
    s.ledger.filter((l) => l.kind === "collection" && l.date.startsWith(year)),
    (l) => l.amount,
  );
  const unpaid = sum(dues, outstanding);
  const funds = s.funds.filter((f) => f.mode === "fixed");
  const missing = funds.filter((f) => {
    try {
      return (
        assessmentPreview(
          s,
          f.id,
          f.frequency === "annual"
            ? year
            : f.frequency === "monthly"
              ? date.slice(0, 7)
              : f.campaign,
        ).length > 0
      );
    } catch {
      return false;
    }
  });
  const recent = [...s.receipts].reverse().slice(0, 6);
  const assessed = sum(dues, (d) => d.assessed - d.waived);
  const progress = assessed
    ? Math.round((sum(dues, (d) => d.paid) / assessed) * 100)
    : 0;
  return (
    <>
      <PageTitle
        title="A clear view of your community."
        description="Your collections, members and accounts — all in one place."
        action={
          <>
            <span className="date-chip">
              <CalendarDays size={16} />
              {year} calendar year
            </span>
            <Link className="button primary" to="/admin/receive">
              <Plus size={17} />
              Receive payment
            </Link>
          </>
        }
      />
      <div className="stats-grid">
        <Stat
          label="Collections received"
          value={money(received)}
          detail="Gross cash received this year"
          icon={<HandCoins size={20} />}
          tone="featured"
        />
        <Stat
          label="Outstanding dues"
          value={money(unpaid)}
          detail={`${dues.filter((d) => outstanding(d) > 0).length} assessments awaiting payment`}
          icon={<ReceiptText size={20} />}
        />
        <Stat
          label="Registered members"
          value={String(s.members.filter((m) => m.active).length).padStart(
            2,
            "0",
          )}
          detail={`${s.houses.length} houses across ${s.subMahals.length} Sub Mahals`}
          icon={<Users size={20} />}
        />
        <Stat
          label="Available balance"
          value={money(sum(s.ledger, (l) => l.amount))}
          detail={`${s.wallets.filter((w) => w.active).length} central cash & bank accounts`}
          icon={<Wallet size={20} />}
        />
      </div>
      {missing.length > 0 && (
        <div className="assessment-alert">
          <div className="notice-icon">
            <CalendarDays size={20} />
          </div>
          <div>
            <strong>There are dues ready to generate</strong>
            <p>
              {missing.map((f) => f.title).join(", ")} · Review eligible payers
              before generating.
            </p>
          </div>
          <Link to="/admin/funds">
            Review periods <ArrowRight size={16} />
          </Link>
        </div>
      )}
      <div className="dashboard-grid">
        <section className="panel collection-panel">
          <div className="panel-heading">
            <div>
              <h2>Collection progress</h2>
              <p>Payments against {year} assessed dues</p>
            </div>
            <Badge tone="green">{year}</Badge>
          </div>
          <div className="progress-overview">
            <div>
              <span className="muted">Dues collected</span>
              <strong>
                {money(sum(dues, (d) => d.paid))}
                <small> / {money(assessed)}</small>
              </strong>
              <span className="mini-good">
                <Check size={13} />
                {progress}% of assessed amount received
              </span>
            </div>
            <div
              className="ring"
              style={{
                background: `conic-gradient(var(--green) ${progress * 3.6}deg, #e9eee9 0deg)`,
              }}
            >
              <div>
                <strong>{progress}%</strong>
                <span>collected</span>
              </div>
            </div>
          </div>
          <div className="fund-progress-list">
            {funds.length ? (
              funds.map((f) => {
                const ds = dues.filter((d) => d.fundId === f.id);
                const total = sum(ds, (d) => d.assessed - d.waived),
                  paid = sum(ds, (d) => d.paid);
                return (
                  <div key={f.id} className="fund-progress">
                    <div>
                      <span>
                        <span
                          className={`color-dot ${f.target === "house" ? "gold" : ""}`}
                        />
                        {f.title}
                      </span>
                      <span>
                        {money(paid)} <small>/ {money(total)}</small>
                      </span>
                    </div>
                    <div className="bar">
                      <i
                        className={f.target === "house" ? "gold" : ""}
                        style={{
                          width: `${total ? (paid / total) * 100 : 0}%`,
                        }}
                      />
                    </div>
                  </div>
                );
              })
            ) : (
              <Empty
                title="Your funds start here"
                text="Create a fund to begin tracking dues."
                action={<Link to="/admin/funds">Set up funds →</Link>}
              />
            )}
          </div>
          <div className="panel-footer">
            <span>Voluntary donations are excluded from dues.</span>
            <Link to="/admin/reports">
              View reports <ArrowRight size={14} />
            </Link>
          </div>
        </section>
        <section className="balance-panel">
          <div className="panel-heading">
            <div>
              <h2>Your accounts</h2>
              <p>Central Mahal balances</p>
            </div>
            <Wallet size={20} />
          </div>
          {s.wallets.map((w) => (
            <div className="wallet-row" key={w.id}>
              <div className="wallet-icon">
                {w.type === "bank" ? (
                  <Building2 size={22} />
                ) : (
                  <Banknote size={22} />
                )}
              </div>
              <div>
                <span>{w.name}</span>
                <strong>{money(balance(s, w.id))}</strong>
              </div>
              <span className="wallet-status" />
            </div>
          ))}
          <div className="balance-flow">
            <div>
              <ArrowDownLeft size={16} />
              <span>Other income</span>
              <strong>
                {money(
                  sum(
                    s.ledger.filter(
                      (l) => l.kind === "income" && l.date.startsWith(year),
                    ),
                    (l) => l.amount,
                  ),
                )}
              </strong>
            </div>
            <div>
              <ArrowUpRight size={16} />
              <span>Expenditure</span>
              <strong>
                {money(
                  -sum(
                    s.ledger.filter(
                      (l) => l.kind === "expense" && l.date.startsWith(year),
                    ),
                    (l) => l.amount,
                  ),
                )}
              </strong>
            </div>
          </div>
          <Link className="button balance-link" to="/admin/accounts">
            Open cashbook <ArrowRight size={16} />
          </Link>
        </section>
      </div>
      <section className="panel">
        <div className="panel-heading">
          <div>
            <h2>Recent collections</h2>
            <p>A record of your community's contributions</p>
          </div>
          <Link className="text-link" to="/admin/receipts">
            View all receipts <ArrowRight size={15} />
          </Link>
        </div>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>RECEIPT / DATE</th>
                <th>RECEIVED FROM</th>
                <th>FUND</th>
                <th>PAYMENT</th>
                <th className="right">AMOUNT</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {recent.map((r) => (
                <tr key={r.id}>
                  <td>
                    <Link className="record-id" to={"/receipt/" + r.id}>
                      {r.number}
                    </Link>
                    <small>{displayDate(r.date)}</small>
                  </td>
                  <td>
                    <div className="person">
                      <div className="avatar">
                        {r.payerName
                          .split(" ")
                          .map((n) => n[0])
                          .slice(0, 2)
                          .join("")}
                      </div>
                      <div>
                        <strong>{r.payerName}</strong>
                        <small>
                          {r.subMahalName} · {r.payerId}
                        </small>
                      </div>
                    </div>
                  </td>
                  <td>
                    {[...new Set(r.lines.map((l) => l.fundTitle))].join(", ")}
                  </td>
                  <td>
                    <Badge tone={r.method === "Cash" ? "gold" : "blue"}>
                      {r.method}
                    </Badge>
                  </td>
                  <td className="right amount">{money(r.total)}</td>
                  <td>
                    <Link
                      className="row-arrow"
                      aria-label={"View " + r.number}
                      to={"/receipt/" + r.id}
                    >
                      <ArrowUpRight size={17} />
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {!recent.length && (
          <Empty
            title="Ready for your first collection"
            text="Record a payment and its receipt will appear here."
          />
        )}
      </section>
    </>
  );
}
