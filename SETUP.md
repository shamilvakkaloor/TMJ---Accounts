# Mahal Accounts — setup (vanilla JavaScript V1)

The application is ready as ordinary static files. There is **no React, TypeScript, npm install, bundler or build command**. The browser loads ES modules, Firebase Auth and Firestore directly. There is no custom API server. V1 has one administrator; members use the public lookup/QR portal without signing in.

The conversion preserves the existing Firestore collections and accounting rules. It does not require a data migration. Hosting and Firebase changes are left for you to perform using this guide.

## 1. Public configuration

Edit `config.js` in the project root. It already contains the Firebase Web configuration you supplied for `tmj---accounts` and administrator UID `B1KzyiFd7Nh2cHNP2kDTG04rnUG3`.

- `firebase`: Web app configuration from Firebase Console → Project settings → Your apps.
- `adminUid`: the single administrator's Firebase Authentication UID. This must exactly match the UID in the `admin()` function near the top of `firestore.rules`.
- `login.userId`: the administrator's user ID, initially `admin`.
- `login.emailDomain`: domain used to turn a user ID into a synthetic Firebase email.
- `login.emailOverride`: optional existing Firebase email address, instead of a synthetic email.
- `login.passwordSuffix`: fixed text appended to the entered password, initially `::TMJ-v1`.
- `demo`: keep **false** for the real app. True creates isolated fictional data in the browser only; it never connects to the real database.
- `emulators`: keep **false** outside local emulator testing.

Firebase Web configuration and the UID are public identifiers. Do not put a password, OAuth token or service-account key in this file. `.env` files and GitHub Actions variables are no longer read by the app.

## 2. Configure administrator authentication

In [Firebase Console](https://console.firebase.google.com/project/tmj---accounts/authentication/providers), enable **Google** and **Email/Password** sign-in. Select your support email when enabling Google. No public sign-up interface is included.

In Authentication → Settings → Authorized domains, add:

- `shamilvakkaloor.github.io`
- `localhost` and `127.0.0.1` if you want to test real authentication locally.
- Your custom domain, if you later use one.

Leave `firebase.authDomain` at the Firebase-provided value. Allow the Google sign-in popup in your browser.

### Preserve the administrator UID you already supplied

That UID was an enabled password-provider account at the previous setup stage. You can preserve it:

1. Set `login.emailOverride` to that existing account's exact Firebase email address.
2. If its existing Firebase password was created normally, temporarily set `login.passwordSuffix` to an empty string `""`.
3. Open `#/login`. Enter the configured **user ID** (`admin`) and that account's existing password.
4. In Settings → Access & publication, choose **Link administrator Google account**. Select the Google account you intend to administer the Mahal with.
5. Check that Firebase Console shows the same UID with both password and Google providers. Google sign-in can now use that same allowed UID.

If Google reports that the credential is already linked to another Firebase account, do not create an additional administrator allowlist. Either choose a different Google account to link, or intentionally adopt the Google account's UID using the next procedure.

### Use a new Google administrator instead

1. Enable Google and open the app's **Continue with Google** button.
2. A Google account whose UID is not configured is signed out and denied administration. Its Auth user appears in Firebase Console → Authentication → Users.
3. Copy that Google user's UID into `config.js` **and** the `admin()` function in `firestore.rules`.
4. Publish the updated rules (section 3), then publish/upload the edited static files.
5. Sign in with Google again. There is no role selector or self-promotion path in the app.
6. To enable the user ID/password option on a Google-only account, set the desired login mapping in `config.js`, then use Settings → **Enable user ID/password login**. It links the password provider to the current administrator UID.

### User ID and fixed password padding

With the defaults, user ID `admin` maps to `admin@users.tmj-accounts.invalid`. If the password entered in the app is `1234`, Firebase receives `1234::TMJ-v1`. The suffix is always appended, rather than padding different inputs to the same string. `emailOverride`, if set, replaces the synthetic address.

When creating a password account manually in Firebase Console, use the mapped email and the **encoded password** (entered password plus suffix). Users type only the original password in the app. The in-app linking form performs the encoding itself.

Fixed padding is compatibility encoding, not encryption or added password strength. Use a strong administrator password. Synthetic addresses cannot receive password-reset emails; reset through Firebase Console with the same encoding, or retain Google access. Changing the mapping or suffix does not change an existing Firebase password automatically.

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

## 6. First use and migration

Sign in as administrator. If using a new empty database, select **Initialize workspace** once. Existing initialized databases open directly.

In Settings, enter the Mahal name, address, contact, timezone, migration cutover and ten Sub Mahal names. Select public phone/address/history visibility deliberately. Place a small logo in `assets/` and enter `assets/logo.png` in the logo field. Uploading arbitrary files is outside V1.

Create the real funds: member/house target, fixed/voluntary mode, frequency, start/end dates and rates. Fixed rates are dated; later changes do not alter assessed dues or original receipts. Annual assessments use January and a configurable due day from 1–28. One-time campaigns require explicit eligible payer IDs. Advances apply only to annual fixed member funds.

Import existing records through **Import & backup**, in this order:

1. Sub Mahal names, houses, then members referencing those house IDs.
2. Fund definitions and rate history.
3. Reconciled wallet opening balances at cutover.
4. Outstanding historical dues, using the amount still unpaid at cutover.
5. Optional historical receipts; these are statement-only and do not add cash again.

Download the matching CSV template. Keep dates as `YYYY-MM-DD`, amounts in rupees with at most two decimals, permanent ID prefixes/leading zeros and UTF-8 text. Map columns, validate, review errors, then confirm. Maximum 10,000 rows per file. Explicit update mode is required for existing identity/fund IDs.

Re-upload the same file with the same mapping/type/update mode to resume safely. Completed row operation IDs are skipped. Download the manifest and correct rejected rows separately; editing already accepted financial rows creates a different import identity.

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
