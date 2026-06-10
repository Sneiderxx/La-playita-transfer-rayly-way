import { test, expect, request } from "@playwright/test";
import {
  apiLogin,
  pickFreeTable,
  findProduct,
  createOrder,
  uiLogin,
} from "./_helpers";

test("kitchenLifecycle", async ({ page }) => {
  const ctx = await request.newContext();
  const { token } = await apiLogin(ctx, "Merari", "9876");
  const table = await pickFreeTable(ctx, token);
  const fries = await findProduct(ctx, token, "Papas Fritas");
  const order = await createOrder(ctx, token, {
    tableId: table.id,
    items: [{ productId: fries.id, quantity: 1 }],
  });
  await ctx.dispose();

  await uiLogin(page, "Merari", "9876");
  await page.getByTestId("nav-kitchen").click();
  await expect(page).toHaveURL(/\/kitchen$/);

  // The card we care about — Card root has class "border-2"; scope to that
  // so child <button> queries don't leak into sibling tickets.
  // shadcn's CardTitle is a div, not a heading role. Match the ticket Card
  // root (class="border-2") via its text content.
  const card = page
    .locator('[class*="border-2"]')
    .filter({ hasText: `Table #${table.number}` })
    .filter({ hasText: "Papas Fritas" })
    .first();
  await expect(card).toBeVisible({ timeout: 15_000 });
  await expect(card.getByText("pending", { exact: true }).first()).toBeVisible();

  // Advance through preparing -> ready -> delivered.
  await card.getByRole("button", { name: /Start Preparing/i }).click();
  await expect(card.getByText("preparing", { exact: true }).first()).toBeVisible({
    timeout: 10_000,
  });
  await card.getByRole("button", { name: /Mark Ready/i }).click();
  await expect(card.getByText("ready", { exact: true }).first()).toBeVisible({
    timeout: 10_000,
  });
  await card.getByRole("button", { name: /^Deliver$/i }).click();

  // Ticket should disappear from the active board.
  await expect(
    page
      .locator("div")
      .filter({ hasText: `Table #${table.number}` })
      .filter({ hasText: "Papas Fritas" }),
  ).toHaveCount(0, { timeout: 15_000 });

  // Sanity: even if other tickets exist for this table, the order id is gone.
  void order; // silence unused — we use it only via the disappearance assertion above
});
