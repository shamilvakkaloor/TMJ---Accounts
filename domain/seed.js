import { execute } from "./engine.js";
export function emptyState() {
  return {
    settings: [
      {
        id: "mahal",
        name: "Mahal Accounts",
        address: "Community administration",
        contact: "",
        timezone: "Asia/Kolkata",
        logo: "",
        publicPhone: true,
        publicAddress: true,
        publicHistory: true,
        cutover: "2026-01-01",
        lastBackup: "",
        schemaVersion: 1,
      },
    ],
    subMahals: Array.from({ length: 10 }, (_, i) => ({
      id: `SM-${String(i + 1).padStart(2, "0")}`,
      name: `Sub Mahal ${i + 1}`,
      order: i + 1,
      active: true,
    })),
    houses: [],
    members: [],
    funds: [],
    dues: [],
    credits: [],
    receipts: [],
    receiptStates: [],
    wallets: [
      {
        id: "cash",
        name: "Cash in hand",
        type: "cash",
        active: true,
        balance: 0,
        lastOperation: "bootstrap",
      },
      {
        id: "bank",
        name: "Main bank account",
        type: "bank",
        active: true,
        balance: 0,
        lastOperation: "bootstrap",
      },
    ],
    ledger: [],
    operations: [],
    importJobs: [],
    sequences: [],
  };
}
export function demoState(now = "2026-09-25T12:00:00.000Z") {
  let s = emptyState();
  const year = now.slice(0, 4);
  const month = now.slice(0, 7);
  const end = now.slice(0, 10);
  s.settings[0] = {
    ...s.settings[0],
    name: "Noor Mahal",
    address: "Community Road, Malappuram, Kerala",
    contact: "+91 00000 00000",
    cutover: year + "-01-01",
  };
  const subs = [
    "Town Centre",
    "Riverside",
    "East Garden",
    "Pallippadi",
    "North Valley",
    "West Hill",
    "Green Park",
    "Kottappuram",
    "South Gate",
    "Meadow Lane",
  ];
  s.subMahals.forEach((m, i) => (m.name = subs[i]));
  let n = 0;
  const run = (c) => {
    s = execute(s, c, { operationId: `demo-${++n}`, now, actor: "demo-admin" });
  };
  const names = [
    "Abdul Rahman",
    "Muhammed Faisal",
    "Ibrahim Kutty",
    "Ashraf Ali",
    "Usman Koya",
    "Hameed Hassan",
    "Nazeer Ahmed",
    "Shihab Rahman",
    "Musthafa K",
    "Rasheed Ali",
    "Sulaiman P",
    "Basheer K",
  ];
  const houses = [
    "Rose Villa",
    "Nila House",
    "Green View",
    "Al Noor",
    "Palm Grove",
    "Safa Manzil",
    "Olive House",
    "River Cottage",
    "Thanal",
    "Crescent House",
    "Misty Hills",
    "Ameen Villa",
  ];
  houses.forEach((name, i) =>
    run({
      type: "saveHouse",
      value: {
        name,
        number: `${i + 1}/A`,
        address: `${i + 1} Community Lane`,
        phone: "900000" + String(i).padStart(4, "0"),
        subMahalId: s.subMahals[i % 10].id,
        active: true,
        joined: year + "-01-01",
        inactiveDate: "",
      },
    }),
  );
  names.forEach((name, i) =>
    run({
      type: "saveMember",
      value: {
        name,
        phone: "900001" + String(i).padStart(4, "0"),
        dob: `${1975 + i}-06-12`,
        verifiedAge: 0,
        ageVerifiedOn: "",
        houseId: s.houses[i].id,
        approved: true,
        active: true,
        joined: year + "-01-01",
        inactiveDate: "",
      },
    }),
  );
  run({
    type: "saveFund",
    value: {
      id: "membership",
      title: "Annual membership",
      target: "member",
      frequency: "annual",
      mode: "fixed",
      active: true,
      start: year + "-01-01",
      end: "",
      rates: [{ from: year + "-01-01", amount: 100000 }],
      dueDay: 28,
      advance: true,
      campaign: "",
      eligibleIds: [],
    },
  });
  run({
    type: "saveFund",
    value: {
      id: "mess",
      title: "Monthly mess fund",
      target: "house",
      frequency: "monthly",
      mode: "fixed",
      active: true,
      start: year + "-01-01",
      end: "",
      rates: [{ from: year + "-01-01", amount: 30000 }],
      dueDay: 10,
      advance: false,
      campaign: "",
      eligibleIds: [],
    },
  });
  run({
    type: "saveFund",
    value: {
      id: "donation",
      title: "Community donation",
      target: "member",
      frequency: "one_time",
      mode: "voluntary",
      active: true,
      start: year + "-01-01",
      end: "",
      rates: [],
      dueDay: 1,
      advance: false,
      campaign: "community",
      eligibleIds: s.members.map((m) => m.id),
    },
  });
  s.members.forEach((m) =>
    run({ type: "assess", payerId: m.id, fundId: "membership", period: year }),
  );
  s.houses.forEach((h) =>
    run({ type: "assess", payerId: h.id, fundId: "mess", period: month }),
  );
  run({
    type: "cashbook",
    kind: "opening",
    walletId: "bank",
    amount: 1200000,
    date: year + "-01-01",
    category: "Opening balance",
    party: "",
    description: "Opening bank balance",
    reference: "",
  });
  for (let i = 0; i < 8; i++)
    run({
      type: "payment",
      payerId: s.members[i].id,
      date: end,
      walletId: i % 2 ? "bank" : "cash",
      method: i % 2 ? "Bank transfer" : "Cash",
      reference: "",
      lines: [
        {
          fundId: "membership",
          amount: i === 2 ? 50000 : i === 0 ? 150000 : 100000,
        },
      ],
    });
  for (let i = 0; i < 6; i++)
    run({
      type: "payment",
      payerId: s.houses[i].id,
      date: end,
      walletId: "cash",
      method: "Cash",
      reference: "",
      lines: [{ fundId: "mess", amount: 30000 }],
    });
  run({
    type: "cashbook",
    kind: "expense",
    walletId: "bank",
    amount: 125000,
    date: end,
    category: "Maintenance",
    party: "Local maintenance",
    description: "Community hall maintenance",
    reference: "",
  });
  run({
    type: "cashbook",
    kind: "income",
    walletId: "bank",
    amount: 350000,
    date: end,
    category: "Rent",
    party: "Community hall",
    description: "Hall rental collection",
    reference: "",
  });
  return s;
}
