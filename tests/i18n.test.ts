import { NextRequest } from "next/server";
import { describe, expect, it } from "vitest";
import LocaleLayout, { generateStaticParams } from "@/app/[locale]/layout";
import deMessages from "@/messages/de.json";
import enMessages from "@/messages/en.json";
import esMessages from "@/messages/es.json";
import frMessages from "@/messages/fr.json";
import zhCNMessages from "@/messages/zh-CN.json";
import {
  DEFAULT_LOCALE,
  fromDatabaseLocale,
  isLocale,
  SUPPORTED_LOCALES,
  toDatabaseLocale,
} from "@/lib/i18n/config";
import { getDictionary } from "@/lib/i18n/dictionaries";
import { resolveTranslation } from "@/lib/i18n/resolve-translation";
import { proxy } from "@/proxy";

describe("public locales", () => {
  it("uses the five public URL locale identifiers and English as the default", () => {
    expect(SUPPORTED_LOCALES).toEqual(["en", "zh-CN", "de", "fr", "es"]);
    expect(DEFAULT_LOCALE).toBe("en");
    expect(isLocale("zh-CN")).toBe(true);
    expect(isLocale("zh_CN")).toBe(false);
    expect(isLocale("it")).toBe(false);
    expect(toDatabaseLocale("zh-CN")).toBe("zh_CN");
    expect(fromDatabaseLocale("zh_CN")).toBe("zh-CN");
  });
});

describe("dictionaries", () => {
  it("loads a static dictionary for the requested locale", async () => {
    await expect(getDictionary("de")).resolves.toMatchObject({
      navigation: { home: "Startseite" },
      site: { name: "YueShou" },
    });
  });

  it("keeps an identical nested key tree in every language file", () => {
    const expectedKeyTree = [
      "actions",
      "actions.learnMore",
      "actions.requestQuote",
      "consent",
      "consent.acceptAll",
      "consent.analytics",
      "consent.analyticsDescription",
      "consent.close",
      "consent.description",
      "consent.manage",
      "consent.necessary",
      "consent.necessaryDescription",
      "consent.rejectAll",
      "consent.save",
      "consent.title",
      "inquiry",
      "inquiry.attachmentHelp",
      "inquiry.attachments",
      "inquiry.company",
      "inquiry.consent",
      "inquiry.contact",
      "inquiry.country",
      "inquiry.details",
      "inquiry.email",
      "inquiry.errors",
      "inquiry.errors.inquiry_attachment_signature",
      "inquiry.errors.inquiry_error_attachment",
      "inquiry.errors.inquiry_error_email",
      "inquiry.errors.inquiry_error_rate_limited",
      "inquiry.errors.inquiry_error_required",
      "inquiry.errors.inquiry_error_service",
      "inquiry.errors.inquiry_upload_intent_consumed",
      "inquiry.errors.inquiry_upload_intent_expired",
      "inquiry.required",
      "inquiry.submit",
      "inquiry.submitting",
      "inquiry.success",
      "inquiry.uploading",
      "inquiryErrors",
      "inquiryErrors.inquiry_attachment_upload_failed",
      "inquiryErrors.inquiry_error_attachment_bytes",
      "inquiryErrors.inquiry_error_attachment_count",
      "inquiryErrors.inquiry_error_validation",
      "inquiryErrors.inquiry_upload_session_invalid",
      "marketing",
      "marketing.accessibility",
      "marketing.accessibility.carousel",
      "marketing.accessibility.email",
      "marketing.accessibility.fallbackNotice",
      "marketing.accessibility.home",
      "marketing.accessibility.mobileNavigation",
      "marketing.accessibility.phone",
      "marketing.accessibility.productMedia",
      "marketing.accessibility.scientificWorkflow",
      "marketing.accessibility.showSlide",
      "marketing.accessibility.socialLinks",
      "marketing.cards",
      "marketing.cards.explore",
      "marketing.cards.readMore",
      "marketing.cards.researchUpdate",
      "marketing.cards.viewCategory",
      "marketing.errors",
      "marketing.errors.contentUnavailable",
      "marketing.errors.retry",
      "marketing.errors.shellUnavailable",
      "marketing.footer",
      "marketing.footer.contact",
      "marketing.footer.contactTeam",
      "marketing.footer.explore",
      "marketing.footer.researchUseOnly",
      "marketing.hero",
      "marketing.hero.carousel",
      "marketing.hero.choose",
      "marketing.hero.steps",
      "marketing.hero.steps.0",
      "marketing.hero.steps.1",
      "marketing.hero.steps.2",
      "marketing.hero.steps.3",
      "marketing.hero.workflow",
      "marketing.mobile",
      "marketing.mobile.close",
      "marketing.mobile.menu",
      "marketing.navigation",
      "marketing.navigation.footer",
      "marketing.navigation.language",
      "marketing.navigation.primary",
      "marketing.public",
      "marketing.public.allCategories",
      "marketing.public.applyFilters",
      "marketing.public.articles",
      "marketing.public.breadcrumbs",
      "marketing.public.cas",
      "marketing.public.catalog",
      "marketing.public.clearFilters",
      "marketing.public.contactDetails",
      "marketing.public.gdprNotice",
      "marketing.public.news",
      "marketing.public.nextPage",
      "marketing.public.noProducts",
      "marketing.public.noResults",
      "marketing.public.previousPage",
      "marketing.public.privacyPolicy",
      "marketing.public.productCategory",
      "marketing.public.productPagination",
      "marketing.public.quoteDetails",
      "marketing.public.results",
      "marketing.public.search",
      "marketing.public.searchAction",
      "marketing.public.searchLabel",
      "marketing.public.sequence",
      "navigation",
      "navigation.about",
      "navigation.contact",
      "navigation.home",
      "navigation.products",
      "navigation.quality",
      "navigation.services",
      "site",
      "site.name",
      "site.slogan",
    ];

    for (const dictionary of [enMessages, zhCNMessages, deMessages, frMessages, esMessages]) {
      expect(keyTree(dictionary)).toEqual(expectedKeyTree);
    }
  });
});

