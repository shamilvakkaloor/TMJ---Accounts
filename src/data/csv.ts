import Papa from "papaparse";
import type { Command, State } from "../domain/types";
import { assert, paise } from "../domain/utils";
export const templates = {
  houses: ["id", "name", "number", "address", "phone", "subMahalId", "joined"],
  members: [
    "id",
    "name",
    "phone",
    "dob",
    "verifiedAge",
    "ageVerifiedOn",
    "houseId",
    "joined",
    "approved",
  ],
  subMahals: ["id", "name", "order"],
  funds: [
    "id",
    "title",
    "target",
    "frequency",
    "mode",
    "amount",
    "rateFrom",
    "start",
    "end",
    "dueDay",
    "advance",
    "campaign",
    "eligibleIds",
  ],
  opening: ["walletId", "amount", "date", "description"],
  dues: ["payerId", "fundId", "period", "assessed"],
  receipts: [
    "payerId",
    "fundId",
    "amount",
    "date",
    "walletId",
    "method",
    "reference",
    "legacyNumber",
  ],
};
export type ImportKind = keyof typeof templates;
export function parseCsv(text: string) {
  const parsed = Papa.parse<Record<string, string>>(
    text.replace(/^\ufeff/, ""),
    {
      header: true,
      skipEmptyLines: "greedy",
      dynamicTyping: false,
      transformHeader: (h) => h.trim(),
    },
  );
  assert(
    parsed.errors.length === 0,
    parsed.errors[0]?.message || "Invalid CSV",
  );
  assert(parsed.data.length <= 10000, "Import at most 10,000 rows per file.");
  return { headers: parsed.meta.fields || [], rows: parsed.data };
}
export function rowCommand(
  kind: ImportKind,
  r: Record<string, string>,
  state: State,
  update = false,
): Command {
  const required = (...keys: string[]) =>
    keys.forEach((k) => assert(r[k]?.trim(), `Missing ${k}.`));
  const truth = (k: string) => /^(true|yes|1)$/i.test(r[k] || "");
  const exists = (
    col: "houses" | "members" | "subMahals" | "funds",
    id: string,
  ) =>
    assert(
      update || !state[col].some((v) => v.id === id),
      `${id} already exists; choose explicit update mode to edit it.`,
    );
  if (kind === "houses") {
    required("id", "name", "number", "subMahalId", "joined");
    exists("houses", r.id);
    return {
      type: "saveHouse",
      value: {
        id: r.id,
        name: r.name,
        number: r.number,
        address: r.address || "",
        phone: r.phone || "",
        subMahalId: r.subMahalId,
        joined: r.joined,
        active: true,
        inactiveDate: "",
        effectiveDate: r.joined,
      },
    };
  }
  if (kind === "members") {
    required("id", "name", "houseId", "joined");
    exists("members", r.id);
    return {
      type: "saveMember",
      value: {
        id: r.id,
        name: r.name,
        phone: r.phone || "",
        dob: r.dob || "",
        verifiedAge: Number(r.verifiedAge || 0),
        ageVerifiedOn: r.ageVerifiedOn || "",
        houseId: r.houseId,
        joined: r.joined,
        approved: truth("approved"),
        active: true,
        inactiveDate: "",
        effectiveDate: r.joined,
      },
    };
  }
  if (kind === "subMahals") {
    required("id", "name");
    exists("subMahals", r.id);
    return {
      type: "saveSubMahal",
      value: {
        id: r.id,
        name: r.name,
        order: Number(r.order || 1),
        active: true,
      },
    };
  }
  if (kind === "funds") {
    required("id", "title", "target", "frequency", "mode", "start");
    exists("funds", r.id);
    assert(["member", "house"].includes(r.target), "Invalid target.");
    assert(
      ["annual", "monthly", "one_time"].includes(r.frequency),
      "Invalid frequency.",
    );
    assert(["fixed", "voluntary"].includes(r.mode), "Invalid amount mode.");
    const rates = [...(state.funds.find((f) => f.id === r.id)?.rates || [])];
    if (r.mode === "fixed") {
      const rate = { from: r.rateFrom || r.start, amount: paise(r.amount) };
      if (!rates.some((v) => v.from === rate.from && v.amount === rate.amount))
        rates.push(rate);
    }
    return {
      type: "saveFund",
      value: {
        id: r.id,
        title: r.title,
        target: r.target as "member" | "house",
        frequency: r.frequency as "annual" | "monthly" | "one_time",
        mode: r.mode as "fixed" | "voluntary",
        rates: r.mode === "fixed" ? rates : [],
        start: r.start,
        end: r.end || "",
        active: true,
        dueDay: Number(r.dueDay || 28),
        advance: truth("advance"),
        campaign: r.campaign || "",
        eligibleIds: (r.eligibleIds || "").split(/[;\s]+/).filter(Boolean),
      },
    };
  }
  if (kind === "opening") {
    required("walletId", "amount", "date");
    return {
      type: "cashbook",
      kind: "opening",
      walletId: r.walletId,
      amount: paise(r.amount),
      date: r.date,
      category: "Opening balance",
      party: "",
      description: r.description || "Imported opening balance",
      reference: "",
    };
  }
  if (kind === "dues") {
    required("payerId", "fundId", "period", "assessed");
    return {
      type: "assess",
      payerId: r.payerId,
      fundId: r.fundId,
      period: r.period,
      assessed: paise(r.assessed),
    };
  }
  required("payerId", "fundId", "amount", "date", "legacyNumber");
  return {
    type: "payment",
    payerId: r.payerId,
    date: r.date,
    walletId: r.walletId || "cash",
    method: r.method || "Historical",
    reference: r.reference || "",
    lines: [{ fundId: r.fundId, amount: paise(r.amount) }],
    historical: true,
    legacyNumber: r.legacyNumber,
  };
}
export async function digest(s: string) {
  const hash = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(s),
  );
  return [...new Uint8Array(hash)]
    .map((n) => n.toString(16).padStart(2, "0"))
    .join("");
}
