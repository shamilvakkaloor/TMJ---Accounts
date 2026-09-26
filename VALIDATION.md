# Build verification — 25 September 2026

Hosting update, 26 September 2026: production build and all 33 domain/URL tests passed after switching to hash routing. All five existing browser workflows passed. An additional browser test passed against a plain static server under `/mahal-pages-test/`, checking refreshed admin/profile/receipt links, QR destinations, repository-prefixed assets and absence of server route rewrites. GitHub Pages publishing requires the selected Firebase configuration and deployment access; it is not a demo fallback.

The local production build and TypeScript checks passed.

| Verification | Result |
|---|---|
| Domain/accounting and backup tests | 29 passed |
| Firestore Emulator rules tests | 15 passed |
| Chromium browser workflows | 5 passed |
| Empty-project recovery smoke test | Passed: 260 authoritative/derived documents matched the backup; two recovery metadata documents also verified |
| Repeated completed restore | Refused as intended |

Browser coverage includes navigation, payment/refund, Malayalam registration, repeat CSV import without duplication, JSON backup download, public lookup, mobile overflow/navigation, saved assessment recovery through advance application, four-line receipt printing and ID-card printing.

The receipt PDF was checked for one page and actual A6 dimensions (105 × 148 mm), including a Malayalam payer name and four fund lines. The ID card PDF was checked for a single page. Desktop/mobile screenshots and print previews were visually inspected. Test artifacts are regenerated under the ignored `test-results/` folder.

Firestore coverage includes first-run initialization, house/member registration, privacy changes, the sole-admin allowlist, private-read denial, immutable receipts, partial payments, advances and credit application, waivers/restoration, refunds/voids, transfer conservation, opening balance, four-allocation reversal, and rejection of missing public/wallet updates or malformed financial writes. Expected permission-denied messages in negative tests are normal.

The existing `tmj---accounts` backend was connected on 26 September 2026. The supplied administrator UID is enabled for password authentication, the GitHub Pages domain is authorized, Firestore rules have been deployed from GitHub using Workload Identity Federation, and all seven indexes are ready. Anonymous public-settings reads succeed while private-settings reads are denied. The live database was initialized with configuration and zero-balance wallets only; no demo or financial records were added.

Not exercised against a live environment: signing in with the administrator's password, physical camera and printer hardware, or large-register/free-quota capacity. These require the organization's credentials, equipment and representative data. See SETUP.md. The GitHub Actions deployment history records frontend release status.
