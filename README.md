# Mahal Accounts

A static community accounting app written in vanilla JavaScript ES modules. No React, Vue, TypeScript, npm or bundler. No build step or custom API. Firebase Auth handles the administrator login; the browser talks directly to Firestore.

Start with **[SETUP.md](SETUP.md)**. The Firebase Web configuration is in `config.js`. GitHub Pages can serve the repository root directly after you select `main` / root in Pages settings.

## Files

- `index.html`, `app.js`, `config.js`: entry point, hash router wiring and public configuration.
- `lib/`: DOM, routing, authentication, Firestore persistence, URLs, QR and browser utilities.
- `domain/`: pure accounting commands, data projections, CSV mapping, reports and backup validation.
- `pages/`: native DOM screens loaded as ES modules on demand.
- `assets/`: CSS, favicon and your logo.
- `vendor/`: pinned QR encoder/decoder with licenses and source hashes.
- `firestore.rules`, `firestore.indexes.json`: backend access rules and indexes.
- `tools/`: optional dependency-free static server, checks and recovery utility.
- `tests/`: Node built-in tests; no third-party test runner.

V1 supports houses/members, ten Sub Mahals, funds/rates, idempotent dues, partial payments/advances, four-allocation receipts, waivers/refunds/voids, wallets/cashbook, reports, public lookup/QR, A6 receipt/card printing, resumable CSV import and full JSON backups. Existing Firestore data remains compatible.

Administrator access uses Google or a configured user ID/password, always restricted to one Firebase UID. There is no member login in V1. Public field visibility is controlled in Settings.

Local server, if Node 22+ is installed: `node tools/serve.mjs 8000`. Or use Python's standard HTTP server as described in SETUP.md. Open a localhost HTTP URL, not `file://`.

Optional checks: `node tools/check.mjs`. No deployment runs automatically from this repository; hosting and Firebase setup are manual.
