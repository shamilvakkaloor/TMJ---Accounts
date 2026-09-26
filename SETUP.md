# Setting up Mahal Accounts

The frontend uses GitHub Pages; Firestore is the database and Firebase Authentication handles the one administrator login. Firebase Hosting is not configured or deployed. The source repository is [shamilvakkaloor/TMJ---Accounts](https://github.com/shamilvakkaloor/TMJ---Accounts). A live release requires the existing Firebase project configuration below.

## 1. Create and configure your Firebase project

1. In the [Firebase console](https://console.firebase.google.com/), create/select your project. Create a **Cloud Firestore Standard edition** database in production mode. Choose the data location deliberately.
2. Register a Web app. Copy its API key, auth domain, project ID and app ID.
3. Enable **Authentication → Email/Password** and create the administrator user in the console. Copy its UID. The app deliberately has no public sign-up screen. See [Firebase password authentication](https://firebase.google.com/docs/auth/web/password-auth).
4. Copy `.env.example` to `.env.local` and fill all five `VITE_` configuration values, including `VITE_ADMIN_UID`. Keep `VITE_USE_EMULATORS=false` for the real project. These web values and the UID are public configuration; passwords and service-account keys are not.

```powershell
Copy-Item .env.example .env.local
# Edit .env.local in your editor before the next commands.
node --env-file=.env.local scripts/configure-admin.mjs
npm run check
npx firebase login
npx firebase deploy --only firestore --project YOUR_PROJECT_ID
```

The configure script replaces the rules' placeholder with the sole allowed UID. It accepts a repeat run for the same UID and refuses an unexpected change to an already configured UID. Review an intentional admin-account replacement in both the rules and build configuration. The frontend allowlist alone is insufficient: deploy the matching rules.

Wait for the declared Firestore indexes to finish building in the console. Restart `npm run dev` after editing environment variables, then visit `/#/login`. Sign in using the administrator's email/password. If the workspace is empty, choose **Initialize workspace**. This creates only settings, ten Sub Mahals and zero-balance cash/bank wallets.

Add `shamilvakkaloor.github.io` to **Authentication → Settings → Authorized domains**, and add your custom domain if you later use one. Keep `authDomain` in the Web configuration equal to the value Firebase supplies; it is not the GitHub Pages URL. Use a separate Firebase project for connected testing, since a frontend build accesses the backend named in its configuration.

## 2. Configure the organization

In **Settings**, set the real Mahal name, address, contact, timezone, migration cutover and ten Sub Mahal names. Choose whether phone, address and financial history should be publicly accessible. DOB/age evidence, references, private correction reasons and audit data are never published by the projection.

To use a logo, place a small image in `public/`, rebuild, and enter its site path (for example `/mahal-logo.png`) in Settings. Runtime file uploads are not part of this build.

Create the actual funds with the correct member/house target, fixed/voluntary mode, frequency, rate and dates. The example demo funds are not copied into a real workspace. The payment due day is configurable from 1–28; annual dues use January of the assessment year. One-time campaigns require explicit payer IDs.

Add or rename central wallets. Record a single reconciled opening balance for each wallet that has a positive balance. Zero balances need no opening entry. Do not enter collection receipts again as other income.

Membership eligibility is an admin verification: approved male members must be 21 or older at joining. Enter DOB or verified age with its verification date. Use the joining date to represent the effective membership start. The UI accepts pending registrations, but they do not receive assessments until approved.

## 3. Import existing records

Use **Import & backup** and download a template for each type. CSV amounts are rupees (up to two decimals), dates are `YYYY-MM-DD`, IDs retain their full prefix/leading zeros, boolean columns use `true`/`false`, and files should be UTF-8. Map columns, validate, then confirm. Validation does not write records.

Import in this order:

1. Sub Mahal names, then houses with their Sub Mahal IDs.
2. Members with existing house IDs and eligibility evidence.
3. Fund definitions and effective rates.
4. Reconciled opening wallet balances at cutover.
5. Outstanding historical dues, with the **remaining amount at cutover** as the imported assessed amount.
6. Optional pre-cutover historical receipts. These keep legacy numbers separately and do not affect wallets or imported outstanding dues.

One CSV historical receipt row represents one receipt/fund. Imported IDs advance the sequence counter. Explicit update mode is required to update existing identity/configuration IDs. Posted finance records are corrected through compensating events, never overwritten by an import.

To resume, upload the **same file with the same mapping, type and update mode**. Completed row operation IDs are skipped, even when the progress checkpoint was interrupted. Download the manifest and correct rejected rows separately. Changing a financial file changes its job identity; do not re-upload already accepted financial rows in an edited file. Keep each import below 10,000 rows and size jobs to available quota.

The V1 templates do not migrate pre-cutover unspent member advances as opening liabilities. If the old records contain such balances, reconcile them explicitly and extend the migration mapping before cutover; do not mislabel them as fresh collected cash. Historic member/house assignment must be entered before backdated receipt entry if it differs from current assignment. A receipt snapshots attribution when created.

Before using live receipts, compare the imported house/member counts, wallet balances, total outstanding dues and any advances with your source records. Download a full backup. Generate missing dues only after this reconciliation.

## 4. Day-to-day operation

- **Funds & dues:** preview the period, then generate. An interrupted generation retains its payer queue and resumes from saved progress. Existing assessment IDs are never charged twice. Available linked advances are applied without adding cash again. Use a due's **Manage** action for waivers, restoring waivers and manual credit application.
- **Receive payment:** choose a single payer, funds/periods and wallet; review allocations and tender/change; post once. A receipt supports four period allocations. Split larger collections. For an uncertain network result, keep the form open and retry; check the receipt list before starting a new payment after a browser restart.
- **Receipt corrections:** refunds reduce remaining refundable allocations and reopen the affected dues; use a waiver separately to forgive debt. Voids retain the original receipt and reverse only its remaining value. Historical statement-only receipts do not allow cash refunds.
- **Accounts:** income/expenses are central. Transfers produce equal opposite movements and are excluded from income totals. Wallets cannot be overdrawn.
- **Reports:** collections use actual event dates and original payment-date Sub Mahal attribution. Refunds/voids appear as negative dated events. Outstanding reports show the current balances of dues whose due dates fall in the selected range; they are not historical as-of receivable statements. Wallet reconciliation does show opening and closing balances for the date range.
- **Publication:** after an interrupted privacy refresh, use **Settings → Refresh public profiles**. Changed privacy versions prevent stale identity records from being served while they are being rebuilt.

Print receipts on 105 × 148 mm A6 paper, portrait, at 100%, with browser headers/footers off. Cards are 85.6 × 54 mm. Test your actual logo, longest names and physical printer before a print run. Camera scanning requires HTTPS or localhost and camera permission; ordinary phone-camera links and manual lookup also work.

## 5. Backup and recovery

Choose **Download full backup** regularly and after migrations. The JSON contains private identities and financial history; store it with your controlled records. It includes authoritative collections, rates/history, original receipts, settlement states, ledger, audit, jobs and counters. Public projections and uniqueness markers can be rebuilt from it.

The UI can validate a backup. Demo mode can restore it after confirmation. Real Firebase restoration uses the separate script with an administrator credential into an **empty recovery project**, never over the current live database.

```powershell
# Validation only; no Firebase access or credential is needed.
npx tsx scripts/restore.ts 'C:\Backups\mahal-backup.json' RECOVERY_PROJECT_ID

# Apply only to the intended empty recovery project.
$env:GOOGLE_APPLICATION_CREDENTIALS='C:\Private\recovery-service-account.key.json'
npx tsx scripts/restore.ts 'C:\Backups\mahal-backup.json' RECOVERY_PROJECT_ID --apply
```

Use a credential authorized for the recovery project's Firestore data. The script validates accounting relationships, regenerates public/uniqueness documents, writes batches of 200 and verifies document counts. An interrupted restore can be repeated with the same backup. A completed restore is refused on repeat to prevent overwriting later activity. Stop all app writes during restoration.

Configure Auth/admin UID, rules and indexes separately for that project; backups do not contain credentials or Firebase Auth accounts. Verify wallet balances, dues, advances, receipt counts and numbering before changing the GitHub build variables to point to the recovery project. Keep the old workspace intact until the recovery is accepted.

## 6. GitHub Pages frontend and Firestore backend

Use the `main` branch of [TMJ---Accounts](https://github.com/shamilvakkaloor/TMJ---Accounts). Never add `.env.local`, backups or service-account files. The workflows use Node 22 and Java 21. Under **Repository Settings → Pages → Build and deployment**, choose **GitHub Actions** as the source. GitHub documents public-repository support on its Free plan and private-repository support on qualifying paid plans. [GitHub Pages workflows](https://docs.github.com/en/pages/getting-started-with-github-pages/using-custom-workflows-with-github-pages)

Create a GitHub environment named **production**. Set these environment or repository variables:

| Variable                    | Value                                      |
| --------------------------- | ------------------------------------------ |
| `VITE_FIREBASE_API_KEY`     | Firebase Web API key                       |
| `VITE_FIREBASE_AUTH_DOMAIN` | Web app auth domain                        |
| `VITE_FIREBASE_PROJECT_ID`  | Destination project ID                     |
| `VITE_FIREBASE_APP_ID`      | Firebase Web app ID                        |
| `VITE_ADMIN_UID`            | Sole administrator UID, matching the rules |

GitHub authenticates to Google Cloud through **Workload Identity Federation**, using short-lived credentials. No Firebase service-account key or password is stored in GitHub. Two additional repository variables select the configured identity:

| Variable                         | Configured value                                                                            |
| -------------------------------- | ------------------------------------------------------------------------------------------- |
| `GCP_WORKLOAD_IDENTITY_PROVIDER` | `projects/490790729007/locations/global/workloadIdentityPools/mahal-github/providers/pages` |
| `GCP_DEPLOY_SERVICE_ACCOUNT`     | `mahal-github-deploy@tmj---accounts.iam.gserviceaccount.com`                                |

The provider trusts this repository's numeric owner/repository identities, `main`, the `deploy.yml` workflow and the `production` environment. The dedicated account has Firestore index administration, Firebase Rules administration, Firebase viewer and Service Usage Consumer roles. Its impersonation policy accepts only the matching repository principal. The workflow requests a short-lived identity token after tests and removes generated credentials automatically. GitHub Pages uses a separate GitHub deployment token with `pages: write` and `id-token: write` permissions. [Google authentication action](https://github.com/google-github-actions/auth)

`Checks` runs the build, domain/URL tests, emulator rules/recovery and Chromium browser tests, including a production build served from a repository subpath without route rewrites. A successful push check on `main` triggers **Deploy GitHub Pages and Firestore**. It requires the configuration above, builds with the Pages base path, injects the admin UID, deploys Firestore rules/indexes, waits for index readiness, uploads only `dist`, then publishes through the `github-pages` environment. Pull-request checks cannot publish. Manual dispatch is limited to `main`. Source changes do not migrate data or generate dues.

The configured project-site address will be `https://shamilvakkaloor.github.io/TMJ---Accounts/`. Routes include a hash so refreshing or scanning a deep link works on a static host:

- Administration: `https://shamilvakkaloor.github.io/TMJ---Accounts/#/admin`
- Public profile: `https://shamilvakkaloor.github.io/TMJ---Accounts/#/p/member/M-000001`
- Receipt: `https://shamilvakkaloor.github.io/TMJ---Accounts/#/receipt/RECEIPT_ID`

QR codes and bundled logos preserve the repository prefix. The release obtains the base path from `actions/configure-pages`, which also supports a root site or custom domain. For a matching local build:

```powershell
$env:PAGES_BASE_PATH='/TMJ---Accounts/'
npm run build
npm run preview
```

The Firebase CLI remains available for backend-only changes: `npx firebase deploy --only firestore --project YOUR_PROJECT_ID`. The `firebase.json` file contains only Firestore and emulator settings. The frontend is published by GitHub Actions. See [Vite's GitHub Pages guide](https://vite.dev/guide/static-deploy.html#github-pages) for base-path behavior.

Verify the public home, `#/login`, a member profile, a refreshed receipt/QR link, a partial payment/refund in a test project, and an unsigned attempt to read a private collection. Keep CI tests on demo/emulator data. GitHub Pages does not provide the custom response headers previously configured for Firebase Hosting; application authentication and data authorization remain enforced by Firebase Auth and Firestore rules.

## 7. Capacity and local test tools

This build uses no Functions, scheduled server jobs or Storage. Spark eligibility is not a guarantee that an unlimited dataset fits. Current documented Firestore free allowances include 50,000 reads/day, 20,000 writes/day and 1 GiB stored data; security rules also constrain transaction access and expression counts. Review current [Firestore quotas](https://firebase.google.com/docs/firestore/quotas) before rollout.

Each assessment creates a private/public due, audit operation and revision update (at least four writes). A 5,000-payer generation can therefore consume the daily write allowance before progress and credit updates. Public projections and historical receipts add storage. The admin currently loads all private records at login/refresh in pages of 250; measure real read volume before importing years of data. No large-scale load test has been performed.

For rules tests, install Java 21 and set `JAVA_HOME`. This development workspace also contains an ignored local runtime at `.runtime/java/jdk-21.0.12.1+1-jre`. Stop other instances using port 8080 before running:

```powershell
npm run test:rules
```

For full local Auth/Firestore development, use a dedicated environment file with `VITE_USE_EMULATORS=true`, start `npx firebase emulators:start --only auth,firestore --project demo-mahal`, and configure the same test admin UID in the emulator user, app and rules. Do not deploy an emulator test UID to production.
