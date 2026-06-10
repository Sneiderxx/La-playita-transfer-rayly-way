import { test, expect, request } from "@playwright/test";
import {
  apiLogin,
  pickFreeTable,
  findProduct,
  createOrder,
  setTableStatus,
  recordSale,
  uiLogin,
} from "./_helpers";

test("dailyClosePreview", async ({ page }) => {
  const ctx = await request.newContext();
  const { token: waiterToken } = await apiLogin(ctx, "Merari", "9876");
  const { token: cashierToken } = await apiLogin(ctx, "Donovan", "0001");
  const table = await pickFreeTable(ctx, waiterToken);
  const burger = await findProduct(ctx, waiterToken, "Cheeseburger Don Concho");
  const order = await createOrder(ctx, waiterToken, {
    tableId: table.id,
    items: [{ productId: burger.id, quantity: 1 }],
  });
  await setTableStatus(ctx, waiterToken, table.id, "waiting_payment");
  await recordSale(ctx, cashierToken, order.id, 75, "cash");
  await ctx.dispose();

  await uiLogin(page, "Sneider", "101001");
  await expect(page).toHaveURL(/\/dashboard$/, { timeout: 15_000 });
  await page.getByTestId("nav-daily-close").click();
  await expect(page).toHaveURL(/\/daily-close$/);

  await expect(page.getByText("Z-REPORT - END OF DAY")).toBeVisible();
  await expect(page.getByText("FINANCIAL SUMMARY")).toBeVisible();
  await expect(page.getByText("PAYMENT BREAKDOWN")).toBeVisible();
  await expect(
    page.locator("div, span").filter({ hasText: /^cash\s*\(\d+\)$/i }).first(),
  ).toBeVisible();
  await expect(page.getByText("TOP SELLING PRODUCTS")).toBeVisible();
  await expect(
    page.getByText("Cheeseburger Don Concho").first(),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: /FINALIZE DAY AND CLOSE/i }),
  ).toBeVisible();

  // Intentionally do NOT click finalize — destructive action.
});
