import type { Locale } from "@/lib/i18n/config";

export function localizeHref(href: string, locale: Locale) {
  if (!href.startsWith("/") || href.startsWith("//")) {
    return href;
  }

  if (href === "/") {
    return `/${locale}`;
  }

  const localePrefix = /^\/(?:en|zh-CN|de|fr|es)(?:\/|$)/;
  return localePrefix.test(href) ? href : `/${locale}${href}`;
}
