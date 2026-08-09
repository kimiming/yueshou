import { expect, test } from "./fixtures/browser";
import { e2eSkipReason, hasE2eDatabase } from "./fixtures/database";

function consent(context: import("@playwright/test").BrowserContext) {
  return context.cookies().then((cookies) => JSON.parse(decodeURIComponent(cookies.find((cookie) => cookie.name === "ys_consent_v1")?.value ?? "{}")) as { analytics?: boolean; necessary?: boolean });
}

test.describe("cookie consent", () => {
  test.skip(!hasE2eDatabase, e2eSkipReason);

  test("visitor can reject, later accept analytics, and withdraw through cookie settings", async ({ page, context }) => {
    await page.goto("/en");
    const banner = page.getByRole("region", { name: "Cookie choices" });
    await expect(banner).toBeVisible();
    await banner.getByRole("button", { name: "Reject all" }).click();
    await expect(banner).toHaveCount(0);
    await expect.poll(() => consent(context)).toMatchObject({ necessary: true, analytics: false });

    await page.getByRole("button", { name: "Cookie settings" }).click();
    const dialog = page.getByRole("dialog", { name: "Cookie choices" });
    await dialog.getByRole("checkbox", { name: "Analytics" }).check();
    await dialog.getByRole("button", { name: "Save preferences" }).click();
    await expect.poll(() => consent(context)).toMatchObject({ necessary: true, analytics: true });

    await page.getByRole("button", { name: "Cookie settings" }).click();
    await dialog.getByRole("checkbox", { name: "Analytics" }).uncheck();
    await dialog.getByRole("button", { name: "Save preferences" }).click();
    await expect.poll(() => consent(context)).toMatchObject({ necessary: true, analytics: false });
  });
});
