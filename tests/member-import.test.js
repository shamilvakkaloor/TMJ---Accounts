import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { fixture, apply } from "./fixture.js";
import { rowCommand, parseCsv, templates } from "../domain/csv.js";
import { assessmentPreview } from "../domain/engine.js";
import { documents } from "../domain/projection.js";
import { validateBackup } from "../domain/backup.js";

describe("optional member CSV fields", () => {
  it("imports four-column custom IDs without corrupting the member sequence", () => {
    let s = fixture();
    for (const id of ["TMJBDR002", "12345", "member-Ab12"]) {
      const csv = `id,name,houseId,care of\n${id},Member,H-000001,Contact`;
      s = apply(s, rowCommand("members", parseCsv(csv).rows[0], s));
      assert.equal(s.members.at(-1).id, id);
      assert.equal(s.members.at(-1).careOf, "Contact");
      assert.equal(s.sequences.find((v) => v.id === "member").value, 1);
      validateBackup({ format: "mahal-backup-v1", data: s });
    }
    s = apply(s, { type: "saveMember", value: { ...s.members.at(-1), id: "" } });
    assert.equal(s.members.at(-1).id, "M-000002");
    assert.equal(s.sequences.find((v) => v.id === "member").value, 2);
  });
  it("imports with only id, name and houseId without inventing age or joining dates", () => {
    const s = fixture();
    const row = parseCsv("id,name,houseId\nM-000002,New Member,H-000001").rows[0];
    const next = apply(s, rowCommand("members", row, s));
    const member = next.members.at(-1);
    assert.equal(member.phone, "");
    assert.equal(member.dob, "");
    assert.equal(member.verifiedAge, 0);
    assert.equal(member.ageVerifiedOn, "");
    assert.equal(member.joined, "");
    assert.equal(member.approved, false);
    assert.equal(member.careOf, "");
    assert.equal(member.houseHistory[0].value, "H-000001");
    assert.equal(assessmentPreview(next, "annual", "2026").some((m) => m.id === member.id), false);
    validateBackup({ format: "mahal-backup-v1", data: next });
  });
  it("preserves optional care of in member records and backups without publishing it", () => {
    const s = fixture();
    const next = apply(s, rowCommand("members", { id: "M-000002", name: "Member", houseId: "H-000001", "care of": "Abdul Rahman" }, s));
    assert.ok(templates.members.includes("care of"));
    assert.equal(next.members.at(-1).careOf, "Abdul Rahman");
    assert.equal(documents(next)["publicMembers/M-000002"].careOf, undefined);
    assert.equal(validateBackup({ format: "mahal-backup-v1", data: next }).members.at(-1).careOf, "Abdul Rahman");
  });
  it("allows completing missing details later and retains age checks for explicit approval", () => {
    let s = fixture();
    s = apply(s, rowCommand("members", { id: "M-000002", name: "Member", houseId: "H-000001" }, s));
    const member = s.members.at(-1);
    assert.throws(() => apply(s, { type: "saveMember", value: { ...member, approved: true } }), /joining date/);
    assert.throws(() => apply(s, { type: "saveMember", value: { ...member, joined: "2025-01-01", approved: true } }), /at least 21/);
    s = apply(s, { type: "saveMember", value: { ...member, joined: "2025-01-01", dob: "1990-01-01", approved: true } });
    assert.equal(s.members.at(-1).houseHistory[0].date, "2025-01-01");
    assert.equal(assessmentPreview(s, "annual", "2026").some((m) => m.id === member.id), true);
  });
});
