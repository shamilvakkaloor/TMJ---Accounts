import { norm } from "./utils.js";
export function documents(s) {
  const out = {};
  for (const [col, rows] of Object.entries(s))
    for (const row of rows) out[`${col}/${row.id}`] = row;
  const settings = s.settings[0];
  for (const l of s.ledger)
    if (l.kind === "opening")
      out[`openingEntries/${l.walletId}`] = { ledgerId: l.id };
  const version = `${Number(settings.publicPhone)}${Number(settings.publicAddress)}${Number(settings.publicHistory)}`;
  out["publicSettings/mahal"] = {
    id: "mahal",
    name: settings.name,
    address: settings.address,
    contact: settings.contact,
    logo: settings.logo,
    timezone: settings.timezone,
    publicPhone: settings.publicPhone,
    publicAddress: settings.publicAddress,
    publicHistory: settings.publicHistory,
    version,
  };
  for (const h of s.houses)
    out[`publicHouses/${h.id}`] = {
      id: h.id,
      name: h.name,
      nameKey: norm(h.name),
      number: h.number,
      numberKey: norm(h.number),
      phone: settings.publicPhone ? h.phone : "",
      phoneKey: settings.publicPhone ? h.phone.replace(/\D/g, "") : "",
      address: settings.publicAddress ? h.address : "",
      subMahalId: h.subMahalId,
      subMahalName: s.subMahals.find((x) => x.id === h.subMahalId)?.name || "",
      active: h.active,
      version,
    };
  for (const m of s.members)
    out[`publicMembers/${m.id}`] = {
      id: m.id,
      name: m.name,
      nameKey: norm(m.name),
      phone: settings.publicPhone ? m.phone : "",
      phoneKey: settings.publicPhone ? m.phone.replace(/\D/g, "") : "",
      houseId: m.houseId,
      active: m.active,
      version,
    };
  for (const d of s.dues) out[`publicDues/${d.id}`] = { ...d };
  for (const c of s.credits) out[`publicCredits/${c.id}`] = { ...c };
  for (const r of s.receipts) {
    out[`receiptNumbers/${r.number}`] = { receiptId: r.id };
    const rs = s.receiptStates.find((x) => x.id === r.id);
    out[`publicReceipts/${r.id}`] = {
      id: r.id,
      number: r.number,
      payerId: r.payerId,
      payerType: r.payerType,
      payerName: r.payerName,
      houseId: r.houseId,
      houseName: r.houseName,
      subMahalId: r.subMahalId,
      subMahalName: r.subMahalName,
      date: r.date,
      postedAt: r.postedAt,
      method: r.method,
      lines: r.lines,
      total: r.total,
      outstandingAfter: r.outstandingAfter,
      advanceAfter: r.advanceAfter,
      historical: r.historical,
      legacyNumber: r.legacyNumber,
      refunded: rs?.refunded || 0,
      voided: rs?.voided || false,
    };
  }
  return out;
}
export function changes(before, after) {
  return [...Object.entries(after).filter(
    ([p, v]) => JSON.stringify(before[p]) !== JSON.stringify(v),
  ), ...Object.keys(before).filter((p) => !(p in after)).map((p) => [p, null])];
}
