import { collections } from "./types.js";
import { assert, outstanding, sum } from "./utils.js";
export function validateBackup(raw) {
  assert(raw && typeof raw === "object", "Invalid backup.");
  const file = raw;
  assert(file.format === "mahal-backup-v1" && file.data, "Not a Mahal backup.");
  const s = file.data;
  assert(
    Object.keys(s).length === collections.length &&
      Object.keys(s).every((c) => collections.includes(c)),
    "Unexpected or missing backup collections.",
  );
  for (const col of collections) {
    assert(Array.isArray(s[col]), `Missing ${col}.`);
    const ids = s[col].map((r) => r.id);
    assert(
      ids.every((id) => typeof id === "string" && /^[\w-]+$/.test(id)),
      `Invalid IDs in ${col}.`,
    );
    assert(new Set(ids).size === ids.length, `Duplicate IDs in ${col}.`);
  }
  assert(
    s.settings.length === 1 && s.settings[0].schemaVersion === 1,
    "Unsupported schema version.",
  );
  assert(s.subMahals.length >= 1 && s.subMahals.length <= 25, "Expected 1 to 25 Sub Mahals.");
  for (const h of s.houses)
    assert(
      s.subMahals.some((m) => m.id === h.subMahalId),
      `Broken Sub Mahal link on ${h.id}.`,
    );
  for (const m of s.members)
    assert(
      s.houses.some((h) => h.id === m.houseId),
      `Broken house link on ${m.id}.`,
    );
  for (const d of s.dues) {
    assert(
      s.funds.some((f) => f.id === d.fundId),
      "Missing fund.",
    );
    assert(
      [...s.members, ...s.houses].some((p) => p.id === d.payerId),
      "Missing payer.",
    );
    assert(
      [d.assessed, d.paid, d.waived].every(
        (n) => Number.isSafeInteger(n) && n >= 0,
      ) && outstanding(d) >= 0,
      `Invalid due balance: ${d.id}.`,
    );
  }
  for (const c of s.credits)
    assert(
      Number.isSafeInteger(c.amount) &&
        c.amount >= 0 &&
        s.receipts.some((r) => r.id === c.receiptId),
      "Invalid credit.",
    );
  assert(
    new Set(s.receipts.map((r) => r.number)).size === s.receipts.length,
    "Duplicate receipt numbers.",
  );
  for (const r of s.receipts) {
    const rs = s.receiptStates.find((v) => v.id === r.id);
    assert(
      rs && rs.refunded >= 0 && Number.isSafeInteger(rs.refunded),
      "Receipt state missing.",
    );
    assert(
      r.lines.length > 0 &&
        r.lines.every((l) => Number.isSafeInteger(l.amount) && l.amount > 0) &&
        sum(r.lines, (l) => l.amount) === r.total,
      "Receipt total mismatch.",
    );
    assert(
      sum(rs.allocations, (l) => l.amount) + rs.refunded === r.total,
      "Receipt settlement mismatch.",
    );
    assert(
      rs.allocations.every(
        (l) => Number.isSafeInteger(l.amount) && l.amount > 0,
      ),
      "Invalid receipt allocation.",
    );
    const map = Object.fromEntries(
      rs.allocations.map((l) => [
        l.dueId || l.creditId || `voluntary_${l.fundId}`,
        l,
      ]),
    );
    assert(
      rs.allocationMap &&
        Object.keys(map).length === Object.keys(rs.allocationMap).length &&
        Object.entries(map).every(
          ([key, line]) =>
            rs.allocationMap[key] &&
            Object.entries(line).every(
              ([field, value]) => rs.allocationMap[key][field] === value,
            ),
        ),
      "Receipt allocation index mismatch.",
    );
    const match = /^R-(\d{4})-(\d{6})$/.exec(r.number);
    assert(
      match &&
        Number(match[2]) <=
          (s.sequences.find((q) => q.id === `receipt-${match[1]}`)?.value || 0),
      "Receipt sequence would reuse an existing number.",
    );
    if (!r.historical)
      assert(
        sum(
          s.ledger.filter((l) => l.receiptId === r.id),
          (l) => l.amount,
        ) ===
          r.total - rs.refunded,
        `Cash does not reconcile for ${r.number}.`,
      );
  }
  for (const l of s.ledger)
    assert(
      Number.isSafeInteger(l.amount) &&
        s.wallets.some((w) => w.id === l.walletId) &&
        s.operations.some((o) => o.id === l.operationId),
      "Invalid ledger relationship.",
    );
  for (const w of s.wallets)
    assert(
      Number.isSafeInteger(w.balance) &&
        w.balance >= 0 &&
        w.balance ===
          sum(
            s.ledger.filter((l) => l.walletId === w.id),
            (l) => l.amount,
          ),
      `Wallet ${w.id} does not reconcile.`,
    );
  for (const [key, prefix, records] of [
    ["house", "H-", s.houses],
    ["member", "M-", s.members],
  ]) {
    const max = Math.max(
      0,
      ...records
        .filter((r) => new RegExp(`^${prefix}\\d{6}$`).test(r.id))
        .map((r) => Number(r.id.slice(prefix.length))),
    );
    assert(
      max <= (s.sequences.find((q) => q.id === key)?.value || 0),
      `Sequence ${key} would reuse an existing ID.`,
    );
  }
  return s;
}
