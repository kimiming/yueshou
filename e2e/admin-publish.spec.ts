import { expect, test } from "./fixtures/browser";
import { signInAsConfiguredAdmin } from "./fixtures/auth";
import { e2eMutationFixture, e2eMutationSkipReason, e2eSkipReason, hasE2eDatabase, hasE2eMutationFixture } from "./fixtures/database";

test.describe("admin publication release journeys", () => {
  test.skip(!hasE2eDatabase, e2eSkipReason);

  test("anonymous administrator route redirects to staff sign in", async ({ page }) => {
    await page.goto("/admin/settings");
    await expect(page).toHaveURL(/\/admin\/login$/);
    await expect(page.getByRole("heading", { name: "Staff sign in" })).toBeVisible();
  });

  test("configured administrator can sign in and reach editable settings", async ({ page }) => {
    await signInAsConfiguredAdmin(page);
    await page.goto("/admin/settings");
    await expect(page.getByRole("heading", { name: "Site settings" })).toBeVisible();
    await expect(page.getByLabel("Logo media ID")).toBeVisible();
    await expect(page.getByLabel("Email")).toBeVisible();
  });

  test("resettable fixture publishes branding, banner media and a translated article", async ({ page }) => {
    test.skip(!hasE2eMutationFixture, e2eMutationSkipReason);
    await signInAsConfiguredAdmin(page);
    await page.goto("/admin/settings");
    await page.getByLabel("Logo media ID").fill(e2eMutationFixture.publicMediaId!);
    await page.getByLabel("Slogan").fill("E2E release verification slogan");
    await page.getByLabel("Email").fill("e2e@example.test");
    await page.getByRole("button", { name: "Save settings" }).click();
    await expect(page.getByText("Could not save settings. Please reload and try again.")).toHaveCount(0);

    await page.goto(`/admin/pages/${e2eMutationFixture.homePageId}`);
    const heroEditor = page.locator(".ant-card").filter({ hasText: "Edit HERO" });
    await heroEditor.getByLabel("Media ID").fill(e2eMutationFixture.publicMediaId!);
    await heroEditor.getByRole("button", { name: "Save section" }).click();

    const localizedTitle = `E2E German release ${Date.now()}`;
    await page.goto(`/admin/news/${e2eMutationFixture.articleId}`);
    await page.getByRole("tab", { name: "de" }).click();
    await page.getByLabel("Title").fill(localizedTitle);
    await page.getByRole("button", { name: "Save changes" }).click();
    await page.goto(`/de/news/${e2eMutationFixture.articleSlug}`);
    await expect(page.locator("article h1")).toHaveText(localizedTitle);
  });
});
