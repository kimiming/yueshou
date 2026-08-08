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
