# Native browser smoke checks

Use a local copy with `demo: true`; restore it to false before committing or uploading. Run `node tools/serve.mjs 8000 /TMJ---Accounts/`, or use any static server. These checks do not require a browser-test package.

1. Open the administrator overview. Visit every sidebar page. Reload a nested hash route.
2. Register a Malayalam-named member in an existing house. Verify search, edit, inactive date and membership approval validation.
3. Create a fixed fund, preview and generate assessments. Generate the same period again: no duplicate dues. Manage a due with a waiver/restoration.
4. Receive a partial payment. Verify payer, amount, allocation and wallet. Open the receipt QR destination, reload, print A6, refund part and verify the changed status.
5. Record an expense and transfer. Verify balance conservation and rejection of an overdraft. Export a report CSV, including a negative correction amount.
6. Upload a CSV template with one new house. Validate and import twice; the second run skips it. Download the manifest and full JSON backup. Validate that backup.
7. Change community details and public phone visibility. Check the public portal, prefix search and profile history.
8. Open an ID card, confirm its QR points to the same repository prefix and print at the stated card size. Scan or paste a same-site QR; a foreign-site QR must be rejected.
9. Check overview, public portal and payment entry at a 390px-wide viewport. Check sidebar open/close and horizontal table scrolling without page overflow.
10. With `demo: false`, the admin route must redirect to login. Google and user-ID/password controls must be present. A different Firebase UID must be denied even if sign-in itself succeeds.

For local Firebase integration, use a separate `demo-` emulator project, Auth on 9099 and Firestore on 8080, matching the configuration UID/rules. Never seed fictional test data into the live project. The conversion was also exercised against these emulators; see VALIDATION.md.
