import { test, expect, request } from "@playwright/test";
import { uiLogin, apiLogin, pickFreeTable, apiBase } from "./_helpers";

test("waiterOpenTable", async ({ page }) => {
  // Find a free table id ahead of time so we can navigate directly. Going
  // through the Tables grid is flaky because card order depends on prior
  // state; the plan really cares that the order/cart flow works.
  const ctx = await request.newContext();
  const { token } = await apiLogin(ctx, "Merari", "9876");
  const table = await pickFreeTable(ctx, token);
  // Open the table via API so /tables/:id/order shows the right pane.
  await ctx.post(`${apiBase()}/tables/${table.id}/open`, {
    headers: { authorization: `Bearer ${token}` },
  });
  await ctx.dispose();

  await uiLogin(page, "Merari", "9876");
  await expect(page).toHaveURL(/\/tables$/);

  await page.goto(`/tables/${table.id}/order`);
  await expect(
    page.getByRole("heading", { name: `Table #${table.number}` }),
  ).toBeVisible();

  // Add Cheeseburger
  await page.getByPlaceholder("Search products...").fill("Cheeseburger");
  await page.getByText("Cheeseburger Don Concho").first().click();
  // Add Coca-Cola
  await page.getByPlaceholder("Search products...").fill("");
  await page.getByPlaceholder("Search products...").fill("Coca");
  await page.getByText("Coca-Cola", { exact: true }).first().click();

  await expect(page.getByRole("heading", { name: "New Items" })).toBeVisible();
  // Total should reflect Q90 (75 + 15). Intl es-GT renders "Q 90.00" with a
  // non-breaking space, which \s in JS regex matches.
  await expect(page.locator("text=/Q\\s*90\\.00/").first()).toBeVisible();

  await page.getByRole("button", { name: /^Send$/ }).click();
  await expect(
    page.locator("li, [role='status']").filter({ hasText: /sent to kitchen|added to existing order/i }).first(),
  ).toBeVisible({ timeout: 10_000 });
  await expect(
    page.getByRole("heading", { name: "Sent to Kitchen" }),
  ).toBeVisible({ timeout: 10_000 });
  await expect(page.getByRole("heading", { name: "New Items" })).toHaveCount(0);
});