describe("resolveTranslation", () => {
  it("returns the requested locale without a fallback marker when present", () => {
    const result = resolveTranslation(
      [
        { locale: "en", title: "Quality" },
        { locale: "de", title: "Qualität" },
      ],
      "de",
    );

    expect(result).toEqual({ value: { locale: "de", title: "Qualität" }, usedFallback: false });
  });

  it("falls back to English when German content is missing", () => {
    const result = resolveTranslation([{ locale: "en", title: "Quality" }], "de");

    expect(result).toEqual({ value: { locale: "en", title: "Quality" }, usedFallback: true });
  });

  it("rejects an item set without its required English fallback", () => {
    expect(() => resolveTranslation([{ locale: "de", title: "Qualität" }], "fr")).toThrow(
      "English translation is required",
    );
  });
});

describe("locale proxy", () => {
  it("redirects the root request to the deterministic English URL", () => {
    const response = proxy(new NextRequest("https://example.test/"));

    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toBe("https://example.test/en");
  });

  it("does not redirect an unsupported first path segment", () => {
    const response = proxy(new NextRequest("https://example.test/it/about"));

    expect(response.headers.get("location")).toBeNull();
  });
});

describe("locale routes", () => {
  it("generates one public route for every supported locale", () => {
    expect(generateStaticParams()).toEqual([
      { locale: "en" },
      { locale: "zh-CN" },
      { locale: "de" },
      { locale: "fr" },
      { locale: "es" },
    ]);
  });

  it("rejects an unsupported locale through Next's not-found boundary", async () => {
    await expect(
      LocaleLayout({ children: null, params: Promise.resolve({ locale: "it" }) }),
    ).rejects.toThrow("NEXT_HTTP_ERROR_FALLBACK;404");
  });
});

function keyTree(value: Record<string, unknown>, prefix = ""): string[] {
  return Object.entries(value)
    .flatMap(([key, child]) => {
      const path = prefix ? `${prefix}.${key}` : key;
      return child && typeof child === "object" ? [path, ...keyTree(child as Record<string, unknown>, path)] : [path];
    })
    .sort();
}
