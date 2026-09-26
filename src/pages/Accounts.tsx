import { useEffect, useState } from "react";
import {
  ArrowDownLeft,
  ArrowRightLeft,
  ArrowUpRight,
  Banknote,
  Building2,
  Plus,
} from "lucide-react";
import { useApp } from "../data/context";
import { balance, displayDate, money, paise, today } from "../domain/utils";
import {
  AsyncForm,
  Badge,
  Dialog,
  Empty,
  Field,
  PageTitle,
  Pagination,
  str,
} from "../ui/components";
export function Accounts() {
  const { state: s, run, notify } = useApp();
  const [modal, setModal] = useState(""),
    [kind, setKind] = useState<"income" | "expense" | "transfer" | "opening">(
      "expense",
    ),
    [wallet, setWallet] = useState(""),
    [page, setPage] = useState(1);
  useEffect(() => setPage(1), [wallet]);
  const rows = [...s.ledger]
    .reverse()
    .filter((l) => !wallet || l.walletId === wallet);
  return (
    <>
      <PageTitle
        title="Keep your accounts in balance."
        description="A central cashbook for income, expenditure and wallet transfers."
        action={
          <>
            <button
              className="button secondary"
              onClick={() => {
                setKind("transfer");
                setModal("entry");
              }}
            >
              <ArrowRightLeft size={16} />
              Transfer
            </button>
            <button
              className="button primary"
              onClick={() => {
                setKind("expense");
                setModal("entry");
              }}
            >
              <Plus size={17} />
              Add entry
            </button>
          </>
        }
      />
      <div className="wallet-grid">
        {s.wallets.map((w) => (
          <div className="panel wallet-card" key={w.id}>
            <div className="wallet-card-head">
              {w.type === "cash" ? <Banknote /> : <Building2 />}
              <Badge tone={w.active ? "green" : "neutral"}>{w.type}</Badge>
            </div>
            <span>{w.name}</span>
            <strong>{money(balance(s, w.id))}</strong>
            <small>Current reconciled ledger balance</small>
          </div>
        ))}
        <button className="add-wallet" onClick={() => setModal("wallet")}>
          <Plus size={26} />
          Add wallet
        </button>
      </div>
      <section className="panel">
        <div className="toolbar">
          <h2>Cashbook entries</h2>
          <select
            aria-label="Filter wallet"
            value={wallet}
            onChange={(e) => setWallet(e.target.value)}
          >
            <option value="">All wallets</option>
            {s.wallets.map((w) => (
              <option key={w.id} value={w.id}>
                {w.name}
              </option>
            ))}
          </select>
        </div>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>DATE</th>
                <th>DESCRIPTION</th>
                <th>ACCOUNT</th>
                <th>TYPE</th>
                <th className="right">MONEY IN</th>
                <th className="right">MONEY OUT</th>
              </tr>
            </thead>
            <tbody>
              {rows.slice((page - 1) * 10, page * 10).map((l) => (
                <tr key={l.id}>
                  <td>{displayDate(l.date)}</td>
                  <td>
                    <strong>{l.description}</strong>
                    <small>{l.party || l.category}</small>
                  </td>
                  <td>{s.wallets.find((w) => w.id === l.walletId)?.name}</td>
                  <td>
                    <Badge
                      tone={
                        l.kind === "transfer"
                          ? "blue"
                          : l.amount > 0
                            ? "green"
                            : "gold"
                      }
                    >
                      {l.kind}
                    </Badge>
                  </td>
                  <td className="right amount positive">
                    {l.amount > 0 ? money(l.amount) : "—"}
                  </td>
                  <td className="right amount">
                    {l.amount < 0 ? money(-l.amount) : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {!rows.length && (
          <Empty
            title="Your cashbook is ready"
            text="Start with reconciled opening balances, then record income and expenditure."
          />
        )}
        <Pagination page={page} setPage={setPage} total={rows.length} />
      </section>
      {modal === "entry" && (
        <Dialog
          title="Record a cashbook entry"
          onClose={() => setModal("")}
          wide
        >
          <AsyncForm
            onCancel={() => setModal("")}
            onSubmit={async (f) => {
              await run({
                type: "cashbook",
                kind,
                walletId: str(f, "walletId"),
                toWalletId: str(f, "toWalletId"),
                amount: paise(str(f, "amount")),
                date: str(f, "date"),
                category: str(f, "category"),
                party: str(f, "party"),
                description: str(f, "description"),
                reference: str(f, "reference"),
              });
              notify("Cashbook entry recorded");
              setModal("");
            }}
          >
            <div className="segmented">
              <button
                type="button"
                className={kind === "expense" ? "active" : ""}
                onClick={() => setKind("expense")}
              >
                <ArrowUpRight size={15} />
                Expense
              </button>
              <button
                type="button"
                className={kind === "income" ? "active" : ""}
                onClick={() => setKind("income")}
              >
                <ArrowDownLeft size={15} />
                Income
              </button>
              <button
                type="button"
                className={kind === "transfer" ? "active" : ""}
                onClick={() => setKind("transfer")}
              >
                Transfer
              </button>
              <button
                type="button"
                className={kind === "opening" ? "active" : ""}
                onClick={() => setKind("opening")}
              >
                Opening
              </button>
            </div>
            <div className="form-grid">
              <Field label="Amount (₹)">
                <input
                  name="amount"
                  type="number"
                  min="0.01"
                  step="0.01"
                  required
                />
              </Field>
              <Field label="Date">
                <input
                  name="date"
                  type="date"
                  required
                  defaultValue={today()}
                  max={today()}
                />
              </Field>
              <Field label={kind === "transfer" ? "From wallet" : "Wallet"}>
                <select name="walletId">
                  {s.wallets
                    .filter((w) => w.active)
                    .map((w) => (
                      <option key={w.id} value={w.id}>
                        {w.name}
                      </option>
                    ))}
                </select>
              </Field>
              {kind === "transfer" ? (
                <Field label="To wallet">
                  <select name="toWalletId">
                    {s.wallets
                      .filter((w) => w.active)
                      .map((w) => (
                        <option key={w.id} value={w.id}>
                          {w.name}
                        </option>
                      ))}
                  </select>
                </Field>
              ) : (
                <Field label="Category">
                  <input name="category" list="categories" required />
                  <datalist id="categories">
                    {[
                      "Salary",
                      "Electricity",
                      "Maintenance",
                      "Rent",
                      "Donation",
                      "Opening balance",
                      "Other",
                    ].map((x) => (
                      <option key={x}>{x}</option>
                    ))}
                  </datalist>
                </Field>
              )}
              <Field label="Paid to / received from">
                <input name="party" />
              </Field>
              <Field label="Reference">
                <input name="reference" />
              </Field>
            </div>
            <Field label="Explanation">
              <textarea name="description" required />
            </Field>
            <div className="hint-box">
              Member and house collections are posted automatically from
              receipts. Wallet transfers do not count as income or expenditure.
            </div>
          </AsyncForm>
        </Dialog>
      )}
      {modal === "wallet" && (
        <Dialog title="Add a central wallet" onClose={() => setModal("")}>
          <AsyncForm
            onCancel={() => setModal("")}
            onSubmit={async (f) => {
              await run({
                type: "saveWallet",
                value: {
                  id: "wallet-" + crypto.randomUUID().slice(0, 8),
                  name: str(f, "name"),
                  type: str(f, "type") as "cash" | "bank",
                  active: true,
                },
              });
              notify("Wallet created");
              setModal("");
            }}
          >
            <Field label="Wallet name">
              <input name="name" required />
            </Field>
            <Field label="Type">
              <select name="type">
                <option value="bank">Bank account</option>
                <option value="cash">Cash wallet</option>
              </select>
            </Field>
          </AsyncForm>
        </Dialog>
      )}
    </>
  );
}
