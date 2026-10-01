import test from "node:test";
import assert from "node:assert/strict";
import { fixture, apply, payment } from "./fixture.js";
import { directoryRows, removalPlan } from "../domain/directory.js";
import { documents, changes } from "../domain/projection.js";
import { reportData } from "../domain/reports.js";
import { validateBackup } from "../domain/backup.js";

const house = (s, sub = "SM-02") =>
  apply(s, {
    type: "saveHouse",
    value: {
      ...s.houses[0],
      id: undefined,
      name: "New House",
      number: "02",
      subMahalId: sub,
      joined: "2025-01-01",
      subHistory: undefined,
    },
  });
const remove = (s, type, ids) => ({
  type: "removeRecords",
  recordType: type,
  ids,
  plan: removalPlan(s, type, ids).map((p) => [p.id, p.action]),
  reason: "Test cleanup",
});

test("registers houses without members and filters by Sub Mahal, occupancy, status and house", () => {
  const s = house(fixture());
  assert.deepEqual(
    directoryRows(s, "house", {
      sub: "SM-02",
      occupancy: "empty",
      status: "active",
    }).map((p) => p.id),
    ["H-000002"],
  );
  assert.equal(directoryRows(s, "member", { house: "H-000002" }).length, 0);
  assert.equal(
    directoryRows(s, "member", {
      sub: "SM-01",
      house: "H-000001",
      search: "Test Member",
    }).length,
    1,
  );
  assert.equal(
    directoryRows(s, "house", { sub: "SM-01", occupancy: "empty" }).length,
    0,
  );
});

test("permanently deletes only unused identities and removes their public profiles atomically", () => {
  let s = house(fixture());
  s = apply(s, {
    type: "saveMember",
    value: { ...s.members[0], id: "Unused", houseId: "H-000002" },
  });
  const before = documents(s),
    cmd = remove(s, "member", ["Unused"]);
  s = apply(s, cmd, "remove-unused");
  assert.equal(
    s.members.some((m) => m.id === "Unused"),
    false,
  );
  assert.deepEqual(
    changes(before, documents(s))
      .filter(([, v]) => v === null)
      .map(([p]) => p)
      .sort(),
    ["members/Unused", "publicMembers/Unused"],
  );
  assert.equal(apply(s, cmd, "remove-unused"), s);
  s = apply(s, remove(s, "house", ["H-000002"]));
  assert.equal(s.houses.length, 1);
  s = house(s);
  assert.equal(s.houses.at(-1).id, "H-000003");
  validateBackup({ format: "mahal-backup-v1", data: s });
});

test("filtered cleanup archives financial and household history without altering balances", () => {
  let s = house(fixture());
  s = apply(s, payment(40000));
  const history = structuredClone({
    dues: s.dues,
    receipts: s.receipts,
    ledger: s.ledger,
  });
  s = apply(s, remove(s, "member", ["M-000001"]));
  assert.equal(s.members[0].active, false);
  assert.equal(s.members[0].inactiveDate, "2026-09-25");
  assert.equal(removalPlan(s, "member", ["M-000001"])[0].action, "keep");
  s = apply(s, remove(s, "house", ["H-000001", "H-000002"]));
  assert.deepEqual(
    s.houses.map((h) => [h.id, h.active]),
    [["H-000001", false]],
  );
  assert.deepEqual(
    { dues: s.dues, receipts: s.receipts, ledger: s.ledger },
    history,
  );
  validateBackup({ format: "mahal-backup-v1", data: s });
});

test("cleanup refuses stale plans, duplicate IDs, missing records and oversized groups", () => {
  let s = house(fixture());
  const cmd = remove(s, "house", ["H-000002"]);
  s = apply(s, {
    type: "saveMember",
    value: { ...s.members[0], id: "NewMember", houseId: "H-000002" },
  });
  assert.throws(() => apply(s, cmd), /plan changed/);
  assert.throws(
    () => apply(s, { ...cmd, ids: ["H-000002", "H-000002"] }),
    /distinct/,
  );
  assert.throws(
    () => apply(s, { ...cmd, ids: ["missing"] }),
    /no longer exists/,
  );
  assert.throws(
    () =>
      apply(s, { ...cmd, ids: Array.from({ length: 6 }, (_, i) => String(i)) }),
    /five/,
  );
});

