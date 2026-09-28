# Conversion verification — 28 September 2026

The vanilla JavaScript conversion preserves the V1 data schema and accounting engine. Production configuration remains `demo: false` and `emulators: false`. No live database data, Auth providers, IAM policy or Pages hosting settings were changed during this conversion.

## Automated checks

- `node tools/check.mjs`: native module syntax/import validation and **37 passing tests**, using only Node built-ins. Coverage includes accounting invariants, backup validation, data publication, CSV strings/escaping, fixed password encoding, hash routes and QR generation/decoding.
- Browser checks on a plain static server under `/TMJ---Accounts/`: every administrator route, partial payment, refund, receipt reload, real QR destinations, one-page A6 receipt, Malayalam registration, repeated CSV import without duplication, full JSON backup, public lookup/profile reload, ID-card QR/one-page print, mobile layout/navigation, asset paths and rejection of unsupported clean URLs. No uncaught browser errors.
- Additional browser forms: fund creation, repeat-safe assessment generation, waiver, expense, transfer, report CSV, settings and public phone-visibility changes.
- Real-config read-only browser check: unsigned admin routes redirect to the login screen with Google and user-ID/password options. No live account credentials were entered.
- Local Firebase Auth + Firestore integration: initial workspace, house/member/fund creation, assessment, linking a four-character password with the fixed suffix, signing out/in with the user ID, posting a payment through the native Firestore transaction, reloading persisted state, anonymous private-read denial and public receipt access.
- Auth emulator Google popup flow: linking Google to the existing password account preserves the administrator UID; both Google and password sign-in work; a different Google account is rejected and signed out with a visible error.
- Dependency-free recovery utility: restored and verified **279 documents** from the browser backup into a separate local emulator project. Simulated a connection failure after the first 200-document batch, resumed successfully, verified every document and refused a repeat after completion.

Desktop and mobile screenshots were visually reviewed. Physical camera/printer hardware and Google's real OAuth consent flow were not exercised. The live Google provider/account linking, rules/UID confirmation and branch-based Pages publishing remain the owner's setup steps in SETUP.md.

The old React/Vite build, package manifests and deployment workflow were removed. The remaining GitHub workflow runs JavaScript checks only and has no deployment or Firebase credentials. Browser-test screenshots, PDFs and local tool dependencies are ignored development artifacts, not app requirements. A dependency-free manual browser checklist is in `tests/BROWSER_CHECKLIST.md`.

## Sub Mahal and house CSV update — 28 September 2026

Preserved the user's GitHub increase to 25 and incorporated their live Firestore deletion rules. 47 automated tests pass, including ID allocation, deletion/history protection, backup roundtrip, date parsing and pre-cutover house registration. Browser checks passed for add/delete, blocked used-record deletion, CSV ID download, day-first CSV validation/import, invalid-date messages and date-order changes. Firestore emulator checks passed for 25 records, audited deletion, reload and rejection of unaudited, wrong-target and anonymous deletes. Test records were confined to local demo/emulator storage.
