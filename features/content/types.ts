export const contentLocales = ["en", "zh-CN", "de", "fr", "es"] as const;

export type ContentLocale = (typeof contentLocales)[number];

export type PublishedEntityType = "page" | "article" | "product";

export const pageSectionTypes = [
  "hero",
  "services",
  "about",
  "capabilities",
  "quality",
  "stats",
  "news",
  "cta",
] as const;

export type PageSectionType = (typeof pageSectionTypes)[number];
