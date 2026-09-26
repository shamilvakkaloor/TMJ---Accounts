import { expect, test } from "@playwright/test";
import { apply, fixture } from "../tests/fixture";
test("admin navigation, registration and payment receipt", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/#/admin");
  await expect(
    page.getByRole("heading", { name: "A clear view of your community." }),
  ).toBeVisible();
  await page.screenshot({
    path: "test-results/dashboard-desktop.png",
    fullPage: true,
  });
  for (const [path, heading] of [
    ["directory", "People make a Mahal."],
    ["funds", "A purpose for every contribution."],
    ["accounts", "Keep your accounts in balance."],
    ["reports", "Numbers you can account for."],
    ["import", "Bring your records together."],
    ["settings", "Make this your Mahal."],
    ["audit", "A history that stays intact."],
  ]) {
    await page.goto("/#/admin/" + path);
    await expect(page.getByRole("heading", { name: heading })).toBeVisible();
  }
  await page.goto("/#/admin/receive?payer=M-000012");
  await page
    .getByRole("combobox", { name: "Fund", exact: true })
    .selectOption("membership");
  await page.getByLabel("Amount (₹)", { exact: true }).fill("500");
  await page
    .getByRole("button", { name: "Post payment & issue receipt" })
    .click();
  await expect(
    page.getByRole("button", { name: "Print A6 receipt" }),
  ).toBeVisible();
  await expect(page.locator(".receipt-paper")).toContainText("Basheer K");
  await expect(page.locator(".receipt-total")).toContainText("500.00");
  await page.screenshot({ path: "test-results/receipt.png", fullPage: true });
  const pdf = await page.pdf({
    path: "test-results/receipt-a6.pdf",
    preferCSSPageSize: true,
  });
  expect(pdf.toString("latin1").match(/\/Type\s*\/Page(?!s)/g)).toHaveLength(1);
  await page.getByRole("button", { name: "Correct / refund" }).click();
  await page.getByLabel("Refund amount (₹)").fill("100");
  await page.getByLabel("Reason", { exact: true }).fill("Test partial refund");
  await page.getByRole("button", { name: "Issue refund" }).click();
  await expect(page.locator(".receipt-method").first()).toContainText(
    "Returned ₹100.00",
  );
  expect(errors).toEqual([]);
});
test("registration, resumable CSV import and full backup", async ({ page }) => {
  await page.goto("/#/admin/directory");
  await page.getByRole("button", { name: "Add member", exact: true }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel("Full name", { exact: true }).fill("നൂർ മുഹമ്മദ്");
  await dialog
    .getByRole("combobox", { name: "House", exact: true })
    .selectOption("H-000001");
  await dialog.locator('input[name="dob"]').fill("1990-01-01");
  await dialog
    .getByRole("button", { name: "Register member", exact: true })
    .click();
  await expect(dialog).toBeHidden();
  await page.getByPlaceholder("Search name, ID or phone…").fill("നൂർ");
  await expect(
    page.locator(".record-button").filter({ hasText: "നൂർ മുഹമ്മദ്" }),
  ).toBeVisible();
  await page.goto("/#/admin/import");
  const csv =
    "id,name,number,address,phone,subMahalId,active,joined,inactiveDate\r\nH-000100,Imported House,001,Import Road,09012345678,SM-01,true,2026-01-01,\r\n";
  await page
    .locator('input[type="file"][accept=".csv,text/csv"]')
    .setInputFiles({
      name: "houses.csv",
      mimeType: "text/csv",
      buffer: Buffer.from(csv),
    });
  for (const expected of [
    "1 imported · 0 skipped · 0 errors",
    "0 imported · 1 skipped · 0 errors",
  ]) {
    await page.getByRole("button", { name: "Validate & preview" }).click();
    await expect(
      page.getByText("All rows passed validation. Ready for confirmation."),
    ).toBeVisible();
    await page.getByRole("button", { name: "Import validated rows" }).click();
    await page
      .getByRole("dialog")
      .getByRole("button", { name: "Confirm import" })
      .click();
    await expect(page.getByText(expected)).toBeVisible();
  }
  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: "Download full backup" }).click();
  const download = await downloadPromise;
  await download.saveAs("test-results/browser-backup.json");
  const stream = await download.createReadStream();
  const chunks: Buffer[] = [];
  for await (const chunk of stream!) chunks.push(Buffer.from(chunk));
  const backup = JSON.parse(Buffer.concat(chunks).toString());
  expect(backup.data.members).toHaveLength(13);
  expect(
    backup.data.houses.filter((h: { id: string }) => h.id === "H-000100"),
  ).toHaveLength(1);
  expect(backup.data.importJobs.at(-1).status).toBe("complete");
});
test("public lookup and mobile layout", async ({ page }) => {
  await page.goto("/#/");
  await page
    .getByRole("textbox", { name: "Search community records" })
    .fill("Abdul");
  await page.getByRole("button", { name: "Find record" }).click();
  await page.getByRole("link", { name: /Abdul Rahman/ }).click();
  await expect(
    page.getByRole("heading", { name: "Abdul Rahman" }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Fund-wise payment status" }),
  ).toBeVisible();
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/#/admin");
  await expect(
    page.getByRole("heading", { name: "A clear view of your community." }),
  ).toBeVisible();
  await page.screenshot({
    path: "test-results/dashboard-mobile.png",
    fullPage: true,
  });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  await page.getByRole("button", { name: "Open navigation" }).click();
  await expect(
    page.getByRole("link", { name: "Members & houses" }),
  ).toBeVisible();
  await page.goto("/#/");
  await page.screenshot({
    path: "test-results/public-mobile.png",
    fullPage: true,
  });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
});
test("four-line Malayalam receipt and ID card fit their print pages", async ({
  page,
}) => {
  let s = fixture();
  s = apply(s, {
    type: "saveMember",
    value: { ...s.members[0], name: "മുഹമ്മദ് അബ്ദുൽ റഹ്മാൻ" },
  });
  for (let i = 1; i <= 3; i++)
    s = apply(s, {
      type: "saveFund",
      value: {
        ...s.funds[0],
        id: `donation-${i}`,
        title: `Community welfare contribution ${i}`,
        mode: "voluntary",
        advance: false,
      },
    });
  s = apply(
    s,
    {
      type: "payment",
      payerId: "M-000001",
      date: "2026-09-25",
      walletId: "cash",
      method: "Cash",
      reference: "",
      lines: [
        { fundId: "annual", amount: 50000 },
        ...Array.from({ length: 3 }, (_, i) => ({
          fundId: `donation-${i + 1}`,
          amount: 10000,
        })),
      ],
    },
    "print-receipt",
  );
  await page.addInitScript(
    (value) =>
      localStorage.setItem(
        "mahal-accounts-demo-v1-final",
        JSON.stringify(value),
      ),
    s,
  );
  await page.goto("/#/receipt/print-receipt");
  await expect(page.locator(".receipt-paper tbody tr")).toHaveCount(4);
  await page.emulateMedia({ media: "print" });
  await page
    .locator(".receipt-paper")
    .screenshot({ path: "test-results/receipt-four-lines.png" });
  const pdf = await page.pdf({
    path: "test-results/receipt-four-lines-a6.pdf",
    preferCSSPageSize: true,
  });
  expect(pdf.toString("latin1").match(/\/Type\s*\/Page(?!s)/g)).toHaveLength(1);
  const dimensions = /\/MediaBox\s*\[0 0 ([\d.]+) ([\d.]+)\]/.exec(
    pdf.toString("latin1"),
  );
  expect(Number(dimensions?.[1])).toBeCloseTo((105 / 25.4) * 72, 0);
  expect(Number(dimensions?.[2])).toBeCloseTo((148 / 25.4) * 72, 0);
  await page.emulateMedia({ media: "print" });
  await page
    .locator(".receipt-paper")
    .screenshot({ path: "test-results/receipt-four-lines.png" });
  await page.emulateMedia({ media: "screen" });
  await page.goto("/#/card/member/M-000001");
  await expect(page.locator(".id-card")).toContainText(
    "മുഹമ്മദ് അബ്ദുൽ റഹ്മാൻ",
  );
  const card = await page.pdf({
    path: "test-results/member-card.pdf",
    preferCSSPageSize: true,
  });
  expect(card.toString("latin1").match(/\/Type\s*\/Page(?!s)/g)).toHaveLength(
    1,
  );
});
test("assessment generation resumes through credit application", async ({
  page,
}) => {
  let s = fixture();
  s = apply(
    s,
    {
      type: "payment",
      payerId: "M-000001",
      date: "2026-09-25",
      walletId: "cash",
      method: "Cash",
      reference: "",
      lines: [{ fundId: "annual", amount: 140000 }],
    },
    "advance-receipt",
  );
  s = apply(s, {
    type: "assess",
    payerId: "M-000001",
    fundId: "annual",
    period: "2027",
  });
  s = apply(s, {
    type: "saveImportJob",
    value: {
      id: "generation-annual-2027",
      kind: "assessment",
      fileName: "Annual membership · 2027",
      payerIds: ["M-000001"],
      completed: [],
      errors: [],
      createdAt: new Date().toISOString(),
      status: "running",
    },
  });
  await page.goto("/#/admin/funds");
  await page.evaluate(
    (value) =>
      localStorage.setItem(
        "mahal-accounts-demo-v1-final",
        JSON.stringify(value),
      ),
    s,
  );
  await page.reload();
  await page.getByRole("button", { name: "Generate assessments" }).click();
  await page.getByLabel("Assessment period").fill("2027");
  await expect(
    page.getByText("payers remaining in the saved generation"),
  ).toBeVisible();
  await page.getByRole("button", { name: "Confirm & generate" }).click();
  await expect(page.getByRole("dialog")).toBeHidden();
  const result = await page.evaluate(() =>
    JSON.parse(localStorage.getItem("mahal-accounts-demo-v1-final")!),
  );
  expect(
    result.dues.find((d: { period: string }) => d.period === "2027").paid,
  ).toBe(40000);
  expect(
    result.wallets.find((w: { id: string }) => w.id === "cash").balance,
  ).toBe(140000);
  expect(result.importJobs[0].status).toBe("complete");
});
