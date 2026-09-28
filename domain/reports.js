import { sum, outstanding } from "./utils.js";
export function reportData(s, { from, to, sub = "", fund = "" }) {
  const ledger = s.ledger.filter((l) => l.date >= from && l.date <= to);
  const operations = s.operations.filter(
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
  const collections = operations.flatMap((o) =>
    o.fundAmounts
      .filter((l) => !fund || l.fundId === fund)
      .map((l) => {
        const r = s.receipts.find((r) => r.id === o.receiptId);
        return {
          date: o.date,
          receipt: r.number,
          payer: r.payerName,
          subMahal: r.subMahalName,
          subMahalId: r.subMahalId,
          fund: s.funds.find((f) => f.id === l.fundId)?.title || l.fundId,
          type: o.kind,
          amount: l.amount,
        };
      }),
  );
  const dues = s.dues.filter(
    (d) =>
      (!fund || d.fundId === fund) &&
      d.dueDate >= from &&
      d.dueDate <= to &&
      outstanding(d) > 0 &&
      (!sub ||
        (() => {
          const h =
            d.payerType === "house"
              ? s.houses.find((h) => h.id === d.payerId)
              : s.houses.find(
                  (h) =>
                    h.id === s.members.find((m) => m.id === d.payerId)?.houseId,
                );
          return h?.subMahalId === sub;
        })()),
  );
  const wallets = s.wallets.map((w) => ({
    name: w.name,
    opening: sum(
      s.ledger.filter((l) => l.walletId === w.id && l.date < from),
      (l) => l.amount,
    ),
    movement: sum(
      ledger.filter((l) => l.walletId === w.id),
      (l) => l.amount,
    ),
    closing: sum(
      s.ledger.filter((l) => l.walletId === w.id && l.date <= to),
      (l) => l.amount,
    ),
  }));
  return {
    ledger,
    collections,
    dues,
    wallets,
    net: sum(collections, (r) => r.amount),
    income: sum(
      ledger.filter((l) => l.kind === "income"),
      (l) => l.amount,
    ),
    expense: -sum(
      ledger.filter((l) => l.kind === "expense"),
      (l) => l.amount,
    ),
  };
}
