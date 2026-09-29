# Mahal Accounts — setup (vanilla JavaScript V1)

The application is ready as ordinary static files. There is **no React, TypeScript, npm install, bundler or build command**. The browser loads ES modules, Firebase Auth and Firestore directly. There is no custom API server. V1 has administrator-only access; members use the public lookup/QR portal without signing in.

The conversion preserves the existing Firestore collections and accounting rules. It does not require a data migration. Hosting and Firebase changes are left for you to perform using this guide.

## 1. Public configuration

Edit `config.js` in the project root. It already contains the Firebase Web configuration you supplied for `tmj---accounts` and the configured password and Google administrator identities.

- `firebase`: Web app configuration from Firebase Console → Project settings → Your apps.
- `adminUid`: password administrator UID.
- `additionalAdminUids`: explicitly authorized Google administrator UID(s). Both lists must match the `admin()` allowlist in `firestore.rules`.
- `login.userId`: the administrator's user ID, initially `admin`.
- `login.emailDomain`: domain used to turn a user ID into a synthetic Firebase email.
- `login.emailOverride`: optional existing Firebase email address, instead of a synthetic email.
- `login.passwordSuffix`: empty for the existing password account, so the entered password is sent unchanged.
- `demo`: keep **false** for the real app. True creates isolated fictional data in the browser only; it never connects to the real database.
- `emulators`: keep **false** outside local emulator testing.

Firebase Web configuration and the UID are public identifiers. Do not put a password, OAuth token or service-account key in this file. `.env` files and GitHub Actions variables are no longer read by the app.

## 2. Administrator authentication

The existing accounts are configured separately, with both explicitly authorized in the app and Firestore rules:

- Password: enter user ID `admin` **or** `admin@tmja.yxel.app`, and the existing Firebase password. The password is not stored in source control. No suffix is appended.
- Google: choose **Continue with Google** and select `m.shamilvakkaloor07@gmail.com`.
- Other Firebase users are not administrators. Member login is not included.

The password account UID is `sSrHlyKjlseo8ncOluufxbJOce72`; the Google account UID is `G0YLplPHzlT8dJVIVA5wWwLZCPJ3`. These are separate accounts for the owner's two login methods; no account deletion or linking is required. Audit entries retain the actual signing-in UID.

