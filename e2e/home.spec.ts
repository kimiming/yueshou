import { expect, test } from "@playwright/test";

test("serves the YueShou home page", async ({ page }) => {
  await page.goto("/");

  await expect(page).toHaveTitle("粤首");
  await expect(page.getByRole("heading", { name: "粤首" })).toBeVisible();
  await expect(page.getByText(/Next\.js|Vercel/i)).toHaveCount(0);
});
