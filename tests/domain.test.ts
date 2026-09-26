import { describe, expect, it } from "vitest";
import { execute, assessmentPreview } from "../src/domain/engine";
import { documents } from "../src/data/projection";
import { parseCsv, rowCommand } from "../src/data/csv";
import { balance, money, outstanding, paise, sum } from "../src/domain/utils";
import { apply, fixture, now, payment } from "./fixture";
import { validateBackup } from "../src/domain/backup";
import { demoState } from "../src/domain/seed";
describe("accounting invariants", () => {
  it("roundtrips a complete backup after credit allocation and refund", () => {
    let s = apply(fixture(), payment(140000));
    s = apply(s, {
      type: "assess",
      payerId: "M-000001",
      fundId: "annual",
      period: "2027",
    });
    s = apply(s, {
      type: "applyCredit",
      creditId: s.credits[0].id,
      dueId: s.dues[1].id,
      amount: 40000,
    });
    s = apply(s, {
      type: "refund",
      receiptId: s.receipts[0].id,
      amount: 20000,
      walletId: "cash",
      date: "2026-09-25",
      reason: "Correction",
    });
    expect(
      validateBackup(
        JSON.parse(JSON.stringify({ format: "mahal-backup-v1", data: s })),
      ),
    ).toEqual(s);
    expect(
      validateBackup({ format: "mahal-backup-v1", data: demoState() }).members,
    ).toHaveLength(12);
  });
  it("rejects backups with broken balances and reused receipt sequences", () => {
    const s = apply(fixture(), payment());
    const badWallet = structuredClone(s);
    badWallet.wallets[0].balance++;
    expect(() =>
      validateBackup({ format: "mahal-backup-v1", data: badWallet }),
    ).toThrow("does not reconcile");
    const badSeq = structuredClone(s);
    badSeq.sequences.find((q) => q.id === "receipt-2026")!.value = 0;
    expect(() =>
      validateBackup({ format: "mahal-backup-v1", data: badSeq }),
    ).toThrow("Receipt sequence");
  });
  it("posts a partial payment with an equal cash inflow", () => {
    const s = apply(fixture(), payment(45000));
    expect(outstanding(s.dues[0])).toBe(55000);
    expect(balance(s, "cash")).toBe(45000);
    expect(s.receipts[0].total).toBe(45000);
  });
  it("prepayment enters cash once, then applies to next year without extra cash", () => {
    let s = apply(fixture(), payment(160000), "receipt");
    expect(s.credits[0].amount).toBe(60000);
    s = apply(s, {
      type: "assess",
      payerId: "M-000001",
      fundId: "annual",
      period: "2027",
    });
    s = apply(s, {
      type: "applyCredit",
      creditId: s.credits[0].id,
      dueId: "M-000001_annual_2027",
      amount: 60000,
    });
    expect(balance(s, "cash")).toBe(160000);
    expect(s.credits[0].amount).toBe(0);
    expect(outstanding(s.dues[1])).toBe(40000);
  });
  it("retains remaining credit when the next-year assessment is lower", () => {
    let s = apply(fixture(), payment(250000));
    s = apply(s, {
      type: "assess",
      payerId: "M-000001",
      fundId: "annual",
      period: "2027",
      assessed: 80000,
    });
    s = apply(s, {
      type: "applyCredit",
      creditId: s.credits[0].id,
      dueId: s.dues[1].id,
      amount: 80000,
    });
    expect(s.credits[0].amount).toBe(70000);
    expect(balance(s, "cash")).toBe(250000);
  });
  it("refund reopens paid dues and cannot be replayed", () => {
    let s = apply(fixture(), payment(), "r");
    const cmd = {
      type: "refund" as const,
      receiptId: "r",
      amount: 25000,
      walletId: "cash",
      date: "2026-09-25",
      reason: "Requested refund",
    };
    s = apply(s, cmd, "refund");
    expect(outstanding(s.dues[0])).toBe(25000);
    expect(balance(s, "cash")).toBe(75000);
    expect(apply(s, cmd, "refund")).toBe(s);
    expect(() => apply(s, { ...cmd, amount: 80000 })).toThrow(
      "remaining refundable",
    );
  });
  it("void after advance application and partial refund reverses only the remainder", () => {
    let s = apply(fixture(), payment(150000), "r");
    s = apply(s, {
      type: "assess",
      payerId: "M-000001",
      fundId: "annual",
      period: "2027",
    });
    s = apply(s, {
      type: "applyCredit",
      creditId: s.credits[0].id,
      dueId: s.dues[1].id,
      amount: 50000,
    });
    s = apply(s, {
      type: "refund",
      receiptId: "r",
      amount: 20000,
      walletId: "cash",
      date: "2026-09-25",
      reason: "Refund request",
    });
    s = apply(s, {
      type: "void",
      receiptId: "r",
      date: "2026-09-25",
      reason: "Incorrect receipt",
    });
    expect(balance(s, "cash")).toBe(0);
    expect(s.dues.map(outstanding)).toEqual([100000, 100000]);
    expect(s.receiptStates[0].voided).toBe(true);
    expect(s.receipts[0].total).toBe(150000);
  });
  it("waivers and restored waivers never affect cash", () => {
    let s = fixture();
    s = apply(s, {
      type: "waive",
      dueId: s.dues[0].id,
      amount: 20000,
      reason: "Approved exemption",
    });
    s = apply(s, {
      type: "restoreWaiver",
      dueId: s.dues[0].id,
      amount: 5000,
      reason: "Correct exemption",
    });
    expect(outstanding(s.dues[0])).toBe(85000);
    expect(balance(s, "cash")).toBe(0);
    expect(() =>
      apply(s, {
        type: "waive",
        dueId: s.dues[0].id,
        amount: 90000,
        reason: "Too much",
      }),
    ).toThrow();
  });
  it("transfers preserve central cash and have equal opposite entries", () => {
    let s = apply(fixture(), payment());
    s = apply(s, {
      type: "cashbook",
      kind: "transfer",
      walletId: "cash",
      toWalletId: "bank",
      amount: 30000,
      date: "2026-09-25",
      category: "Transfer",
      party: "",
      description: "Deposit cash",
      reference: "",
    });
    expect(balance(s, "cash")).toBe(70000);
    expect(balance(s, "bank")).toBe(30000);
    expect(
      sum(
        s.ledger.filter((l) => l.kind === "transfer"),
        (l) => l.amount,
      ),
    ).toBe(0);
  });
  it("rejects spending money the wallet does not hold", () =>
    expect(() =>
      apply(fixture(), {
        type: "cashbook",
        kind: "expense",
        walletId: "cash",
        amount: 1000,
        date: "2026-09-25",
        category: "Other",
        party: "",
        description: "Unexpected expense",
        reference: "",
      }),
    ).toThrow("Insufficient"));
  it("idempotent assessment and submission do not consume more numbers", () => {
    const s = apply(fixture(), payment(), "stable-id");
    expect(apply(s, payment(), "stable-id")).toBe(s);
    expect(
      apply(s, {
        type: "assess",
        payerId: "M-000001",
        fundId: "annual",
        period: "2026",
      }),
    ).toBe(s);
    expect(s.sequences.find((q) => q.id === "receipt-2026")?.value).toBe(1);
  });
  it("does not change earlier receipts when a member moves", () => {
    let s = apply(fixture(), payment(), "r");
    s = apply(s, {
      type: "saveHouse",
      value: {
        name: "New House",
        number: "002",
        address: "",
        phone: "",
        subMahalId: "SM-02",
        active: true,
        joined: "2025-01-01",
        inactiveDate: "",
      },
    });
    s = apply(s, {
      type: "saveMember",
      value: {
        ...s.members[0],
        houseId: "H-000002",
        effectiveDate: "2026-09-25",
      },
    });
    expect(s.members[0].id).toBe("M-000001");
    expect(s.receipts[0].subMahalId).toBe("SM-01");
  });
  it("uses historical assignments for backdated receipts", () => {
    let s = fixture();
    s = apply(s, {
      type: "saveHouse",
      value: {
        ...s.houses[0],
        subMahalId: "SM-02",
        effectiveDate: "2026-06-01",
      },
    });
    s = apply(s, { ...payment(), date: "2026-04-01" } as Parameters<
      typeof apply
    >[1]);
    expect(s.receipts[0].subMahalId).toBe("SM-01");
  });
  it("keeps assessed rates unchanged when a future rate is added", () => {
    let s = fixture();
    s = apply(s, {
      type: "saveFund",
      value: {
        ...s.funds[0],
        rates: [...s.funds[0].rates, { from: "2027-01-01", amount: 120000 }],
      },
    });
    s = apply(s, {
      type: "assess",
      payerId: "M-000001",
      fundId: "annual",
      period: "2027",
    });
    expect(s.dues.map((d) => d.assessed)).toEqual([100000, 120000]);
  });
  it("rejects eligibility below 21", () => {
    const s = fixture();
    expect(() =>
      apply(s, {
        type: "saveMember",
        value: { ...s.members[0], id: undefined, dob: "2010-01-01" },
      }),
    ).toThrow("21");
  });
  it("stops future assessments without removing historical arrears", () => {
    let s = fixture();
    s = apply(s, {
      type: "saveMember",
      value: { ...s.members[0], active: false, inactiveDate: "2026-08-01" },
    });
    expect(assessmentPreview(s, "annual", "2027")).toHaveLength(0);
    expect(outstanding(s.dues[0])).toBe(100000);
  });
  it("voluntary donations never create overdue balances", () => {
    let s = fixture();
    s = apply(s, {
      type: "saveFund",
      value: {
        ...s.funds[0],
        id: "donation",
        title: "Donation",
        mode: "voluntary",
        rates: [],
        advance: false,
      },
    });
    s = apply(s, {
      type: "payment",
      payerId: "M-000001",
      walletId: "cash",
      date: "2026-09-25",
      method: "Cash",
      reference: "",
      lines: [{ fundId: "donation", amount: 12345 }],
    });
    expect(s.dues).toHaveLength(1);
    expect(balance(s, "cash")).toBe(12345);
  });
  it("rejects a member receipt containing a house fund", () => {
    let s = fixture();
    s = apply(s, {
      type: "saveFund",
      value: { ...s.funds[0], id: "housefee", target: "house", advance: false },
    });
    expect(() =>
      apply(s, {
        type: "payment",
        payerId: "M-000001",
        walletId: "cash",
        date: "2026-09-25",
        method: "Cash",
        reference: "",
        lines: [{ fundId: "housefee", amount: 100000 }],
      }),
    ).toThrow("payer type");
  });
  it("statement-only historical receipts do not double count opening cash", () => {
    let s = fixture();
    s = apply(s, {
      ...payment(),
      date: "2025-12-12",
      historical: true,
      legacyNumber: "OLD-22",
    } as Parameters<typeof apply>[1]);
    expect(balance(s, "cash")).toBe(0);
    expect(outstanding(s.dues[0])).toBe(100000);
    expect(s.receipts[0].historical).toBe(true);
  });
  it("sub-Mahal net collection totals include exactly the same correction amounts", () => {
    let s = apply(fixture(), payment(), "r");
    s = apply(s, {
      type: "refund",
      receiptId: "r",
      amount: 10000,
      date: "2026-09-25",
      walletId: "cash",
      reason: "Refund",
    });
    const ops = s.operations.filter((o) =>
      ["payment", "refund", "void"].includes(o.kind),
    );
    expect(sum(ops, (o) => sum(o.fundAmounts, (l) => l.amount))).toBe(
      balance(s, "cash"),
    );
  });
  it("supports four monthly period allocations in one receipt", () => {
    let s = fixture();
    s = apply(s, {
      type: "saveFund",
      value: {
        ...s.funds[0],
        id: "monthly",
        frequency: "monthly",
        advance: false,
        rates: [{ from: "2025-01-01", amount: 1000 }],
      },
    });
    for (let i = 1; i <= 4; i++)
      s = apply(s, {
        type: "assess",
        payerId: "M-000001",
        fundId: "monthly",
        period: `2026-0${i}`,
      });
    s = apply(s, {
      type: "payment",
      payerId: "M-000001",
      date: "2026-09-25",
      walletId: "cash",
      method: "Cash",
      reference: "",
      lines: [{ fundId: "monthly", amount: 4000 }],
    });
    expect(s.receipts[0].lines).toHaveLength(4);
  });
  it("a next-day Indian payment date is valid while UTC is the previous day", () => {
    expect(() =>
      execute(
        fixture(),
        { ...payment(), date: "2026-09-26" } as Parameters<typeof execute>[1],
        {
          operationId: "timezone",
          actor: "test-admin",
          now: "2026-09-25T20:00:00Z",
        },
      ),
    ).not.toThrow();
  });
});
describe("publication and import", () => {
  it("publishes only the explicit field set", () => {
    const s = apply(fixture(), payment());
    const docs = documents(s);
    expect(docs["publicMembers/M-000001"]).not.toHaveProperty("dob");
    expect(docs["publicReceipts/" + s.receipts[0].id]).not.toHaveProperty(
      "reference",
    );
    expect(docs["publicReceipts/" + s.receipts[0].id]).not.toHaveProperty(
      "walletId",
    );
  });
  it("removes private phone, search key and address when settings change", () => {
    const s = fixture();
    s.settings[0].publicPhone = false;
    s.settings[0].publicAddress = false;
    const d = documents(s);
    expect(d["publicMembers/M-000001"].phoneKey).toBe("");
    expect(d["publicHouses/H-000001"].address).toBe("");
  });
  it("preserves Malayalam, leading zero IDs and quoted CSV values", () => {
    const p = parseCsv(
      '\ufeffid,name,number,phone\r\nH-000005,"നൂർ, വീട്",001,09000000001',
    );
    expect(p.rows[0].name).toBe("നൂർ, വീട്");
    expect(p.rows[0].number).toBe("001");
    expect(p.rows[0].phone).toBe("09000000001");
  });
  it("requires explicit update mode for existing import identities", () =>
    expect(() =>
      rowCommand(
        "houses",
        {
          id: "H-000001",
          name: "New",
          number: "01",
          subMahalId: "SM-01",
          joined: "2025-01-01",
        },
        fixture(),
      ),
    ).toThrow("update mode"));
  it("imported IDs advance the sequence safely", () => {
    let s = fixture();
    s = apply(s, {
      type: "saveHouse",
      value: { ...s.houses[0], id: "H-000500", name: "Imported" },
    });
    s = apply(s, {
      type: "saveHouse",
      value: { ...s.houses[0], id: undefined, name: "Next" },
    });
    expect(s.houses.at(-1)?.id).toBe("H-000501");
  });
  it("uses integer paise and rejects rounding beyond two decimals", () => {
    expect(paise("1000.05")).toBe(100005);
    expect(() => paise("0.001")).toThrow();
    expect(() => paise("-1")).toThrow();
    expect(money(100005)).toContain("1,000.05");
  });
  it("failed transactions do not mutate their input state", () => {
    const s = fixture(),
      snapshot = JSON.stringify(s);
    expect(() => apply(s, payment(-5))).toThrow();
    expect(JSON.stringify(s)).toBe(snapshot);
  });
});
