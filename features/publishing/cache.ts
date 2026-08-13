import { revalidatePath, revalidateTag } from "next/cache";

import type { PublishedEntityType } from "@/features/content/types";
import { isLegalPageSlug } from "@/features/content/public-slug";
import type { Locale } from "@/lib/i18n/config";

export type { PublishedEntityType } from "@/features/content/types";

export type ContentCacheEntityType = PublishedEntityType | "service";

type CacheInvalidation = {
  revalidatePath(path: string, type?: "layout" | "page"): void;
  revalidateTag(tag: string, profile: "max" | { expire: 0 }): void;
};

const defaultCacheInvalidation: CacheInvalidation = {
  revalidatePath,
  revalidateTag,
};

export function contentTags(type: ContentCacheEntityType, slug: string) {
  return [`${type}:${slug}`, `${type}:list`];
}

function publishedPath(type: ContentCacheEntityType, slug: string, locale: Locale) {
  if (type === "article") {
    return `/${locale}/news/${slug}`;
  }

  if (type === "product") {
    return `/${locale}/products/${slug}`;
  }

  if (type === "service") {
    return `/${locale}/services/${slug}`;
  }

  if (isLegalPageSlug(slug)) {
    return `/${locale}/legal/${slug}`;
  }

  return slug === "home" ? `/${locale}` : `/${locale}/${slug}`;
}

export function invalidatePublishedEntity(
  type: ContentCacheEntityType,
  slug: string,
  locales: readonly Locale[],
  cache: CacheInvalidation = defaultCacheInvalidation,
) {
  const paths = new Set(locales.map((locale) => publishedPath(type, slug, locale)));
  for (const path of paths) {
    cache.revalidatePath(path);
  }

  const tags = new Set([...contentTags(type, slug), "page:home", "sitemap:content"]);
  for (const tag of tags) {
    cache.revalidateTag(tag, { expire: 0 });
  }
}

export function invalidatePublishedCollection(
  type: "article" | "product",
  locales: readonly Locale[],
  cache: CacheInvalidation = defaultCacheInvalidation,
) {
  const collection = type === "article" ? "news" : "products";
  for (const locale of new Set(locales)) {
    cache.revalidatePath(`/${locale}/${collection}`);
  }
  const tags = new Set([
    `${type}:list`,
    ...(type === "product" ? ["product-category:list"] : []),
    "page:home",
    "sitemap:content",
  ]);
  for (const tag of tags) cache.revalidateTag(tag, { expire: 0 });
}

export function invalidateMarketingShell(
  locales: readonly Locale[],
  cache: CacheInvalidation = defaultCacheInvalidation,
) {
  for (const locale of new Set(locales)) {
    cache.revalidatePath(`/${locale}`, "layout");
  }
  cache.revalidateTag("site:global", { expire: 0 });
  cache.revalidateTag("media:global", { expire: 0 });
}
