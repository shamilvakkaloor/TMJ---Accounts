import { norm } from "./utils.js";

export function directoryRows(
  s,
  type,
  { search = "", sub = "", status = "", house = "", occupancy = "" } = {},
) {
  return (type === "member" ? s.members : s.houses).filter((p) => {
    const h = type === "member" ? s.houses.find((h) => h.id === p.houseId) : p;
    const occupied =
      type === "house" && s.members.some((m) => m.houseId === p.id);
    return (
      norm(
        `${p.name} ${p.id} ${p.phone || ""} ${p.number || ""} ${p.careOf || ""}`,
      ).includes(norm(search)) &&
      (!sub || h?.subMahalId === sub) &&
      (!status || (status === "active" ? p.active : !p.active)) &&
      (!house || p.houseId === house) &&
      (!occupancy || (occupancy === "empty" ? !occupied : occupied))
    );
  });
}

export function removalPlan(s, type, ids) {
  const rows = type === "member" ? s.members : s.houses;
  return ids.map((id) => {
    const record = rows.find((p) => p.id === id);
    if (!record)
      return { id, action: "missing", reason: "Record no longer exists." };
    let reason = "";
    if (
      s.dues.some((d) => d.payerId === id) ||
      s.credits.some((c) => c.payerId === id) ||
      s.receipts.some(
        (r) => r.payerId === id || (type === "house" && r.houseId === id),
      )
    )
      reason = "Financial history must be preserved.";
    else if (
      type === "house" &&
      s.members.some(
        (m) => m.houseId === id || m.houseHistory.some((h) => h.value === id),
      )
    )
      reason =
        "Current or previous household members must keep their house link.";
    else if (
      s.funds.some((f) => f.target === type && f.eligibleIds.includes(id))
    )
      reason = "This record is included in a fund's eligible payer list.";
    return {
      id,
      record,
      action: reason ? (record.active ? "archive" : "keep") : "delete",
      reason: reason || "Unused record; safe to delete permanently.",
    };
  });
}
