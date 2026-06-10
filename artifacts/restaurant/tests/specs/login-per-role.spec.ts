import { test, expect } from "@playwright/test";
import { uiLogin } from "./_helpers";

test("loginPerRole", async ({ page }) => {
  // Admin
  await uiLogin(page, "Sneider", "101001");
  await expect(page).toHaveURL(/\/dashboard$/, { timeout: 15_000 });
  await expect(page.getByTestId("text-username")).toHaveText("Sneider");
  await page.getByTestId("button-logout").click();
  await expect(page).toHaveURL(/\/login$/);

  // Waiter
  await uiLogin(page, "Merari", "9876");
  await expect(page).toHaveURL(/\/tables$/, { timeout: 15_000 });
  await expect(page.getByTestId("text-username")).toHaveText("Merari");
  await page.getByTestId("button-logout").click();
  await expect(page).toHaveURL(/\/login$/);

  // Cashier
  await uiLogin(page, "Donovan", "0001");
  await expect(page).toHaveURL(/\/pos$/, { timeout: 15_000 });
  await expect(page.getByTestId("text-username")).toHaveText("Donovan");
  await page.getByTestId("button-logout").click();
  await expect(page).toHaveURL(/\/login$/);

  // Bad credentials
  await uiLogin(page, "Merari", "wrong");
  await expect(page).toHaveURL(/\/login$/);
  await expect(
    page.locator("li, [role='status']").filter({ hasText: /login failed/i }).first(),
  ).toBeVisible({ timeout: 10_000 });
});
