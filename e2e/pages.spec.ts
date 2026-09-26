import { expect, test } from "@playwright/test";
test("static project site loads, refreshes deep links and preserves QR destinations", async ({
  page,
  request,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("./#/admin");
  await expect(
    page.getByRole("heading", { name: "A clear view of your community." }),
  ).toBeVisible();
  await page.reload();
  await expect(
    page.getByRole("heading", { name: "A clear view of your community." }),
  ).toBeVisible();
  // The test server must not conceal unsupported clean-URL routes with a rewrite.
  expect((await request.get("./p/member/M-000001")).status()).toBe(404);
  await page.goto("./#/card/member/M-000001");
  await expect(page.locator(".id-card")).toBeVisible();
  const profileUrl = await page.locator(".id-card svg title").textContent();
  expect(profileUrl).toContain("/mahal-pages-test/#/p/member/M-000001");
  await page.goto(profileUrl!);
  await page.reload();
  await expect(
    page.getByRole("heading", { name: "Abdul Rahman" }),
  ).toBeVisible();
  await page.goto("./#/admin/receipts");
  await page.locator("a.record-id").first().click();
  await expect(page.locator(".receipt-paper")).toBeVisible();
  const receiptUrl = await page
    .locator(".receipt-paper svg title")
    .textContent();
  expect(receiptUrl).toContain("/mahal-pages-test/#/receipt/");
  await page.goto(receiptUrl!);
  await page.reload();
  await expect(page.locator(".receipt-paper")).toBeVisible();
  const favicon = await page.locator('link[rel="icon"]').getAttribute("href");
  expect(favicon).toBe("/mahal-pages-test/favicon.svg");
  expect((await request.get(favicon!)).status()).toBe(200);
  expect(errors).toEqual([]);
});
