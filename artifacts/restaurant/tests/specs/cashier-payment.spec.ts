import { test, expect, request } from "@playwright/test";
import {
  apiLogin,
  pickFreeTable,
  findProduct,
  createOrder,
  setTableStatus,
  uiLogin,
} from "./_helpers";

test("cashierPayment", async ({ page }) => {
  const ctx = await request.newContext();
  const { token: waiterToken } = await apiLogin(ctx, "Merari", "9876");
  const table = await pickFreeTable(ctx, waiterToken);
  const coke = await findProduct(ctx, waiterToken, "Coca-Cola");
  await createOrder(ctx, waiterToken, {
    tableId: table.id,
    items: [{ productId: coke.id, quantity: 2 }],
  });
  await setTableStatus(ctx, waiterToken, table.id, "waiting_payment");
  await ctx.dispose();

  await uiLogin(page, "Donovan", "0001");
  await expect(page).toHaveURL(/\/pos$/, { timeout: 15_000 });

  // shadcn's CardTitle is a div, not a heading role. Match the POS Card
  // root by class + text content.
  const card = page
    .locator('[class*="border-2"]')
    .filter({ hasText: `Table #${table.number}` })
    .filter({ hasText: /Q\s*30\.00/ })
    .first();
  await expect(card).toBeVisible({ timeout: 15_000 });
  await card.getByRole("button", { name: /Process Payment/i }).click();

  const dialog = page.getByRole("dialog");
  await expect(
    dialog.getByText(`Process Payment - Table #${table.number}`),
  ).toBeVisible();
  await expect(dialog.getByText("Total Due:")).toBeVisible();
  await expect(dialog.locator("text=/Q\\s*30\\.00/").first()).toBeVisible();

  await dialog.getByRole("button", { name: /Confirm Payment/i }).click();
  await expect(
    page.locator("li, [role='status']").filter({ hasText: /payment processed successfully/i }).first(),
  ).toBeVisible({ timeout: 15_000 });

  // Card should disappear from POS list.
  await expect(
    page
      .locator("div")
      .filter({ hasText: `Table #${table.number}` })
      .filter({ hasText: /Q\s*30\.00/ }),
  ).toHaveCount(0, { timeout: 10_000 });
});
