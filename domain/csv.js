import { assert, paise, validDate } from "./utils.js";
export function csvDate(value, field = "date", order = "DMY") {
  const text = String(value ?? "").trim();
  if (!text) return "";
  let year, month, day;
  const iso = /^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})$/.exec(text);
  const local = /^(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})$/.exec(text);
  if (iso) [, year, month, day] = iso;
  else if (local) {
    year = local[3];
    [day, month] = order === "MDY" ? [local[2], local[1]] : [local[1], local[2]];
  }
  const result = year ? `${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}` : "";
  assert(validDate(result), `Invalid ${field}: "${text}". Use YYYY-MM-DD or ${order === "MDY" ? "MM/DD/YYYY" : "DD/MM/YYYY"} with a four-digit year and a real calendar date.`);
  return result;
}
const dateFields = {
  houses: ["joined"], members: ["joined", "dob", "ageVerifiedOn"],
  funds: ["start", "end", "rateFrom"], opening: ["date"], receipts: ["date"],
};
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
    "care of",
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
export function parseCsv(text) {
  text = text.replace(/^\ufeff/, "");
  const records = [];
  let row = [],
    value = "",
    quoted = false,
    closed = false;
  const cell = () => {
    row.push(value);
    value = "";
    closed = false;
  };
  const record = () => {
    cell();
    if (row.some((v) => v.trim())) records.push(row);
    row = [];
  };
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (quoted) {
      if (c === '"' && text[i + 1] === '"') {
        value += '"';
        i++;
      } else if (c === '"') {
        quoted = false;
        closed = true;
      } else value += c;
    } else if (c === ",") cell();
    else if (c === "\n" || c === "\r") {
      if (c === "\r" && text[i + 1] === "\n") i++;
      record();
    } else if (c === '"') {
      assert(!value && !closed, "Unexpected quote in CSV.");
      quoted = true;
    } else {
      assert(!closed, "Unexpected text after closing CSV quote.");
      value += c;
    }
  }
  assert(!quoted, "Unclosed quote in CSV.");
  if (value || row.length || closed) record();
  const headers = (records.shift() || []).map((v) => v.trim());
  assert(
    headers.length &&
      headers.every(Boolean) &&
      new Set(headers).size === headers.length,
    "CSV headers must be nonempty and unique.",
  );
  assert(records.length <= 10000, "Import at most 10,000 rows per file.");
  const rows = records.map((r, i) => {
    assert(
      r.length === headers.length,
      `CSV row ${i + 2} has the wrong number of columns.`,
    );
    return Object.fromEntries(headers.map((h, j) => [h, r[j]]));
  });
  return { headers, rows };
}
export function rowCommand(kind, r, state, update = false, dateOrder = "DMY") {
  r = { ...r };
  for (const field of dateFields[kind] || []) r[field] = csvDate(r[field], field, dateOrder);
  const required = (...keys) =>
    keys.forEach((k) => assert(r[k]?.trim(), `Missing ${k}.`));
  const truth = (k) => /^(true|yes|1)$/i.test(r[k] || "");
  const exists = (col, id) =>
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
    required("id", "name", "houseId");
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
        careOf: r["care of"] || r.careOf || r.care_of || "",
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
        target: r.target,
        frequency: r.frequency,
        mode: r.mode,
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
