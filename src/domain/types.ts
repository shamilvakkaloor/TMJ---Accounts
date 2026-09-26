export type PayerType = "member" | "house";
export type Frequency = "annual" | "monthly" | "one_time";
export interface Entity {
  id: string;
}
export interface Settings extends Entity {
  name: string;
  address: string;
  contact: string;
  timezone: string;
  logo: string;
  publicPhone: boolean;
  publicAddress: boolean;
  publicHistory: boolean;
  cutover: string;
  lastBackup: string;
  schemaVersion: 1;
}
export interface SubMahal extends Entity {
  name: string;
  order: number;
  active: boolean;
}
export interface History {
  date: string;
  value: string;
}
export interface House extends Entity {
  name: string;
  number: string;
  address: string;
  phone: string;
  subMahalId: string;
  active: boolean;
  joined: string;
  inactiveDate: string;
  subHistory: History[];
}
export interface Member extends Entity {
  name: string;
  phone: string;
  dob: string;
  verifiedAge: number;
  ageVerifiedOn: string;
  houseId: string;
  approved: boolean;
  active: boolean;
  joined: string;
  inactiveDate: string;
  houseHistory: History[];
}
export interface Rate {
  from: string;
  amount: number;
}
export interface Fund extends Entity {
  title: string;
  target: PayerType;
  frequency: Frequency;
  mode: "fixed" | "voluntary";
  active: boolean;
  start: string;
  end: string;
  rates: Rate[];
  dueDay: number;
  advance: boolean;
  campaign: string;
  eligibleIds: string[];
}
export interface Due extends Entity {
  payerId: string;
  payerType: PayerType;
  fundId: string;
  fundTitle: string;
  period: string;
  assessed: number;
  waived: number;
  paid: number;
  dueDate: string;
  rateFrom: string;
  lastOperation: string;
}
export interface Credit extends Entity {
  payerId: string;
  fundId: string;
  receiptId: string;
  amount: number;
  period: string;
  lastOperation: string;
}
export interface ReceiptLine {
  fundId: string;
  fundTitle: string;
  period: string;
  dueId: string;
  creditId: string;
  amount: number;
}
export interface Receipt extends Entity {
  number: string;
  payerId: string;
  payerType: PayerType;
  payerName: string;
  houseId: string;
  houseName: string;
  subMahalId: string;
  subMahalName: string;
  date: string;
  postedAt: string;
  walletId: string;
  method: string;
  reference: string;
  lines: ReceiptLine[];
  total: number;
  outstandingAfter: number | null;
  advanceAfter: number | null;
  historical: boolean;
  legacyNumber: string;
  operationId: string;
}
export interface ReceiptState extends Entity {
  refunded: number;
  voided: boolean;
  allocations: ReceiptLine[];
  allocationMap: Record<string, ReceiptLine>;
  lastOperation: string;
}
export interface Wallet extends Entity {
  name: string;
  type: "cash" | "bank";
  active: boolean;
  balance: number;
  lastOperation: string;
}
export interface Ledger extends Entity {
  date: string;
  walletId: string;
  amount: number;
  kind:
    | "collection"
    | "income"
    | "expense"
    | "transfer"
    | "opening"
    | "refund"
    | "reversal";
  category: string;
  party: string;
  description: string;
  reference: string;
  receiptId: string;
  operationId: string;
}
export interface Adjustment {
  id: string;
  type: "due" | "credit";
  before: number;
  after: number;
  field: "paid" | "waived" | "amount";
  delta: number;
}
export interface Operation extends Entity {
  kind: string;
  date: string;
  createdAt: string;
  actor: string;
  description: string;
  reason: string;
  receiptId: string;
  amount: number;
  adjustments: Adjustment[];
  balanceChanges: Record<string, Adjustment>;
  ledgerIds: string[];
  fundAmounts: { fundId: string; amount: number }[];
}
export interface ImportJob extends Entity {
  kind: string;
  fileName: string;
  completed: string[];
  errors: string[];
  createdAt: string;
  status: string;
  payerIds?: string[];
}
export interface State {
  settings: Settings[];
  subMahals: SubMahal[];
  houses: House[];
  members: Member[];
  funds: Fund[];
  dues: Due[];
  credits: Credit[];
  receipts: Receipt[];
  receiptStates: ReceiptState[];
  wallets: Wallet[];
  ledger: Ledger[];
  operations: Operation[];
  importJobs: ImportJob[];
  sequences: { id: string; value: number }[];
}
export type Collection = keyof State;
export const collections: Collection[] = [
  "settings",
  "subMahals",
  "houses",
  "members",
  "funds",
  "dues",
  "credits",
  "receipts",
  "receiptStates",
  "wallets",
  "ledger",
  "operations",
  "importJobs",
  "sequences",
];
export type Command =
  | {
      type: "saveHouse";
      value: Omit<House, "id" | "subHistory"> & {
        id?: string;
        effectiveDate?: string;
      };
    }
  | {
      type: "saveMember";
      value: Omit<Member, "id" | "houseHistory"> & {
        id?: string;
        effectiveDate?: string;
      };
    }
  | { type: "saveFund"; value: Fund }
  | { type: "saveSettings"; value: Settings }
  | { type: "saveSubMahal"; value: SubMahal }
  | { type: "saveWallet"; value: Omit<Wallet, "balance" | "lastOperation"> }
  | {
      type: "assess";
      payerId: string;
      fundId: string;
      period: string;
      assessed?: number;
    }
  | {
      type: "payment";
      payerId: string;
      date: string;
      walletId: string;
      method: string;
      reference: string;
      lines: { fundId: string; amount: number; dueId?: string }[];
      historical?: boolean;
      legacyNumber?: string;
    }
  | { type: "waive"; dueId: string; amount: number; reason: string }
  | { type: "restoreWaiver"; dueId: string; amount: number; reason: string }
  | { type: "applyCredit"; creditId: string; dueId: string; amount: number }
  | {
      type: "refund";
      receiptId: string;
      amount: number;
      walletId: string;
      date: string;
      reason: string;
    }
  | { type: "void"; receiptId: string; date: string; reason: string }
  | {
      type: "cashbook";
      kind: "income" | "expense" | "opening" | "transfer";
      walletId: string;
      toWalletId?: string;
      amount: number;
      date: string;
      category: string;
      party: string;
      description: string;
      reference: string;
    }
  | { type: "saveImportJob"; value: ImportJob };
export interface Context {
  operationId: string;
  now: string;
  actor: string;
}
