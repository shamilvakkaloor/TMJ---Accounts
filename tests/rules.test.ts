import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import {
  initializeTestEnvironment,
  assertFails,
  assertSucceeds,
} from "@firebase/rules-unit-testing";
import type { RulesTestEnvironment } from "@firebase/rules-unit-testing";
import {
  collection,
  doc,
  getDoc,
  getDocs,
  limit,
  query,
  setDoc,
  updateDoc,
  where,
  writeBatch,
} from "firebase/firestore";
import { readFileSync } from "node:fs";
import { changes, documents } from "../src/data/projection";
import { apply, fixture, payment } from "./fixture";
import { emptyState } from "../src/domain/seed";
import type { Command, State } from "../src/domain/types";
let env: RulesTestEnvironment;
let state: State;
let revision = 0;
let seq = 0;
beforeAll(async () => {
  env = await initializeTestEnvironment({
    projectId: "demo-mahal",
    firestore: {
      rules: readFileSync("firestore.rules", "utf8").replace(
        /request\.auth\.uid == ['"][^'"]*['"]/,
        "request.auth.uid == 'test-admin'",
      ),
      host: "127.0.0.1",
      port: 8080,
    },
  });
}, 30000);
afterAll(async () => {
  await env?.cleanup();
});
beforeEach(async () => {
  await env.clearFirestore();
  state = fixture();
  revision = 0;
  await env.withSecurityRulesDisabled(async (context) => {
    const batch = writeBatch(context.firestore());
    for (const [p, v] of Object.entries(documents(state)))
      batch.set(doc(context.firestore(), p), v);
    batch.set(doc(context.firestore(), "meta/revision"), {
      value: 0,
      lastOperation: "seed",
    });
    await batch.commit();
  });
});
async function post(
  c: Command,
  tamper?: (patch: [string, Record<string, unknown>][], next: State) => void,
) {
  const id = `rules-${++seq}`;
  const next = apply(state, c, id);
  const patch = changes(documents(state), documents(next));
  tamper?.(patch, next);
  const db = env.authenticatedContext("test-admin").firestore();
  const batch = writeBatch(db);
  for (const [p, v] of patch) batch.set(doc(db, p), v);
  batch.update(doc(db, "meta/revision"), {
    value: revision + 1,
    lastOperation: id,
  });
  await batch.commit();
  state = next;
  revision++;
  return id;
}
describe("Firestore permissions and financial assertions", () => {
  it("initializes an empty project through the admin rules", async () => {
    await env.clearFirestore();
    const db = env.authenticatedContext("test-admin").firestore();
    const batch = writeBatch(db);
    for (const [p, v] of Object.entries(documents(emptyState())))
      batch.set(doc(db, p), v);
    batch.set(doc(db, "meta/revision"), {
      value: 0,
      lastOperation: "bootstrap",
    });
    await assertSucceeds(batch.commit());
    expect((await getDocs(collection(db, "subMahals"))).size).toBe(10);
  });
  it("registers a house and member and retains private eligibility", async () => {
    await post({
      type: "saveHouse",
      value: { ...state.houses[0], id: undefined, name: "New House" },
    });
    await post({
      type: "saveMember",
      value: {
        ...state.members[0],
        id: undefined,
        houseId: "H-000002",
        name: "New Member",
      },
    });
    const db = env.unauthenticatedContext().firestore();
    const record = (await getDoc(doc(db, "publicMembers/M-000002"))).data();
    expect(record?.houseId).toBe("H-000002");
    expect(record).not.toHaveProperty("dob");
  });
  it("publishes privacy changes and denies financial history when hidden", async () => {
    await post({
      type: "saveSettings",
      value: {
        ...state.settings[0],
        publicPhone: false,
        publicAddress: false,
        publicHistory: false,
      },
    });
    const db = env.unauthenticatedContext().firestore();
    expect(
      (await getDoc(doc(db, "publicMembers/M-000001"))).data()?.phone,
    ).toBe("");
    expect(
      (await getDoc(doc(db, "publicHouses/H-000001"))).data()?.address,
    ).toBe("");
    await assertFails(getDoc(doc(db, "publicDues/M-000001_annual_2026")));
  });
  it("posts a single opening balance and rejects a missing wallet update", async () => {
    await post({
      type: "cashbook",
      kind: "opening",
      walletId: "bank",
      amount: 50000,
      date: "2026-01-01",
      category: "Opening",
      party: "",
      description: "Opening bank",
      reference: "",
    });
    const db = env.authenticatedContext("test-admin").firestore();
    expect((await getDoc(doc(db, "wallets/bank"))).data()?.balance).toBe(50000);
    await assertFails(
      post(payment(40000), (patch) => {
        const i = patch.findIndex(([p]) => p === "wallets/cash");
        patch.splice(i, 1);
      }),
    );
  });
  it("allows public bounded search but denies private identity and expense reads", async () => {
    const db = env.unauthenticatedContext().firestore();
    await assertSucceeds(getDoc(doc(db, "publicMembers/M-000001")));
    await assertSucceeds(
      getDocs(
        query(
          collection(db, "publicMembers"),
          where("version", "==", "111"),
          limit(20),
        ),
      ),
    );
    await assertFails(getDoc(doc(db, "members/M-000001")));
    await assertFails(getDocs(collection(db, "ledger")));
    await assertFails(
      getDocs(
        query(collection(db, "publicMembers"), where("version", "==", "111")),
      ),
    );
  });
  it("denies public and unrelated authenticated writes", async () => {
    for (const context of [
      env.unauthenticatedContext(),
      env.authenticatedContext("someone-else"),
    ]) {
      await assertFails(
        setDoc(doc(context.firestore(), "wallets/hacked"), {
          id: "hacked",
          name: "Hacked",
          type: "cash",
          active: true,
        }),
      );
      await assertFails(getDocs(collection(context.firestore(), "operations")));
    }
  });
  it("posts an atomic partial payment and immutable receipt", async () => {
    const id = await post(payment(40000));
    const db = env.authenticatedContext("test-admin").firestore();
    await assertFails(updateDoc(doc(db, "receipts", id), { total: 1 }));
    expect(
      (await getDoc(doc(db, "dues/M-000001_annual_2026"))).data()?.paid,
    ).toBe(40000);
  });
  it("accepts next-year credit and a cash-neutral credit application", async () => {
    await post(payment(140000));
    await post({
      type: "assess",
      payerId: "M-000001",
      fundId: "annual",
      period: "2027",
    });
    await post({
      type: "applyCredit",
      creditId: state.credits[0].id,
      dueId: state.dues[1].id,
      amount: 40000,
    });
  });
  it("accepts waiver, restoring waiver, refund, and remaining void", async () => {
    await post({
      type: "waive",
      dueId: state.dues[0].id,
      amount: 10000,
      reason: "Exemption",
    });
    await post({
      type: "restoreWaiver",
      dueId: state.dues[0].id,
      amount: 10000,
      reason: "Correction",
    });
    const id = await post(payment());
    await post({
      type: "refund",
      receiptId: id,
      amount: 25000,
      date: "2026-09-25",
      walletId: "cash",
      reason: "Refund request",
    });
    await post({
      type: "void",
      receiptId: id,
      date: "2026-09-25",
      reason: "Incorrect receipt",
    });
  });
  it("requires public due synchronization", async () => {
    await assertFails(
      post(payment(), (patch) => {
        const i = patch.findIndex(([p]) => p.startsWith("publicDues/"));
        patch.splice(i, 1);
      }),
    );
  });
  it("rejects an unbalanced cash inflow", async () => {
    await assertFails(
      post(payment(), (patch) => {
        const row = patch.find(([p]) => p.startsWith("ledger/"))!;
        row[1] = { ...row[1], amount: 500000 };
      }),
    );
  });
  it("rejects private fields added to public documents", async () => {
    const db = env.authenticatedContext("test-admin").firestore();
    await assertFails(
      updateDoc(doc(db, "publicMembers/M-000001"), { dob: "1990-01-01" }),
    );
  });
  it("rejects direct due and ledger edits outside an operation", async () => {
    const db = env.authenticatedContext("test-admin").firestore();
    await assertFails(
      updateDoc(doc(db, "dues/M-000001_annual_2026"), { paid: 100000 }),
    );
    await assertFails(
      setDoc(doc(db, "ledger/forged"), {
        id: "forged",
        amount: 100000,
        walletId: "cash",
      }),
    );
  });
  it("accepts equal and opposite wallet transfer entries", async () => {
    await post(payment());
    await post({
      type: "cashbook",
      kind: "transfer",
      walletId: "cash",
      toWalletId: "bank",
      amount: 30000,
      date: "2026-09-25",
      category: "Transfer",
      party: "",
      description: "Deposit to bank",
      reference: "",
    });
  });
  it("posts four allocations and reverses all four within rule limits", async () => {
    await post({
      type: "saveFund",
      value: {
        ...state.funds[0],
        id: "monthly",
        frequency: "monthly",
        advance: false,
        rates: [{ from: "2025-01-01", amount: 1000 }],
      },
    });
    for (let i = 1; i <= 4; i++)
      await post({
        type: "assess",
        payerId: "M-000001",
        fundId: "monthly",
        period: `2026-0${i}`,
      });
    const id = await post({
      type: "payment",
      payerId: "M-000001",
      date: "2026-09-25",
      walletId: "cash",
      method: "Cash",
      reference: "",
      lines: [{ fundId: "monthly", amount: 4000 }],
    });
    await post({
      type: "void",
      receiptId: id,
      date: "2026-09-25",
      reason: "Reverse four periods",
    });
  });
});
