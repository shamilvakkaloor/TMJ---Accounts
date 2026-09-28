import {
  ageAt,
  assert,
  atDate,
  balance,
  outstanding,
  sum,
  validDate,
} from "./utils.js";
export const MAX_ALLOCATIONS = 4;
const get = (a, id) => {
  const v = a.find((x) => x.id === id);
  assert(v, `Record ${id} was not found.`);
  return v;
};
const positive = (n) =>
  assert(
    Number.isSafeInteger(n) && n > 0 && n <= 100_000_000_000,
    "Amount must be positive integer paise.",
  );
const put = (a, v) => {
  const i = a.findIndex((x) => x.id === v.id);
  if (i < 0) a.push(v);
  else a[i] = v;
};
export function periodStart(f, p) {
  if (f.frequency === "annual") {
    assert(/^\d{4}$/.test(p), "Choose a calendar year.");
    return p + "-01-01";
  }
  if (f.frequency === "monthly") {
    assert(/^\d{4}-(0[1-9]|1[0-2])$/.test(p), "Choose a month (YYYY-MM).");
    return p + "-01";
  }
  assert(p === f.campaign && !!p, "Choose the configured campaign.");
  return f.start;
}
export function rateFor(f, date) {
  return [...f.rates]
    .sort((a, b) => b.from.localeCompare(a.from))
    .find((r) => r.from <= date);
}
export function eligible(p, f, period) {
  const start = periodStart(f, period);
  const end = f.frequency === "annual" ? period + "-12-31" : start;
  return (
    p.joined <= end &&
    (!p.inactiveDate || p.inactiveDate > start) &&
    (!("approved" in p) || p.approved) &&
    f.start <= end &&
    (!f.end || f.end >= start) &&
    (f.frequency !== "one_time" || f.eligibleIds.includes(p.id))
  );
}
export function assessmentPreview(s, fundId, period) {
  const f = get(s.funds, fundId);
  periodStart(f, period);
  if (f.mode === "voluntary" || !f.active) return [];
  const payers = f.target === "member" ? s.members : s.houses;
  return payers.filter(
    (p) =>
      eligible(p, f, period) &&
      !s.dues.some((d) => d.id === `${p.id}_${f.id}_${period}`),
  );
}
export function payerSnapshot(s, id, date) {
  const member = s.members.find((m) => m.id === id);
  const houseId = member ? atDate(member.houseHistory, date) : id;
  assert(houseId, "No house history exists for this payment date.");
  const house = get(s.houses, houseId);
  const subId = atDate(house.subHistory, date);
  assert(subId, "No Sub Mahal history exists for this payment date.");
  return {
    payerId: id,
    payerType: member ? "member" : "house",
    payerName: member?.name ?? house.name,
    houseId: house.id,
    houseName: house.name,
    subMahalId: subId,
    subMahalName: get(s.subMahals, subId).name,
  };
}
function changeHistory(history, date, value) {
  const h = history.filter((x) => x.date !== date);
  h.push({ date, value });
  return h.sort((a, b) => a.date.localeCompare(b.date));
}
export function execute(current, cmd, ctx) {
  if (current.operations.some((o) => o.id === ctx.operationId)) return current;
  const s = structuredClone(current);
  const day = new Intl.DateTimeFormat("en-CA", {
    timeZone: s.settings[0].timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(ctx.now));
  const adj = [];
  const op = {
    id: ctx.operationId,
    kind: cmd.type,
    date: "date" in cmd ? cmd.date : day,
    createdAt: ctx.now,
    actor: ctx.actor,
    description: "",
    reason: "reason" in cmd ? cmd.reason : "",
    receiptId: "",
    amount: 0,
    adjustments: adj,
    balanceChanges: {},
    ledgerIds: [],
    fundAmounts: [],
  };
  assert(validDate(op.date), "Invalid operation date.");
  assert(op.date <= day, "Future-dated payments are not supported.");
  const next = (key, prefix) => {
    let q = s.sequences.find((x) => x.id === key);
    if (!q) {
      q = { id: key, value: 0 };
      s.sequences.push(q);
    }
    q.value++;
    return `${prefix}${String(q.value).padStart(6, "0")}`;
  };
  const adjust = (type, id, field, delta) => {
    assert(
      Number.isSafeInteger(delta) && delta !== 0,
      "Adjustment cannot be zero.",
    );
    const row = type === "due" ? get(s.dues, id) : get(s.credits, id);
    const before = row[field];
    row[field] = before + delta;
    row.lastOperation = op.id;
    adj.push({ id, type, field, before, after: before + delta, delta });
  };
  const entry = (
    walletId,
    amount,
    kind,
    category,
    party,
    description,
    receiptId = "",
    reference = "",
  ) => {
    const wallet = get(s.wallets, walletId);
    assert(wallet.active, "Wallet is inactive.");
    wallet.balance += amount;
    wallet.lastOperation = op.id;
    assert(
      Number.isSafeInteger(wallet.balance) && wallet.balance >= 0,
      "Wallet balance cannot be negative.",
    );
    assert(
      Number.isSafeInteger(amount) && amount !== 0,
      "Invalid ledger amount.",
    );
    const id = `${op.id}_${op.ledgerIds.length}`;
    s.ledger.push({
      id,
      date: op.date,
      walletId,
      amount,
      kind,
      category,
      party,
      description,
      reference,
      receiptId,
      operationId: op.id,
    });
    op.ledgerIds.push(id);
  };
  const reason = () =>
    assert(
      op.reason.trim().length >= 3,
      "Please give a reason (at least 3 characters).",
    );
  switch (cmd.type) {
    case "saveHouse": {
      const v = cmd.value;
      assert(
        v.name.trim() && v.number.trim(),
        "House name and number are required.",
      );
      get(s.subMahals, v.subMahalId);
      assert(validDate(v.joined), "Registration date is required.");
      const old = v.id ? s.houses.find((h) => h.id === v.id) : undefined;
      const date = v.effectiveDate || day;
      assert(validDate(date) && date >= v.joined, "Invalid effective date.");
      const id = old?.id || v.id || next("house", "H-");
      assert(/^H-\d{6}$/.test(id), "House ID must be H-000001 format.");
      const { effectiveDate: _, ...fields } = v;
      if (v.id && !old) {
        const n = Number(id.slice(2));
        let seq = s.sequences.find((q) => q.id === "house");
        if (!seq) s.sequences.push({ id: "house", value: n });
        else seq.value = Math.max(n, seq.value);
      }
      let history = old?.subHistory ?? [
        { date: v.joined, value: v.subMahalId },
      ];
      if (old && old.subMahalId !== v.subMahalId)
        history = changeHistory(history, date, v.subMahalId);
      assert(
        !v.inactiveDate ||
          (validDate(v.inactiveDate) && v.inactiveDate >= v.joined),
        "Invalid inactive date.",
      );
      assert(
        v.active || !!v.inactiveDate,
        "Inactive records require an effective end date.",
      );
      put(s.houses, {
        ...fields,
        id,
        subHistory: history,
        subMahalId: atDate(history, day) ?? v.subMahalId,
      });
      op.description = `${old ? "Updated" : "Registered"} house ${id}`;
      break;
    }
    case "saveMember": {
      const v = cmd.value;
      assert(v.name.trim(), "Member name is required.");
      get(s.houses, v.houseId);
      assert(validDate(v.joined), "Joining date is required.");
      if (v.approved) {
        assert(
          v.dob
            ? validDate(v.dob) && ageAt(v.dob, v.joined) >= 21
            : Number.isInteger(v.verifiedAge) &&
                v.verifiedAge >= 21 &&
                validDate(v.ageVerifiedOn) &&
                v.ageVerifiedOn <= v.joined,
          "An approved member must be verified as at least 21 at joining.",
        );
      }
      const old = v.id ? s.members.find((m) => m.id === v.id) : undefined;
      const id = old?.id || v.id || next("member", "M-");
      assert(/^M-\d{6}$/.test(id), "Member ID must be M-000001 format.");
      const date = v.effectiveDate || day;
      assert(validDate(date) && date >= v.joined, "Invalid move date.");
      const { effectiveDate: _, ...fields } = v;
      if (v.id && !old) {
        const n = Number(id.slice(2));
        let seq = s.sequences.find((q) => q.id === "member");
        if (!seq) s.sequences.push({ id: "member", value: n });
        else seq.value = Math.max(n, seq.value);
      }
      let history = old?.houseHistory ?? [{ date: v.joined, value: v.houseId }];
      if (old && old.houseId !== v.houseId)
        history = changeHistory(history, date, v.houseId);
      assert(
        !v.inactiveDate ||
          (validDate(v.inactiveDate) && v.inactiveDate >= v.joined),
        "Invalid inactive date.",
      );
      assert(
        v.active || !!v.inactiveDate,
        "Inactive records require an effective end date.",
      );
      put(s.members, {
        ...fields,
        id,
        houseHistory: history,
        houseId: atDate(history, day) ?? v.houseId,
      });
      op.description = `${old ? "Updated" : "Registered"} member ${id}`;
      break;
    }
    case "saveFund": {
      const f = cmd.value;
      assert(
        f.id && /^[\w-]+$/.test(f.id) && f.title.trim(),
        "A fund needs a title and a valid ID.",
      );
      assert(validDate(f.start), "Invalid fund start date.");
      assert(
        f.dueDay >= 1 && f.dueDay <= 28,
        "Due day must be between 1 and 28.",
      );
      assert(
        ["member", "house"].includes(f.target) &&
          ["annual", "monthly", "one_time"].includes(f.frequency) &&
          ["fixed", "voluntary"].includes(f.mode),
        "Invalid fund configuration.",
      );
      assert(
        new Set(f.rates.map((r) => r.from)).size === f.rates.length,
        "Rate dates must be unique.",
      );
      f.rates.forEach((r) => {
        assert(validDate(r.from), "Invalid rate date.");
        positive(r.amount);
      });
      assert(f.mode === "voluntary" || f.rates.length > 0, "Add a fixed rate.");
      assert(
        !f.advance ||
          (f.target === "member" &&
            f.frequency === "annual" &&
            f.mode === "fixed"),
        "Advance allocation is for annual member funds.",
      );
      assert(
        f.frequency !== "one_time" ||
          (/^[\w-]+$/.test(f.campaign) && f.eligibleIds.length > 0),
        "One-time funds need a campaign ID and eligible payers.",
      );
      const old = s.funds.find((x) => x.id === f.id);
      if (
        old &&
        (s.dues.some((d) => d.fundId === f.id) ||
          s.receipts.some((r) => r.lines.some((l) => l.fundId === f.id)))
      ) {
        assert(
          old.target === f.target &&
            old.frequency === f.frequency &&
            old.mode === f.mode,
          "Create a new fund to change its target, frequency or mode.",
        );
        for (const r of old.rates)
          assert(
            f.rates.some((n) => n.from === r.from && n.amount === r.amount),
            "Existing rates are immutable; add a future rate.",
          );
        for (const r of f.rates.filter(
          (n) => !old.rates.some((o) => o.from === n.from),
        ))
          assert(
            r.from > day,
            "New rates on an existing fund must start in the future.",
          );
      }
      put(s.funds, f);
      op.description = `Updated fund ${f.title}`;
      break;
    }
    case "saveSettings": {
      assert(cmd.value.name.trim(), "Mahal name is required.");
      try {
        new Intl.DateTimeFormat("en", { timeZone: cmd.value.timezone });
      } catch {
        throw new Error("Invalid timezone.");
      }
      assert(validDate(cmd.value.cutover), "A valid cutover date is required.");
      put(s.settings, cmd.value);
      op.description = "Updated Mahal settings";
      break;
    }
    case "saveSubMahal":
      assert(cmd.value.name.trim(), "Sub Mahal name is required.");
      assert(
        s.subMahals.some((x) => x.id === cmd.value.id) ||
          s.subMahals.length < 25,
        "V1 supports 25 Sub Mahals.",
      );
      put(s.subMahals, cmd.value);
      op.description = `Updated Sub Mahal ${cmd.value.name}`;
      break;
    case "saveWallet":
      assert(cmd.value.name.trim(), "Wallet name is required.");
      put(s.wallets, {
        ...cmd.value,
        balance: s.wallets.find((w) => w.id === cmd.value.id)?.balance || 0,
        lastOperation: op.id,
      });
      op.description = `Updated wallet ${cmd.value.name}`;
      break;
    case "saveImportJob":
      put(s.importJobs, cmd.value);
      op.description = `Import ${cmd.value.status}: ${cmd.value.fileName}`;
      break;
    case "assess": {
      const f = get(s.funds, cmd.fundId);
      assert(f.mode === "fixed", "Voluntary funds have no dues.");
      const p =
        f.target === "member"
          ? get(s.members, cmd.payerId)
          : get(s.houses, cmd.payerId);
      assert(
        eligible(p, f, cmd.period),
        "Payer is not eligible in this period.",
      );
      const start = periodStart(f, cmd.period);
      const id = `${p.id}_${f.id}_${cmd.period}`;
      if (s.dues.some((d) => d.id === id)) return current;
      const rate = rateFor(f, start < f.start ? f.start : start);
      assert(rate, "No rate is configured for this period.");
      const amount = cmd.assessed ?? rate.amount;
      positive(amount);
      const dueDate =
        start.slice(0, 7) + "-" + String(f.dueDay).padStart(2, "0");
      s.dues.push({
        id,
        payerId: p.id,
        payerType: f.target,
        fundId: f.id,
        fundTitle: f.title,
        period: cmd.period,
        assessed: amount,
        waived: 0,
        paid: 0,
        dueDate,
        rateFrom: rate.from,
        lastOperation: op.id,
      });
      op.amount = amount;
      op.description = `Assessed ${f.title} · ${p.id} · ${cmd.period}`;
      break;
    }
    case "payment": {
      assert(cmd.lines.length > 0, "Add a payment line.");
      assert(
        new Set(cmd.lines.map((l) => l.fundId + "_" + (l.dueId || ""))).size ===
          cmd.lines.length,
        "Duplicate payment selections.",
      );
      assert(
        cmd.date >= s.settings[0].cutover || cmd.historical,
        "Payments before cutover must be imported as statement-only history.",
      );
      assert(
        !cmd.historical || cmd.date < s.settings[0].cutover,
        "Statement-only receipts must predate cutover.",
      );
      const snap = payerSnapshot(s, cmd.payerId, cmd.date);
      const lines = [];
      const id = op.id;
      const add = (f, amount, period, dueId = "", creditId = "") =>
        lines.push({
          fundId: f.id,
          fundTitle: f.title,
          amount,
          period,
          dueId,
          creditId,
        });
      for (const input of cmd.lines) {
        positive(input.amount);
        const f = get(s.funds, input.fundId);
        assert(
          f.target === snap.payerType,
          "A receipt can contain funds for only this payer type.",
        );
        assert(f.active, "This fund is inactive.");
        let remaining = input.amount;
        if (cmd.historical) {
          add(
            f,
            remaining,
            cmd.date.slice(0, f.frequency === "monthly" ? 7 : 4),
          );
          continue;
        }
        if (f.mode === "voluntary") {
          add(f, remaining, cmd.date.slice(0, 4));
          continue;
        }
        const dues = s.dues
          .filter(
            (d) =>
              d.payerId === cmd.payerId &&
              d.fundId === f.id &&
              outstanding(d) > 0 &&
              (!input.dueId || d.id === input.dueId),
          )
          .sort((a, b) => a.period.localeCompare(b.period));
        for (const d of dues) {
          if (!remaining) break;
          const n = Math.min(remaining, outstanding(d));
          adjust("due", d.id, "paid", n);
          add(f, n, d.period, d.id);
          remaining -= n;
        }
        if (remaining) {
          assert(
            f.advance,
            "This amount exceeds assessed dues. Return the change or assess the intended period first.",
          );
          const cid = `${id}_${lines.length}`;
          s.credits.push({
            id: cid,
            payerId: cmd.payerId,
            fundId: f.id,
            receiptId: id,
            amount: 0,
            period: String(Number(cmd.date.slice(0, 4)) + 1),
            lastOperation: op.id,
          });
          adjust("credit", cid, "amount", remaining);
          add(f, remaining, String(Number(cmd.date.slice(0, 4)) + 1), "", cid);
        }
      }
      assert(
        lines.length <= MAX_ALLOCATIONS,
        `One receipt supports ${MAX_ALLOCATIONS} period allocations. Select fewer periods in this payment.`,
      );
      const total = sum(lines, (l) => l.amount);
      const year = day.slice(0, 4);
      const number = next("receipt-" + year, `R-${year}-`);
      const receipt = {
        id,
        number,
        ...snap,
        date: cmd.date,
        postedAt: ctx.now,
        walletId: cmd.walletId,
        method: cmd.method,
        reference: cmd.reference,
        lines,
        total,
        outstandingAfter: cmd.historical
          ? null
          : sum(
              s.dues.filter((d) => d.payerId === cmd.payerId),
              outstanding,
            ),
        advanceAfter: cmd.historical
          ? null
          : sum(
              s.credits.filter((c) => c.payerId === cmd.payerId),
              (c) => c.amount,
            ),
        historical: !!cmd.historical,
        legacyNumber: cmd.legacyNumber || "",
        operationId: op.id,
      };
      s.receipts.push(receipt);
      s.receiptStates.push({
        id,
        refunded: 0,
        voided: false,
        allocations: structuredClone(lines),
        allocationMap: {},
        lastOperation: op.id,
      });
      op.receiptId = id;
      op.amount = total;
      op.description = `${number} · ${snap.payerName}`;
      op.fundAmounts = lines.map((l) => ({
        fundId: l.fundId,
        amount: l.amount,
      }));
      if (!cmd.historical)
        entry(
          cmd.walletId,
          total,
          "collection",
          "Fund collections",
          snap.payerName,
          number,
          id,
          cmd.reference,
        );
      break;
    }
    case "waive":
    case "restoreWaiver": {
      reason();
      positive(cmd.amount);
      const d = get(s.dues, cmd.dueId);
      assert(
        cmd.type === "waive"
          ? cmd.amount <= outstanding(d)
          : cmd.amount <= d.waived,
        "Amount exceeds the available balance.",
      );
      adjust(
        "due",
        d.id,
        "waived",
        cmd.type === "waive" ? cmd.amount : -cmd.amount,
      );
      op.amount = cmd.amount;
      op.description = `${cmd.type === "waive" ? "Waived" : "Restored waiver"} · ${d.payerId} · ${d.fundTitle}`;
      break;
    }
    case "applyCredit": {
      positive(cmd.amount);
      const c = get(s.credits, cmd.creditId),
        d = get(s.dues, cmd.dueId);
      assert(
        c.payerId === d.payerId && c.fundId === d.fundId,
        "Credit must stay with the same payer and fund.",
      );
      assert(d.period >= c.period, "Advance belongs to a later period.");
      assert(
        cmd.amount <= c.amount && cmd.amount <= outstanding(d),
        "Amount exceeds available credit or outstanding due.",
      );
      adjust("credit", c.id, "amount", -cmd.amount);
      adjust("due", d.id, "paid", cmd.amount);
      const rs = get(s.receiptStates, c.receiptId);
      const original = rs.allocations.find((l) => l.creditId === c.id);
      assert(
        original && original.amount >= cmd.amount,
        "Credit allocation could not be reconciled.",
      );
      original.amount -= cmd.amount;
      const existing = rs.allocations.find((l) => l.dueId === d.id);
      if (existing) existing.amount += cmd.amount;
      else
        rs.allocations.push({
          fundId: d.fundId,
          fundTitle: d.fundTitle,
          dueId: d.id,
          creditId: "",
          period: d.period,
          amount: cmd.amount,
        });
      rs.allocations = rs.allocations.filter((l) => l.amount > 0);
      assert(
        rs.allocations.length <= MAX_ALLOCATIONS,
        "This receipt has reached its allocation limit. Apply the remaining credit to an existing allocation or refund it.",
      );
      rs.lastOperation = op.id;
      op.receiptId = c.receiptId;
      op.amount = cmd.amount;
      op.description = `Applied advance · ${d.payerId} · ${d.period}`;
      break;
    }
    case "refund":
    case "void": {
      reason();
      const r = get(s.receipts, cmd.receiptId),
        rs = get(s.receiptStates, r.id);
      assert(cmd.date >= r.date, "A correction cannot predate its receipt.");
      assert(
        !r.historical,
        "Statement-only history has no live cash to reverse. Use an explicit opening-credit migration.",
      );
      assert(!rs.voided, "This receipt is already void.");
      let remaining = cmd.type === "void" ? r.total - rs.refunded : cmd.amount;
      positive(remaining);
      assert(
        remaining <= r.total - rs.refunded,
        "Amount exceeds the remaining refundable receipt total.",
      );
      const amount = remaining;
      const walletId = cmd.type === "void" ? r.walletId : cmd.walletId;
      assert(
        balance(s, walletId) >= amount,
        "This wallet has insufficient funds.",
      );
      // Unused credit is returned first. Paid allocations reopen their dues.
      const ordered = [...rs.allocations].sort(
        (a, b) => Number(!!b.creditId) - Number(!!a.creditId),
      );
      for (const l of ordered) {
        if (!remaining) break;
        const n = Math.min(l.amount, remaining);
        if (l.creditId) adjust("credit", l.creditId, "amount", -n);
        else if (l.dueId) adjust("due", l.dueId, "paid", -n);
        op.fundAmounts.push({ fundId: l.fundId, amount: -n });
        l.amount -= n;
        remaining -= n;
      }
      assert(remaining === 0, "Receipt allocations do not reconcile.");
      rs.allocations = rs.allocations.filter((l) => l.amount > 0);
      rs.refunded += amount;
      rs.voided = cmd.type === "void";
      rs.lastOperation = op.id;
      op.receiptId = r.id;
      op.amount = amount;
      op.description = `${cmd.type === "void" ? "Voided" : "Refunded"} ${r.number}`;
      entry(
        walletId,
        -amount,
        cmd.type === "void" ? "reversal" : "refund",
        "Fund collections",
        r.payerName,
        op.reason,
        r.id,
      );
      break;
    }
    case "cashbook": {
      positive(cmd.amount);
      assert(
        cmd.date >= s.settings[0].cutover,
        "Cashbook entries must be on or after cutover.",
      );
      assert(cmd.description.trim(), "An explanation is required.");
      if (cmd.kind === "expense" || cmd.kind === "transfer")
        assert(
          balance(s, cmd.walletId) >= cmd.amount,
          "Insufficient wallet balance.",
        );
      if (cmd.kind === "opening")
        assert(
          !s.ledger.some(
            (l) => l.walletId === cmd.walletId && l.kind === "opening",
          ),
          "This wallet already has an opening balance.",
        );
      if (cmd.kind === "transfer")
        assert(
          cmd.toWalletId && cmd.toWalletId !== cmd.walletId,
          "Choose a different destination wallet.",
        );
      op.amount = cmd.amount;
      op.description = cmd.description;
      entry(
        cmd.walletId,
        (cmd.kind === "expense" || cmd.kind === "transfer" ? -1 : 1) *
          cmd.amount,
        cmd.kind,
        cmd.category,
        cmd.party,
        cmd.description,
        "",
        cmd.reference,
      );
      if (cmd.kind === "transfer")
        entry(
          cmd.toWalletId,
          cmd.amount,
          "transfer",
          "Wallet transfer",
          cmd.party,
          cmd.description,
        );
      break;
    }
  }
  assert(
    adj.length <= MAX_ALLOCATIONS,
    `This operation touches more than ${MAX_ALLOCATIONS} balances. Use smaller payments.`,
  );
  assert(
    new Set(adj.map((a) => a.type + "/" + a.id + "/" + a.field)).size ===
      adj.length,
    "Payment lines overlap. Select each period only once.",
  );
  for (const d of s.dues)
    assert(
      [d.assessed, d.waived, d.paid].every(Number.isSafeInteger) &&
        d.assessed > 0 &&
        d.waived >= 0 &&
        d.paid >= 0 &&
        outstanding(d) >= 0,
      `Invalid balance for ${d.id}.`,
    );
  for (const c of s.credits)
    assert(
      Number.isSafeInteger(c.amount) && c.amount >= 0,
      "Credit balance cannot be negative.",
    );
  op.balanceChanges = Object.fromEntries(adj.map((a) => [a.id, a]));
  for (const rs of s.receiptStates)
    rs.allocationMap = Object.fromEntries(
      rs.allocations.map((l) => [
        l.dueId || l.creditId || "voluntary_" + l.fundId,
        l,
      ]),
    );
  s.operations.push(op);
  return s;
}
