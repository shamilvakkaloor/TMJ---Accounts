import type { Credit, Due, History, State } from "./types";
export const money = (n: number) =>
  new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    minimumFractionDigits: 2,
  }).format(n / 100);
export function paise(s: string | number) {
  const v = String(s).trim();
  if (!/^\d+(\.\d{1,2})?$/.test(v))
    throw new Error("Enter a positive amount with at most two decimal places.");
  const [a, b = ""] = v.split(".");
  const n = Number(a) * 100 + Number(b.padEnd(2, "0"));
  if (!Number.isSafeInteger(n) || n > 100_000_000_000)
    throw new Error("Amount is too large.");
  return n;
}
export function assert(ok: unknown, message: string): asserts ok {
  if (!ok) throw new Error(message);
}
export const norm = (s: string) =>
  s.normalize("NFKC").trim().toLocaleLowerCase().replace(/\s+/g, " ");
export const today = (timezone = "Asia/Kolkata") =>
  new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
export const displayDate = (s: string) =>
  s
    ? new Intl.DateTimeFormat("en-IN", {
        day: "2-digit",
        month: "short",
        year: "numeric",
        timeZone: "UTC",
      }).format(new Date(s.length === 10 ? s + "T00:00:00Z" : s))
    : "—";
export const outstanding = (d: Due) => d.assessed - d.waived - d.paid;
export const dueStatus = (d: Due) =>
  outstanding(d) === 0
    ? d.waived === d.assessed
      ? "waived"
      : "paid"
    : d.paid > 0
      ? "partial"
      : "unpaid";
export const sum = <T>(arr: T[], get: (v: T) => number) =>
  arr.reduce((n, v) => n + get(v), 0);
export const balance = (s: State, walletId: string) =>
  sum(
    s.ledger.filter((l) => l.walletId === walletId),
    (l) => l.amount,
  );
export const uid = () => crypto.randomUUID();
export const atDate = (h: History[], date: string) =>
  [...h]
    .sort((a, b) => b.date.localeCompare(a.date))
    .find((x) => x.date <= date)?.value;
export function validDate(s: string) {
  return (
    /^\d{4}-\d{2}-\d{2}$/.test(s) &&
    new Date(s + "T00:00:00Z").toISOString().slice(0, 10) === s
  );
}
export function ageAt(dob: string, date: string) {
  let n = Number(date.slice(0, 4)) - Number(dob.slice(0, 4));
  if (date.slice(5) < dob.slice(5)) n--;
  return n;
}
export const creditTotal = (credits: Credit[]) => sum(credits, (c) => c.amount);
export function download(name: string, text: string, type = "text/plain") {
  const a = document.createElement("a");
  const url = URL.createObjectURL(new Blob([text], { type }));
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
