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

## Custom house IDs — 28 September 2026

50 tests pass. Added coverage for `H-TMJBDR002` CSV import/update, member links, receipt snapshots, backup validation and subsequent automatic numeric IDs. Browser CSV import and Firestore emulator create/update/publication passed with this ID. No test records were written to the live database.

## Large house import — 28 September 2026

A 536-house demo import completed in 108 atomic groups and about 1.9 seconds in the local browser; a repeat validation/import skipped all 536. One five-house group spanning distinct Sub Mahals passed Firestore emulator rules and published all houses. Existing per-row import markers remain recognized for resuming an earlier upload. The live Firestore network may take longer than the local demo.

## Optional member details — 28 September 2026

54 automated tests pass, including minimal member imports, blank age/joining information, pending approval, later approval, care-of preservation, privacy and backup validation.

## Chrome app installation — 28 September 2026

Added a relative-scope web app manifest, 192/512 PNG icons derived from the existing logo, standalone launch at the administrator route and install controls. Chromium reported no manifest or installability errors at the repository-prefixed local URL; the install guidance opened correctly. All 54 existing tests pass.

## Four-column member CSV and custom IDs — 29 September 2026

55 tests pass. Browser testing uploaded exactly id/name/houseId/care of from the default import screen, automatically selected members, imported custom/numeric/mixed-case IDs with missing optional fields, and skipped all rows on repeat. The numeric member sequence is unchanged by custom IDs.

## Large member import — 29 September 2026

56 automated tests pass. A browser test with 1,357 four-column members resumed five legacy per-row imports, added 1,352 in 271 groups with zero errors, then skipped all 1,357 on repeat. The local demo import took about 9.8 seconds; this is not a live-network timing claim. Firestore emulator tests passed for atomic five-house and five-member write batches with distinct parents, and rejected stale revisions, repeated operations and anonymous writes without partial records. Live rules were compared before publishing to preserve existing custom ID changes. No test records were written to the live database.

## Startup performance — 29 September 2026

62 automated tests pass, including revision-checked cache reuse, stale/incomplete/unavailable cache fallback, force refresh, denied/offline server checks and concurrent-write retries. A Chromium test against the local Firestore emulator loaded 1,357 members and 536 houses: the old loader made 21 collection queries; the new cold loader made 14 collection queries; repeat opening made one server revision read and no collection queries. Measured local opens were about 2.0 seconds old, 1.7 seconds cold and 0.7 seconds cached; these are emulator timings, not production-network guarantees. Browser checks verified all records, direct-console-style changes through forced refresh, sign-out cache removal and no page errors. No live records were changed.

## Designed ID cards and household rosters — 29 September 2026

65 automated tests pass. Chromium generated member and two-page house PNG/PDF exports using local fictional records, decoded every QR, opened a house profile by uploading its exported PNG to the public scanner, followed member/house links, checked the administrator household dialog and verified the card layout at 390px width. Poppler rendered both PDF types for visual review, including Malayalam and long names; page size is 85.6 × 54 mm. Browser print output has one member page and two household pages, with no extra blank pages. The standalone PDF writer has byte-offset checks. Firestore emulator tests loaded 205 anonymous public household members across three pages, excluded other houses and outdated privacy versions, and rejected private-record and unversioned queries. The live composite index reached READY, and a read-only anonymous query succeeded. No live member/house records were modified by tests.

## Bulk ID cards — 29 September 2026

67 automated tests pass. Added combined-filter and 205-record PDF partition coverage, including deduplication and household continuation pages. Browser checks verified sidebar routing, selection across pages, filter-change selection clearing, approval/occupancy filters, invalid date ranges, three PDF parts for 205 records, cancellation without partial download, a five-page PDF export and mobile overflow. Poppler confirmed the exported page count and 85.6 × 54 mm page size; the rendered output was visually reviewed. All test records stayed in local demo storage.
