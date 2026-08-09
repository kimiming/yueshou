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
      const html = await response!.text();
      expect(html).toContain("<main");
      expect(html).toContain(slogans[locale]);
      expect(html).toMatch(new RegExp(`<link[^>]+rel="canonical"[^>]+/${locale}`));
      for (const alternate of locales) expect(html).toMatch(new RegExp(`<link[^>]+hreflang="${alternate}"`));
      expect(html).toContain('property="og:title"');
      expect(html).toContain('"@type":"Organization"');
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

  test("every locale footer reaches each approved legal policy", async ({ page }) => {
    for (const locale of locales) {
      await page.goto(`/${locale}`);
      const footer = page.locator("footer");
      for (const slug of ["terms", "privacy", "ruo-policy", "shipping-compliance", "cookie-policy"]) {
        const href = `/${locale}/legal/${slug}`;
        await expect(footer.locator(`a[href='${href}']`)).toBeVisible();
        const response = await page.goto(href);
        expect(response?.ok()).toBe(true);
        await expect(page.locator("main h1")).not.toHaveText("");
        await expect(page.locator("main")).not.toContainText("404");
        await expect(page.locator("main p, main li").first()).not.toHaveText("");
        await page.goBack();
      }
    }
  });

  test("robots and sitemap expose public indexing rules", async ({ request }) => {
    const robots = await request.get("/robots.txt");
    expect(robots.ok()).toBe(true);
    expect(await robots.text()).toContain("Sitemap:");
    const sitemap = await request.get("/sitemap.xml");
    expect(sitemap.ok()).toBe(true);
    const xml = await sitemap.text();
    expect(xml).toContain("<urlset");
    expect(xml).toContain("hreflang");
  });

  test("search returns a published product result", async ({ page }) => {
    const term = process.env.E2E_SEARCH_TERM || "peptide";
    await page.goto(`/en/search?q=${encodeURIComponent(term)}`);
    await expect(page.getByRole("heading", { name: "Search results" })).toBeVisible();
    await expect(page.locator(".search-results a[href^='/en/products/']").first()).toBeVisible();
  });

  test("desktop home page has no automatically detected accessibility violations", async ({ page }) => {
    await page.goto("/en");
    await expect(page.getByRole("region", { name: "Cookie choices" })).toBeVisible();
    const results = await new AxeBuilder({ page }).analyze();
    expect(results.violations).toEqual([]);
  });

  test("mobile menu opens, supports keyboard navigation, and avoids horizontal overflow", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/en");
    const menu = page.getByRole("button", { name: "Menu" });
    await menu.focus();
    await expect(menu).toBeFocused();
    await page.keyboard.press("Enter");
    await expect(menu).toHaveAttribute("aria-expanded", "true");
    const navigation = page.getByRole("navigation", { name: "Mobile navigation" });
    await expect(navigation).toBeVisible();
    await expect(page.getByRole("button", { name: "Close" })).toBeVisible();
    await page.keyboard.press("Tab");
    const firstLink = navigation.getByRole("link").first();
    await expect(firstLink).toBeFocused();
    await page.keyboard.press("Escape");
    await expect(navigation).toHaveCount(0);
    await expect(menu).toBeFocused();
    await page.keyboard.press("Enter");
    await page.keyboard.press("Tab");
    const destination = await firstLink.getAttribute("href");
    await page.keyboard.press("Enter");
    await expect(page).toHaveURL(new RegExp(`${destination?.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`));
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  });
});
