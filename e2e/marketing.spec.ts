import AxeBuilder from "@axe-core/playwright";

import { expect, test } from "./fixtures/browser";
import { e2eSkipReason, hasE2eDatabase } from "./fixtures/database";

const locales = ["en", "zh-CN", "de", "fr", "es"] as const;
const slogans = { en: "Precision Peptide", "zh-CN": "肽", de: "Peptid", fr: "peptidique", es: "péptidos" } as const;

test.describe("marketing release journeys", () => {
  test.skip(!hasE2eDatabase, e2eSkipReason);

  for (const locale of locales) {
    test(`SSR renders the ${locale} home page with its locale and primary heading`, async ({ page }) => {
      const response = await page.goto(`/${locale}`);
      expect(response?.ok()).toBe(true);
      expect(await page.locator("html").getAttribute("lang")).toBe(locale);
      await expect(page.locator("main h1")).toBeVisible();
      await expect(page.locator("[role=alert]")).toHaveCount(0);
      expect(await response?.text()).toContain("<main");
      expect(await response?.text()).toContain(slogans[locale]);
      await expect(page.locator("link[rel=canonical]")).toHaveAttribute("href", new RegExp(`/${locale}`));
      await expect(page.locator("meta[property='og:title']")).toHaveAttribute("content", /.+/);
      await expect(page.locator("script[type='application/ld+json']").first()).toContainText("Organization");
    });
  }

  test("language switcher preserves the current public route", async ({ page }) => {
    await page.goto("/en/products");
    await page.locator("nav[aria-label='Language'] a[href='/de/products']").click();
    await expect(page).toHaveURL(/\/de\/products$/);
    await expect(page.locator("html")).toHaveAttribute("lang", "de");
  });

  test("footer exposes each approved legal policy route", async ({ page }) => {
    await page.goto("/en");
    const footer = page.locator("footer");
    for (const slug of ["terms", "privacy", "ruo-policy", "shipping-compliance", "cookie-policy"]) {
      const link = footer.locator(`a[href='/en/legal/${slug}']`); await expect(link).toBeVisible();
      const response = await page.request.get(`/en/legal/${slug}`); expect(response.ok()).toBe(true); expect(await response.text()).toContain("<h1");
    }
  });

  test("search returns a published product result", async ({ page }) => {
    const term = process.env.E2E_SEARCH_TERM || "peptide";
    await page.goto(`/en/search?q=${encodeURIComponent(term)}`);
    await expect(page.getByRole("heading", { name: "Search results" })).toBeVisible();
    await expect(page.locator(".search-results a[href^='/en/products/']").first()).toBeVisible();
  });

  test("desktop home page has no automatically detected accessibility violations", async ({ page }) => {
    await page.goto("/en");
    const results = await new AxeBuilder({ page }).analyze();
    expect(results.violations).toEqual([]);
  });

  test("mobile menu opens, supports keyboard navigation, and avoids horizontal overflow", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/en");
    const menu = page.getByRole("button", { name: "Menu" });
    await menu.focus();
    await page.keyboard.press("Enter");
    await expect(menu).toHaveAttribute("aria-expanded", "true");
    await expect(page.getByRole("navigation", { name: "Mobile navigation" })).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  });
});
