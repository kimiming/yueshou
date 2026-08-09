export const SUPPORTED_LOCALES = ["en", "zh-CN", "de", "fr", "es"] as const;

export type Locale = (typeof SUPPORTED_LOCALES)[number];
export type DatabaseLocale = "en" | "zh_CN" | "de" | "fr" | "es";

export const DEFAULT_LOCALE: Locale = "en";

const databaseLocaleByLocale: Record<Locale, DatabaseLocale> = {
  en: "en",
  "zh-CN": "zh_CN",
  de: "de",
  fr: "fr",
  es: "es",
};

const localeByDatabaseLocale: Record<DatabaseLocale, Locale> = {
  en: "en",
  zh_CN: "zh-CN",
  de: "de",
  fr: "fr",
  es: "es",
};

export function isLocale(value: string): value is Locale {
  return (SUPPORTED_LOCALES as readonly string[]).includes(value);
}

export function toDatabaseLocale(locale: Locale): DatabaseLocale {
  return databaseLocaleByLocale[locale];
}

export function fromDatabaseLocale(locale: DatabaseLocale): Locale {
  return localeByDatabaseLocale[locale];
}
