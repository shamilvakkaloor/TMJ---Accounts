# Architecture — vanilla JavaScript V1

## Browser

The root HTML loads `app.js` as an ES module. A hash router selects modules under `pages/`. Screens use native DOM nodes and event listeners through small helpers in `lib/dom.js`; there is no virtual DOM, framework or JSX. Dynamic imports split screens without compilation. Paths derive from module URLs, preserving GitHub project prefixes.

`config.js` holds public Firebase configuration, the single administrator UID, user-ID credential mapping and explicit local demo/emulator switches. There is no environment-variable injection.

## Business logic

`domain/engine.js` receives state, a command and an explicit operation context, returning a new state or throwing before mutation. Amounts are integer paise. Stable operation IDs make retries idempotent. Receipts and posted history are immutable; corrections use compensating ledger and due/credit changes. Dated rate and household histories preserve original attribution.

`domain/projection.js` derives only approved public fields and a privacy version. Backup validation checks collection relationships, allocations, balances and numbering. The CSV parser preserves strings/leading zeros; command mapping and validation happen before writes. Browser, clock, crypto, file download, network and DOM access stay under `lib/`/`tools/`, outside accounting commands.

## Firebase

The browser imports only Firebase App, Auth and Firestore from Google's pinned module CDN. Auth supports Google and user-ID/password mapping for the same allowlisted UID. Fixed password suffixes are compatibility encoding, not a security secret. No sign-up/member account management is exposed in V1.

The repository executes commands locally, creates a document patch and submits one Firestore transaction with a revision check and immutable operation marker. Financial writes include balances and public projections atomically. Large privacy publication updates run in bounded batches; a version check prevents stale identity exposure. There is no custom API, Cloud Function, Firebase Hosting or Storage dependency.

## Hosting and verification

GitHub Pages serves root files unchanged, with `.nojekyll`. Rules/indexes and provider setup are manual. The old deploy workflow is removed; the remaining CI workflow performs built-in Node checks only. The server in `tools/serve.mjs` is a local static-file convenience, not an application backend.

The current data schema remains V1 and requires no migration for this architectural conversion. Recovery into a separate empty project uses a privileged, short-lived operator token in a local standalone utility, never the browser.
