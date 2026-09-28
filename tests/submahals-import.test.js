import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { apply, fixture, payment } from "./fixture.js";
import { emptyState } from "../domain/seed.js";
import { csvDate, rowCommand } from "../domain/csv.js";
import { changes, documents } from "../domain/projection.js";
import { validateBackup } from "../domain/backup.js";
import { validDate } from "../domain/utils.js";

const add = (s, value = {}) => apply(s, { type: "saveSubMahal", value: { name: "New Sub Mahal", order: 11, active: true, ...value } });
describe("Sub Mahal lifecycle", () => {
  it("assigns manual IDs, preserves CSV IDs and does not reuse deleted IDs", () => {
    let s = add(emptyState());
    assert.equal(s.subMahals.at(-1).id, "SM-11");
    s = apply(s, { type: "deleteSubMahal", id: "SM-11" });
    s = add(s);
    assert.equal(s.subMahals.at(-1).id, "SM-12");
    s = add(s, { id: "SM-30" });
    s = add(s);
    assert.equal(s.subMahals.at(-1).id, "SM-31");
    s = apply(s, rowCommand("subMahals", { id: "WEST", name: "West", order: "14" }, s));
    assert.equal(s.subMahals.at(-1).id, "WEST");
  });
  it("does not reuse a deleted original ID before a sequence exists", () => {
    const s = add(apply(emptyState(), { type: "deleteSubMahal", id: "SM-10" }));
    assert.equal(s.subMahals.at(-1).id, "SM-11");
  });
  it("allows 25, rejects a 26th, and still permits edits at the limit", () => {
    let s = emptyState();
    for (let order = 11; order <= 25; order++) s = add(s, { order });
    assert.equal(s.subMahals.length, 25);
    assert.throws(() => add(s), /25 Sub Mahals/);
    s = add(s, { ...s.subMahals[0], name: "Renamed" });
    assert.equal(s.subMahals[0].name, "Renamed");
    for (const order of [0, 26, 1.5, NaN]) assert.throws(() => add(emptyState(), { order }), /Display order/);
  });
  it("deletes only unused records, emits a deletion patch and retains an idempotent audit", () => {
    const before = fixture();
    const after = apply(before, { type: "deleteSubMahal", id: "SM-10" }, "delete-unused");
    assert.equal(after.subMahals.length, 9);
    assert.equal(after.operations.at(-1).targetId, "SM-10");
    assert.ok(changes(documents(before), documents(after)).some(([path, value]) => path === "subMahals/SM-10" && value === null));
    assert.equal(apply(after, { type: "deleteSubMahal", id: "SM-10" }, "delete-unused"), after);
    validateBackup({ format: "mahal-backup-v1", data: after });
    assert.throws(() => apply(before, { type: "deleteSubMahal", id: "SM-01" }), /used by a house/);
    assert.equal(before.subMahals.length, 10);
  });
  it("protects historical house links, receipt snapshots and the last Sub Mahal", () => {
    let s = fixture();
    s = apply(s, { type: "saveHouse", value: { ...s.houses[0], subMahalId: "SM-02", effectiveDate: "2026-09-01" } });
    assert.throws(() => apply(s, { type: "deleteSubMahal", id: "SM-01" }), /assignment history/);
    s = apply(fixture(), payment());
    s.houses = [];
    assert.throws(() => apply(s, { type: "deleteSubMahal", id: "SM-01" }), /receipts/);
    s = emptyState();
    s.subMahals = s.subMahals.slice(0, 1);
    assert.throws(() => apply(s, { type: "deleteSubMahal", id: "SM-01" }), /at least one/);
  });
});
describe("CSV joining dates", () => {
  it("groups house imports in one audit operation and resumes without duplicate rows", () => {
    const state = emptyState();
    const items = Array.from({ length: 5 }, (_, index) => ({
      rowId: `import-example-${index}`,
      command: rowCommand("houses", {
        id: `H-CUSTOM${index}`, name: `House ${index}`, number: String(index),
        subMahalId: "SM-01", joined: "2025-01-01",
      }, state),
    }));
    const cmd = { type: "importHouseBatch", items };
    const next = apply(state, cmd, "import-group-1");
    assert.equal(next.houses.length, 5);
    assert.equal(next.operations.length, state.operations.length + 1);
    assert.deepEqual(next.operations.at(-1).rowIds, items.map((item) => item.rowId));
    assert.equal(apply(next, cmd, "import-group-1"), next);
    validateBackup({ format: "mahal-backup-v1", data: next });
    assert.throws(() => apply(state, { ...cmd, items: [...items, items[0]] }), /at most 5/);
    assert.throws(() => apply(state, { ...cmd, items: [items[0], { ...items[1], rowId: items[0].rowId }] }), /row IDs must be unique/);
    assert.throws(() => apply(state, { ...cmd, items: [items[0], { ...items[1], command: items[0].command }] }), /House IDs must be unique/);
  });
  it("preserves alphanumeric house IDs through CSV, member links, receipts and backup", () => {
    let s = fixture();
    const row = { id: "H-TMJBDR002", name: "Custom ID House", number: "002", subMahalId: "SM-01", joined: "01/01/2025" };
    s = apply(s, rowCommand("houses", row, s));
    assert.equal(s.houses.at(-1).id, row.id);
    assert.equal(s.sequences.find((q) => q.id === "house").value, 1);
    s = apply(s, { type: "saveMember", value: { ...s.members[0], houseId: row.id, effectiveDate: "2026-01-01" } });
    s = apply(s, payment());
    assert.equal(s.receipts.at(-1).houseId, row.id);
    assert.equal(documents(s)[`publicHouses/${row.id}`].id, row.id);
    validateBackup({ format: "mahal-backup-v1", data: s });
    s = apply(s, rowCommand("houses", { ...row, name: "Updated name" }, s, true));
    assert.equal(s.houses.at(-1).name, "Updated name");
    assert.throws(() => rowCommand("houses", row, s), /already exists/);
  });
  it("keeps automatic numeric house IDs working after custom CSV imports", () => {
    const row = { id: "H-TMJBDR002", name: "Custom ID House", number: "002", subMahalId: "SM-01", joined: "2025-01-01" };
    let s = apply(emptyState(), rowCommand("houses", row, emptyState()));
    validateBackup({ format: "mahal-backup-v1", data: s });
    s = apply(s, { type: "saveHouse", value: { ...s.houses[0], id: "", number: "003" } });
    assert.equal(s.houses.at(-1).id, "H-000001");
    assert.equal(s.sequences.find((q) => q.id === "house").value, 1);
  });
  it("rejects malformed custom house IDs", () => {
    const s = emptyState();
    for (const id of ["TMJBDR002", "H-", "H-TMJ/002", "H-TMJ 002", "H-" + "A".repeat(65)]) {
      const cmd = rowCommand("houses", { id, name: "House", number: "1", subMahalId: "SM-01", joined: "2025-01-01" }, s);
      assert.throws(() => apply(s, cmd), /House ID must start with H-/);
    }
  });
  it("normalizes ISO, day-first spreadsheet dates and explicit month-first dates", () => {
    for (const raw of ["2026-09-25", "25/09/2026", "25-9-2026", "25.09.2026", " 2026/9/25 "])
      assert.equal(csvDate(raw, "joined"), "2026-09-25");
    assert.equal(csvDate("09/25/2026", "joined", "MDY"), "2026-09-25");
    assert.equal(csvDate("02/03/2026", "joined", "DMY"), "2026-03-02");
    assert.equal(csvDate("02/03/2026", "joined", "MDY"), "2026-02-03");
    assert.equal(csvDate("2024-02-29"), "2024-02-29");
  });
  it("rejects impossible dates, two-digit years and serial numbers with a useful error", () => {
    for (const raw of ["31/02/2026", "29/02/2025", "2026-13-01", "25/09/26", "45000"])
      assert.throws(() => csvDate(raw, "joined"), /Invalid joined:.*four-digit year/);
    assert.equal(validDate("2026-13-01"), false);
    assert.equal(validDate("2026-02-31"), false);
  });
  it("imports houses before cutover with normalized assignment history", () => {
    const row = { id: "H-000050", name: "CSV House", number: "005", subMahalId: "SM-01", joined: "31/12/2024" };
    const state = emptyState();
    const cmd = rowCommand("houses", row, state);
    const next = apply(state, cmd);
    assert.equal(next.houses[0].joined, "2024-12-31");
    assert.deepEqual(next.houses[0].subHistory, [{ date: "2024-12-31", value: "SM-01" }]);
    assert.equal(row.joined, "31/12/2024");
    assert.throws(() => rowCommand("houses", { ...row, joined: "" }, state), /Missing joined/);
    assert.throws(() => rowCommand("houses", row, next), /already exists/);
  });
});
