# Mahal Accounts

A working React + TypeScript application for one Central Mahal and ten Sub Mahals, built from the V1 architecture supplied on 25 September 2026.

The frontend is configured for **GitHub Pages**. **Cloud Firestore** stores the records; **Firebase Authentication** secures the single administrator login. Firebase Hosting is not used.

## Run locally

Requires Node.js 22 or newer.

```powershell
npm ci
npm run dev
```

Open [Administration](http://127.0.0.1:5173/#/admin) or the [public portal](http://127.0.0.1:5173/). Without Firebase environment variables, the app starts with fictional Noor Mahal records. Demo edits are saved in this browser only. Settings has a reset action. No login is needed for the demo. Production release requires a complete Firebase configuration and does not silently publish the demo.

For your real Mahal, follow [SETUP.md](SETUP.md). A new Firebase workspace starts empty, with ten unnamed Sub Mahals and two zero-balance wallets. It does not copy the demo people or example fund charges.

## Included

- Responsive dashboard, member and house registration, permanent sequential IDs, effective-dated house/Sub Mahal moves, admin eligibility approval, and QR ID cards.
- Fixed or voluntary member/house funds; annual, monthly and one-time periods; retained rate history; assessment preview and resumable generation; waivers and restoring waivers.
- Same-payer payments across funds, partial payments, annual member advances, cash change preview, immutable receipts, refunds and voids. Amounts use integer paise.
- Central cash/bank wallets, opening balances, general income, expenditure and linked transfers; wallet reconciliation and an immutable activity log.
- Public prefix search, member/house profiles, dues, advances, receipt verification and camera QR scanning with manual search fallback. Phone, address and financial-history publication can be switched off.
- A6 receipts, 85.6 × 54 mm cards, printable reports and CSV exports with formula escaping.
- CSV templates, field mapping, validation, explicit confirmation, duplicate protection, resumable rows and downloadable manifests. Complete JSON backup, browser-demo restore and a verified Firebase recovery script.
- Firestore authorization rules, indexes, automated checks and a GitHub release workflow that deploys rules/indexes before the frontend on GitHub Pages.

## Accounting choices used for this build

The user authorized building after the planning review without changing its proposed defaults. These are implemented defaults, not a claim that real fund prices or organizational policies have been supplied.

| Topic                | Behavior                                                                                                                                                                                                                               |
| -------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Currency and periods | INR; calendar-year periods; initial reporting timezone Asia/Kolkata.                                                                                                                                                                   |
| Joining              | Full annual charge in the joining year; monthly eligibility at the start of a month; no proration. Approved members must be verified as at least 21 at joining.                                                                        |
| Inactivation         | Stops new assessments for periods beginning on/after the inactive date. Earlier arrears remain.                                                                                                                                        |
| Allocation           | Oldest assessed dues within the selected fund first, unless a due is explicitly selected. One receipt belongs to one house or one member.                                                                                              |
| Advances             | Enabled only for configured annual fixed member funds. Unallocated excess stays linked to its original receipt, payer and fund for next-year-or-later allocation. No second cash inflow when applied.                                  |
| Other fixed funds    | Reject an amount above assessed dues. Enter the actual collection and return cash change, or assess the intended period first.                                                                                                         |
| Refunds              | Unused credit is returned first; reversed paid allocations reopen dues. Forgiving a debt is a separate waiver. A subsequent void reverses only the amount not already refunded.                                                        |
| Rate changes         | Existing assessments retain their rate/amount snapshot. Used funds preserve old rates and accept new future rates.                                                                                                                     |
| Historical imports   | Pre-cutover receipts are statement-only. Opening wallets and outstanding historical dues are imported separately, preventing duplicate cash.                                                                                           |
| Attribution          | Receipt snapshots use member/house history at the actual payment date. Numbering uses the posting year in the configured timezone.                                                                                                     |
| Public information   | Names, identifiers and house links are public. Phone, address and financial history default to published as requested in the architecture; DOB, eligibility evidence, bank references, private reasons and audit records stay private. |

## Boundaries to know

One receipt supports **four fund/period allocations**. A payment spanning four monthly periods uses all four. The limit also applies to the receipt's current allocations when credit is partially moved to another period. Split a larger collection into separate receipts. The four-allocation posting and full reversal are tested against Firestore's rule limits.

This is a single-admin cashbook with a dues subledger. It does not provide double-entry statements, online payments, scheduled dues, server functions, attachment storage, translations of the interface, or collector/member login roles. Malayalam record values are supported. General income/expense categories are free text.

The admin session initially loads private records in pages of 250 and retains them in memory for reports. Most screens paginate their display; reports and exports use the loaded snapshot. A revision check rejects stale writes from other tabs. This is suitable for testing a small workspace, but **large-register capacity and Spark quota use have not been established** because expected record counts were not supplied. Measure using representative data before a large migration. Public searches fetch at most 20 matches and public history is fetched in pages of 100.

Live financial operations require a connection. Keep an uncertain payment form open and retry it; it retains its operation ID. If the browser was closed after an uncertain submission, inspect Receipts before posting again. Changes to publication settings may require **Settings → Refresh public profiles** if the refresh is interrupted.

## Development

```powershell
npm run check          # TypeScript, production build and domain tests
npm run test:rules     # Firestore emulator; requires Java 21
npm run test:restore   # Empty-project recovery verification in the emulator
npx playwright install chromium
npm run test:e2e       # Browser workflows and print geometry
npm run test:pages     # Production build under a repository path; no SPA rewrites
```

Do not point browser tests at a real Firebase project: they run against the local demo. Emulator rule tests use project `demo-mahal` and substitute a test UID in memory. Expected permission-denied logs are negative-test assertions.

The checked-in test suites cover accounting and backup invariants, Firestore authorization and atomic financial writes, registration/import/backup flows, public/mobile views, and actual PDF page dimensions. Live Firebase deployment, real camera hardware and a physical printer still need environment-specific checks.

## Code map

| Location                 | Purpose                                                                    |
| ------------------------ | -------------------------------------------------------------------------- |
| `src/domain/engine.ts`   | Pure commands, allocations, eligibility, reversals and invariants.         |
| `src/domain/backup.ts`   | Backup relationships, balances and sequence validation.                    |
| `src/data/repository.ts` | Demo storage, bounded Firestore commits, revision checks and public reads. |
| `src/data/projection.ts` | Explicit public-field projections and uniqueness markers.                  |
| `src/pages/`             | Administration, public portal and print views.                             |
| `firestore.rules`        | Sole-admin authorization; financial assertions and public schemas.         |
| `scripts/restore.ts`     | Validate and restore a complete backup into an empty recovery project.     |
| `.github/workflows/`     | Automated tests and Firebase release.                                      |

The implementation embeds rate/history arrays in fund/identity documents and receipt lines in immutable receipts. Current settlement allocations live in `receiptStates`; `operations` holds audit and compensating events. `balanceChanges` and `allocationMap` duplicate bounded lists as indexed maps to keep rule evaluation within limits. Wallet balance caches are updated atomically with the immutable ledger and checked during backup validation. `receiptNumbers` and `openingEntries` enforce unique receipt numbers and one opening entry per wallet.

See [BUILD_PLAN.md](BUILD_PLAN.md) for the original planning review and [SETUP.md](SETUP.md) for configuration, migration, recovery and deployment.