In [Firebase Console](https://console.firebase.google.com/project/tmj---accounts/authentication/providers), keep Google and Email/Password enabled. Authentication → Settings → Authorized domains must include `tmj-accounts.vercel.app`, `shamilvakkaloor.github.io`, and any future production hostname. Keep the Firebase-provided authDomain and allow the Google popup.

If an account is deleted and recreated, its UID changes. Update both `config.js` and the `admin()` allowlist in `firestore.rules`, publish the rules, and push the app. Never authorize accounts based only on an email domain. Optional synthetic email/password suffix mapping remains available for future configurations; changing it does not change an existing Firebase password.

## 3. Firestore rules and indexes

Use Cloud Firestore **Standard edition**, `(default)` database. The existing database is in `asia-south1`. The previous setup initialized community settings, ten Sub Mahals, zero-balance cash/bank wallets and revision metadata only; it added no member or financial demo records.

In Firestore → Rules, replace the editor contents with the complete `firestore.rules` file and publish. Verify the configured administrator UID first. Do not use open/test-mode rules. Frontend login checks do not replace database rules.

The rules keep authoritative collections private, restrict all mutations to the administrator, protect immutable receipts/audit entries and validate corresponding ledger, wallet and publication updates. Public reads use only the explicit `public*` collections and the selected privacy settings.

The existing seven composite indexes were ready before conversion. If using another project, create these in Firestore → Indexes → Composite. Each is **Collection** scope; both fields are **Ascending**:

| Collection | First field | Second field |
| --- | --- | --- |
| publicMembers | version | nameKey |
| publicMembers | version | id |
| publicMembers | version | phoneKey |
| publicHouses | version | nameKey |
| publicHouses | version | id |
| publicHouses | version | numberKey |
| publicHouses | version | phoneKey |

Wait for all indexes to show Enabled. `firestore.indexes.json` is the exact declaration. Its field exemptions disable indexing for `operations.adjustments`, `receiptStates.allocations`, `receipts.lines` and `publicReceipts.lines`; preserve those exemptions when setting up another project.

If you already have the Firebase CLI installed, the optional command is `firebase deploy --only firestore --project tmj---accounts`. It deploys rules/indexes only. The app itself never needs npm or the CLI. Console setup works without it.

## 4. Run locally without a build

Use any ordinary static HTTP server; do not open `index.html` directly with a `file://` URL because browser module/security restrictions apply.

With Python installed, from this folder:

```powershell
python -m http.server 8000 --bind 127.0.0.1
```

Or, with Node 22+ installed, use the included dependency-free server:

```powershell
node tools/serve.mjs 8000
```

Open `http://127.0.0.1:8000/`. Administrator login is `http://127.0.0.1:8000/#/login`. For a repository-path check, run `node tools/serve.mjs 8000 /TMJ---Accounts/` and open that prefix.

The included server exposes only app/test assets and has no SPA fallback or API endpoints. Firebase SDK files load from Google's official CDN, so an internet connection is needed. No service worker or offline financial-posting queue is installed.

For an isolated browser demonstration, temporarily set `demo: true` in your **local** config and restore it to false before committing/uploading. Do not test payment writes against the live project with fictional records.

## 5. Host directly on GitHub Pages

Repository: [shamilvakkaloor/TMJ---Accounts](https://github.com/shamilvakkaloor/TMJ---Accounts).

1. Confirm `config.js` is correct and `demo`/`emulators` are false.
2. Push the source files to `main`.
3. In repository **Settings → Pages → Build and deployment**, change Source to **Deploy from a branch**.
4. Select branch **main**, folder **/ (root)**, then Save.
5. Wait for GitHub Pages to publish. The root `.nojekyll` file preserves these static files without Jekyll processing.

There is no app compilation step or `dist` folder. The old deployment workflow has been removed. The remaining Checks workflow runs only dependency-free JavaScript validation/tests and does not publish or contact Firebase.

Addresses after you enable Pages:

- Portal: `https://shamilvakkaloor.github.io/TMJ---Accounts/`
- Administrator: `https://shamilvakkaloor.github.io/TMJ---Accounts/#/login`
- Workspace: `https://shamilvakkaloor.github.io/TMJ---Accounts/#/admin`

Hash routes, assets and QR destinations preserve the repository path. Refreshing `/#/receipt/...` and `/#/p/member/...` needs no server routing configuration. You may also upload `index.html`, `app.js`, `config.js`, `.nojekyll`, `assets/`, `lib/`, `domain/`, `pages/` and `vendor/` to any static HTTPS host.

Previous GitHub `VITE_*` variables and the Google deployment identity are no longer used by this source. You may remove the old repository variables and dedicated `mahal-github-deploy` identity if you no longer need the previous automated deployment. This conversion does not change cloud IAM resources or live data.

### Vercel hosting

If this repository is connected to Vercel, `vercel.json` overrides the old framework/build settings: Framework **Other**, no install command, no build command, and output directory **.** (the repository root). Keep the Vercel project's Root Directory at the repository root and Production Branch at `main`. Pushing to `main` triggers a deployment through the existing GitHub integration.

Check that the newest deployment is **Ready** and matches the latest GitHub commit. A failed deployment leaves the previous production version live. Open `/#/login` on the production domain to see Google and user ID/password sign-in. Add that exact production hostname to Firebase Authentication → Settings → Authorized domains before using Google sign-in. Configuration fields are documented in [Vercel's static configuration reference](https://vercel.com/docs/project-configuration/vercel-json).

## 6. First use and migration

Sign in as administrator. If using a new empty database, select **Initialize workspace** once. Existing initialized databases open directly.

In Settings, enter the Mahal name, address, contact, timezone, migration cutover and up to 25 Sub Mahal names. Select public phone/address/history visibility deliberately. Place a small logo in `assets/` and enter `assets/logo.png` in the logo field. Uploading arbitrary files is outside V1.

Use **Settings → Add Sub Mahal** to create one by name; its ID is generated automatically. IDs are only needed when preparing CSV imports. **Download Sub Mahal IDs for CSV** gives the IDs to use in the house `subMahalId` column. Sub Mahal CSV imports supply their own permanent `id`. **Delete** removes an unused Sub Mahal after confirmation and records the action in the audit log. A Sub Mahal referenced by a current/past house assignment or receipt cannot be deleted; edit it and turn off **Active**. Keep at least one Sub Mahal.

**Receipt contact** is a public phone number or email printed on receipts and the member portal; it is unrelated to login. **Accounting cutover date** is when live accounting begins: receipts before that date are statement-only imports and do not change wallet balances, while cashbook entries must be on or after cutover. For example, with cutover `2026-01-01`, a 2025 receipt is historical and a 2026 receipt is posted normally. House/member joining dates remain their actual registration dates and affect assessment eligibility; do not replace them with cutover.

Create the real funds: member/house target, fixed/voluntary mode, frequency, start/end dates and rates. Fixed rates are dated; later changes do not alter assessed dues or original receipts. Annual assessments use January and a configurable due day from 1–28. One-time campaigns require explicit eligible payer IDs. Advances apply only to annual fixed member funds.

Import existing records through **Import & backup**, in this order:

1. Sub Mahal names, houses, then members referencing those house IDs.
2. Fund definitions and rate history.
3. Reconciled wallet opening balances at cutover.
4. Outstanding historical dues, using the amount still unpaid at cutover.
5. Optional historical receipts; these are statement-only and do not add cash again.

Download the matching CSV template. Dates accept `YYYY-MM-DD` or spreadsheet dates with four-digit years: choose **CSV date order** for `DD/MM/YYYY` (default) or `MM/DD/YYYY`; slash, dash and dot separators are supported. Impossible dates and two-digit years are rejected. For houses, map the registration/joining-date column to `joined`; this date may precede cutover. Keep amounts in rupees with at most two decimals, permanent ID prefixes/leading zeros and UTF-8 text. Map columns, validate, review errors, then confirm. Maximum 10,000 rows per file. Explicit update mode is required for existing identity/fund IDs.

Re-upload the same file with the same mapping/type/update mode/date order to resume safely. House and member rows are committed in atomic groups of up to five with one audit entry per group. Each group uses one database write request; revision checks in Firestore rules prevent stale edits. If an upload is interrupted, the grouped audit entry records its row IDs, so retrying skips completed rows even if the progress checkpoint was interrupted. Completed row operation IDs are skipped. Download the manifest and correct rejected rows separately; editing already accepted financial rows creates a different import identity.

V1 does not import old unspent advances as opening liabilities. Reconcile such balances and extend the migration mapping before cutover if needed. Enter historical house/Sub Mahal assignment before posting backdated receipts. Approved membership requires admin verification of a man aged at least 21 at joining, through DOB or verified-age evidence.

Before starting real collections, reconcile counts, wallet balances and outstanding dues with the original register. Download a backup.

## 7. Daily use

- Generate assessments from Funds & dues. A saved payer queue resumes interrupted generation, does not duplicate existing dues and applies eligible advances without adding cash again.
- Receive a payment from one payer into one wallet. Review the fund/period allocations before posting. A receipt supports four allocations; split larger payments.
- Refunds reopen paid dues and reduce cash. Voids reverse only the remaining receipt amount. Waivers forgive dues separately. Original receipts and correction history remain intact.
- Cashbook transfers create equal opposite movements and are excluded from income/expenditure. Opening balances are recorded once per wallet. Do not duplicate receipt collections as other income.
- Reports show dated collections net of corrections. Outstanding reports show **current** unpaid balances of dues in the selected date range, not historical as-of balances. Cashbook reconciliation reports opening/movement/closing balances by wallet.
- Refresh data after another tab changes the register. On an uncertain payment result, retry the existing form rather than starting a second receipt.
- If publication was interrupted, refresh and use Settings → Refresh public profiles. Privacy-version checks block stale public identity records.
- Print receipts on A6 (105 × 148 mm), portrait, at 100%, without browser headers/footers. ID cards are 85.6 × 54 mm. Check a physical print with your actual logo and longest names. Camera scanning needs HTTPS and permission; pasting a QR link is also supported.

## 8. Backups and recovery

Download a full JSON backup regularly and after migrations. It contains private data and financial history. The browser can validate a backup; live recovery is deliberately separate from normal application editing.

The recovery utility uses Node 22+ built-ins only. Validation does not contact a database:

```powershell
node tools/restore.mjs 'C:\Backups\mahal-backup.json' YOUR_RECOVERY_PROJECT_ID
```

To restore, create a **different, empty** Firestore project/database. Authenticate an owner or other authorized recovery operator with the Google Cloud CLI. Obtain a short-lived OAuth token in the terminal, never in app source or config:

```powershell
gcloud auth login
$env:GOOGLE_OAUTH_ACCESS_TOKEN = (gcloud auth print-access-token)
node tools/restore.mjs 'C:\Backups\mahal-backup.json' YOUR_RECOVERY_PROJECT_ID --apply
Remove-Item Env:GOOGLE_OAUTH_ACCESS_TOKEN
```

The script refuses the configured live project and nonempty destinations. It validates relationships, regenerates public/uniqueness documents, writes bounded atomic batches, checkpoints progress and verifies every resulting document against the backup. Repeat the same command after an interruption to resume. A completed recovery is refused on repeat, protecting later changes. Do not permit other writes into the recovery database during restoration.

Auth accounts and credentials are not in the backup. Configure the recovery project's Auth/admin UID, rules and indexes separately. Reconcile totals before changing `config.js` to the recovered project. Keep the original project intact until recovery has been accepted.

## 9. Verification and maintenance

Optional developer checks use Node built-ins, with no package installation:

```powershell
node tools/check.mjs
```

This checks module syntax/import paths and accounting, backup validation, CSV, login encoding, hash URL and QR tests. `VALIDATION.md` records the conversion checks. The repository has no application dependency manifest; the two vendored QR utilities include upstream notices and `vendor/SOURCES.json`. Firebase SDK imports are pinned to `12.19.0`.

Official references: [Firebase browser modules](https://firebase.google.com/docs/web/alt-setup), [Google sign-in](https://firebase.google.com/docs/auth/web/google-signin), [linking Auth providers](https://firebase.google.com/docs/auth/web/account-linking), [GitHub Pages publishing source](https://docs.github.com/en/pages/getting-started-with-github-pages/configuring-a-publishing-source-for-your-github-pages-site).

### Existing house IDs in CSV

House imports preserve codes such as `H-TMJBDR002`. Use `H-` followed by 1–64 uppercase letters, numbers, hyphens or underscores; no spaces or slashes. Existing numeric IDs such as `H-000001` still work. Manual registration continues to generate numeric IDs. Use the exact same house ID in member CSV `houseId` fields. Custom codes do not change the numeric ID sequence, and are supported by backups, public profiles and receipt snapshots.

### Member imports with incomplete information

Only `id`, `name` and `houseId` are required for member CSV imports. `phone`, `dob`, `verifiedAge`, `ageVerifiedOn`, `joined`, `approved` and the new `care of` column may be blank or omitted. The importer also recognizes `careOf` and `care_of` headers. Missing joining dates remain unknown; missing approval creates a pending member. Dues assessments still require approved membership, with a joining date and age evidence supplied when approving it. A house assignment is recorded from the import date when the joining date is unknown.

A minimal header with care of is `id,name,houseId,care of`. Care of is shown and editable in the administrator member directory and included in backups, but is not published on public profiles.

### Install as a Chrome app

Open the production site in Chrome and select **Install Mahal app** in the sidebar or login page. Chrome may also show an install icon beside the address bar; alternatively use its menu → Cast, save and share → Install page as app. Confirm installation to open Mahal Accounts in its own window. The app icon and name are supplied by `manifest.webmanifest`; its relative URLs support both Vercel and the GitHub Pages repository path. Include this file and `assets/icon-192.png` / `assets/icon-512.png` on any static host. The installed app still needs an internet connection for Firebase authentication and accounting. It loads current files from the website when opened.

### Four-column member upload and existing IDs

Upload `id,name,houseId,care of`; the app recognizes member files from `houseId` and selects Members automatically. Missing optional columns stay blank. Member IDs may contain letters, digits and hyphens, such as `TMJBDR002`, `12345` or `member-Ab12`; their spelling and case are preserved. Use the same case when searching a public member ID. Only canonical numeric `M-000001` IDs affect automatic member numbering.

## Startup snapshot

The administrator workspace loads collections in parallel. The browser saves an account/project-scoped snapshot in IndexedDB for up to 24 hours. On every opening, Firebase authentication and a server-only revision check must succeed before that snapshot can be used. Changed revisions trigger a complete reload; imports and other successful edits update the snapshot after a short debounce. Signing out clears saved snapshots. Browser storage being unavailable does not prevent loading from Firestore. This does not enable offline access or offline writes.

Use the app’s **Refresh data** button after editing documents directly in Firebase Console: it bypasses the snapshot even when the edit did not update meta/revision. Firebase rule edits do not require rebuilding the snapshot.

## Member and house ID cards

Open **Members & houses**, then choose **ID card** beside a member or house (also available as **Generate ID card** in record details). Cards use the configured Mahal name and current records in the green/gold design. Download a PNG image or a PDF, or print at 100% scale on 85.6 × 54 mm cards. House cards include every currently linked member, including inactive and pending members; households with more than six members receive continuation pages. The PDF includes all pages; PNG downloads are available separately per page. Regenerate cards after changing names, care of or household membership.

QR codes open the current public member/house profile at the same deployment where the card was generated. The public portal scanner supports the camera, uploading an ID-card image and pasting its QR link. House profiles list linked members even when financial history is private; they use existing public identity projections and do not expose care-of or private age/approval fields. Large lists use **Load more members**. Members link back to their household. Administrators can also use **Houses → View members**.

Deploy the publicMembers version/houseId composite index from firestore.indexes.json in a new Firebase project. It is already deployed for tmj---accounts. No additional Firestore rule permissions or backend services are required.

## Bulk ID cards

Open **Bulk ID cards** in the administrator sidebar. Choose member or house cards and combine Sub Mahal, house, registration status, membership approval (members), household occupancy (houses), text search and joining-date filters. Unknown joining dates are excluded when a date boundary is set. Sort by name or ID. Changing a filter clears the selection.

Choose individual records across pages or **Select all filtered**, then **Prepare selected cards**. Download the resulting PDFs; each file contains up to 100 card pages, including household continuation pages. Cards are generated sequentially with progress and cancellation so the browser does not retain hundreds of full-size canvases. Leaving the tab cancels generation. No records are modified. Individual PNG exports remain available through each record’s card preview.
