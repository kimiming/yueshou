import type { Browser, Page } from "@playwright/test";

import { expect, test } from "./fixtures/browser";
import { signInAsConfiguredAdmin } from "./fixtures/auth";
import { e2eMutationFixture, e2eMutationSkipReason, e2eSkipReason, hasE2eDatabase, hasE2eMutationFixture } from "./fixtures/database";

async function withFreshAnonymousPage<T>(
  browser: Browser,
  baseURL: string | undefined,
  visit: (page: Page) => Promise<T>,
) {
  const context = await browser.newContext(baseURL ? { baseURL } : {});
  try {
    return await visit(await context.newPage());
  } finally {
    await context.close();
  }
}

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
    await expect(page.getByTestId("logo-media-picker").getByRole("button", { name: /^logo\.png/ })).toBeVisible();
    await expect(page.getByLabel("Email")).toBeVisible();
  });

  test("resettable fixture publishes branding, banner media and a translated article", async ({ page, browser, baseURL }) => {
    test.skip(!hasE2eMutationFixture, e2eMutationSkipReason);
    const run = `${Date.now()}-${process.pid}`;
    const slogan = `E2E release slogan ${run}`;
    const email = `e2e-${run}@example.test`;
    const phone = `+1-555-${run.slice(-7)}`;
    const address = `E2E laboratory ${run}`;
    const localizedTitle = `E2E German release ${run}`;

    const before = await withFreshAnonymousPage(browser, baseURL, async (publicPage) => {
      await publicPage.goto("/en");
      return {
        slogan: await publicPage.locator(".site-header__utility").innerText(),
        logo: await publicPage.locator("header .brand-lockup__image").getAttribute("src"),
        hero: await publicPage.locator("[data-section='hero'] .hero-section__media").getAttribute("src"),
        contact: await publicPage.locator("footer address").innerText(),
      };
    });

    await signInAsConfiguredAdmin(page);
    await page.goto("/admin/settings");
    await page.getByTestId("logo-media-picker").getByRole("button", { name: /^logo\.png/ }).click();
    await page.getByLabel("Slogan").fill(slogan);
    await page.getByLabel("Email").fill(email);
    await page.getByLabel("Phone").fill(phone);
    if (await page.getByLabel("Address line").count() === 0) await page.getByRole("button", { name: "Add address line" }).click();
    await page.getByLabel("Address line").first().fill(address);
    await page.getByRole("button", { name: "Save settings" }).click();
    await expect(page.getByRole("status")).toHaveText("Settings saved");

    await page.goto(`/admin/pages/${e2eMutationFixture.homePageId}`);
    const heroEditor = page.locator(".ant-card").filter({ hasText: "Edit HERO" });
    await heroEditor.getByRole("button", { name: /^hero\.png/ }).click();
    await heroEditor.getByRole("button", { name: "Save section" }).click();
    await expect(heroEditor.getByRole("status")).toHaveText("Section saved");

    await page.goto(`/admin/news/${e2eMutationFixture.articleId}`);
    await page.getByRole("tab", { name: "de" }).click();
    await page.getByLabel("Title").fill(localizedTitle);
    await page.getByLabel("Status").click();
    await page.getByRole("option", { name: "DRAFT" }).click();
    await page.getByRole("button", { name: "Save changes" }).click();
    await expect(page.getByRole("status")).toHaveText("Article saved as DRAFT");
    const draftStatus = await withFreshAnonymousPage(browser, baseURL, async (publicPage) =>
      (await publicPage.request.get(`/de/news/${e2eMutationFixture.articleSlug}`)).status());
    expect(draftStatus).toBe(404);

    await page.reload();
    await page.getByLabel("Status").click();
    await page.getByRole("option", { name: "PUBLISHED" }).click();
    await page.getByRole("button", { name: "Save changes" }).click();
    await expect(page.getByRole("status")).toHaveText("Article saved as PUBLISHED");

    await withFreshAnonymousPage(browser, baseURL, async (publicPage) => {
      await publicPage.goto(`/de/news/${e2eMutationFixture.articleSlug}`);
      await expect(publicPage.locator("article h1")).toHaveText(localizedTitle);

      await publicPage.goto("/en");
      await expect(publicPage.locator(".site-header__utility")).toContainText(slogan);
      await expect(publicPage.locator("header .brand-lockup__image")).toHaveAttribute("src", new RegExp(e2eMutationFixture.logoMediaId!));
      await expect(publicPage.locator("[data-section='hero'] .hero-section__media")).toHaveAttribute("src", new RegExp(e2eMutationFixture.heroMediaId!));
      await expect(publicPage.locator("footer address")).toContainText(email);
      await expect(publicPage.locator("footer address")).toContainText(phone);
      await expect(publicPage.locator("footer address")).toContainText(address);
      expect(await publicPage.locator(".site-header__utility").innerText()).not.toBe(before.slogan);
      expect(await publicPage.locator("header .brand-lockup__image").getAttribute("src")).not.toBe(before.logo);
      expect(await publicPage.locator("[data-section='hero'] .hero-section__media").getAttribute("src")).not.toBe(before.hero);
      expect(await publicPage.locator("footer address").innerText()).not.toBe(before.contact);
    });
  });
});
