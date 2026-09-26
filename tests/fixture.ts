import { emptyState } from "../src/domain/seed";
import { execute } from "../src/domain/engine";
import type { Command, State } from "../src/domain/types";
export const now = "2026-09-25T08:00:00.000Z";
let counter = 0;
export const apply = (s: State, c: Command, id = `test-${++counter}`) =>
  execute(s, c, { operationId: id, now, actor: "test-admin" });
export function fixture() {
  let s = emptyState();
  s = apply(s, {
    type: "saveHouse",
    value: {
      name: "Test House",
      number: "001",
      address: "Test Road",
      phone: "09001230000",
      subMahalId: "SM-01",
      active: true,
      joined: "2025-01-01",
      inactiveDate: "",
    },
  });
  s = apply(s, {
    type: "saveMember",
    value: {
      name: "Test Member",
      phone: "09001230001",
      dob: "1990-01-01",
      verifiedAge: 0,
      ageVerifiedOn: "",
      houseId: "H-000001",
      approved: true,
      active: true,
      joined: "2025-01-01",
      inactiveDate: "",
    },
  });
  s = apply(s, {
    type: "saveFund",
    value: {
      id: "annual",
      title: "Annual membership",
      target: "member",
      frequency: "annual",
      mode: "fixed",
      active: true,
      start: "2025-01-01",
      end: "",
      rates: [{ from: "2025-01-01", amount: 100000 }],
      dueDay: 28,
      advance: true,
      campaign: "",
      eligibleIds: [],
    },
  });
  s = apply(s, {
    type: "assess",
    payerId: "M-000001",
    fundId: "annual",
    period: "2026",
  });
  return s;
}
export const payment = (amount = 100000): Command => ({
  type: "payment",
  payerId: "M-000001",
  date: "2026-09-25",
  walletId: "cash",
  method: "Cash",
  reference: "private-reference",
  lines: [{ fundId: "annual", amount }],
});