for (const sub of ["SM-01", "SM-02"])
  test(`member transfer to ${sub} carries arrears and credits, preserves receipts and house dues`, () => {
    let s = house(fixture(), sub);
    s = apply(s, payment(20000));
    s = apply(s, {
      ...payment(15000),
      lines: [{ fundId: "annual", amount: 15000, advancePeriod: "2027" }],
    });
    assert.equal(s.credits[0].amount, 15000);
    s = apply(s, {
      type: "saveFund",
      value: { ...s.funds[0], id: "houseFund", target: "house" },
    });
    s = apply(s, {
      type: "assess",
      payerId: "H-000001",
      fundId: "houseFund",
      period: "2026",
    });
    const receipts = structuredClone(s.receipts),
      dues = structuredClone(s.dues),
      credits = structuredClone(s.credits);
    s = apply(s, {
      type: "transferMember",
      id: "M-000001",
      fromHouseId: "H-000001",
      houseId: "H-000002",
      date: "2026-09-25",
    });
    assert.deepEqual(s.dues, dues);
    assert.deepEqual(s.credits, credits);
    assert.deepEqual(s.receipts, receipts);
    assert.equal(s.members[0].houseId, "H-000002");
    assert.equal(documents(s)["publicMembers/M-000001"].houseId, "H-000002");
    assert.ok(
      reportData(s, { from: "2026-01-01", to: "2026-12-31", sub }).dues.some(
        (d) => d.payerId === "M-000001",
      ),
    );
    s = apply(s, payment(10000));
    assert.equal(s.receipts.at(-1).houseId, "H-000002");
    assert.equal(s.receipts.at(-1).subMahalId, sub);
    s = apply(s, { ...payment(10000), date: "2026-09-24" });
    assert.equal(s.receipts.at(-1).houseId, "H-000001");
    s = apply(s, {
      type: "assess",
      payerId: "M-000001",
      fundId: "annual",
      period: "2027",
    });
    s = apply(s, {
      type: "applyCredit",
      creditId: s.credits[0].id,
      dueId: s.dues.at(-1).id,
      amount: 15000,
    });
    assert.equal(s.dues.at(-1).paid, 15000);
    assert.equal(s.credits[0].amount, 0);
    assert.equal(removalPlan(s, "house", ["H-000001"])[0].action, "archive");
    validateBackup({ format: "mahal-backup-v1", data: s });
  });

test("retains previous household links and explicit fund eligibility even without financial records", () => {
  let s = house(fixture());
  s.dues = [];
  s = apply(s, {
    type: "transferMember",
    id: "M-000001",
    fromHouseId: "H-000001",
    houseId: "H-000002",
    date: "2026-09-25",
  });
  assert.match(
    removalPlan(s, "house", ["H-000001"])[0].reason,
    /previous household/,
  );
  s.funds[0].eligibleIds = ["M-000001"];
  assert.match(
    removalPlan(s, "member", ["M-000001"])[0].reason,
    /eligible payer/,
  );
});

test("transfer rejects stale source, same house, future dates and inactive destinations", () => {
  let s = house(fixture());
  const cmd = {
    type: "transferMember",
    id: "M-000001",
    fromHouseId: "H-000001",
    houseId: "H-000002",
    date: "2026-09-25",
  };
  assert.throws(
    () => apply(s, { ...cmd, fromHouseId: "other" }),
    /house changed/,
  );
  assert.throws(() => apply(s, { ...cmd, houseId: "H-000001" }), /different/);
  assert.throws(
    () => apply(s, { ...cmd, date: "2026-09-26" }),
    /no later than today/,
  );
  s = apply(s, {
    type: "saveHouse",
    value: { ...s.houses[1], active: false, inactiveDate: "2026-09-25" },
  });
  assert.throws(() => apply(s, cmd), /active destination/);
});
