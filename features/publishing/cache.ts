import { revalidatePath, revalidateTag } from "next/cache";

import type { PublishedEntityType } from "@/features/content/types";
import type { Locale } from "@/lib/i18n/config";

export type { PublishedEntityType } from "@/features/content/types";

type CacheInvalidation = {
  revalidatePath(path: string, type?: "layout" | "page"): void;
  revalidateTag(tag: string, profile: "max"): void;
};

const defaultCacheInvalidation: CacheInvalidation = {
  revalidatePath,
  revalidateTag,
};

export function contentTags(type: PublishedEntityType, slug: string) {
  return [`${type}:${slug}`, `${type}:list`];
}

function publishedPath(type: PublishedEntityType, slug: string, locale: Locale) {
  if (type === "article") {
    return `/${locale}/news/${slug}`;
  }

  if (type === "product") {
    return `/${locale}/products/${slug}`;
  }

  return slug === "home" ? `/${locale}` : `/${locale}/${slug}`;
}

export function invalidatePublishedEntity(
  type: PublishedEntityType,
  slug: string,
  locales: readonly Locale[],
  cache: CacheInvalidation = defaultCacheInvalidation,
) {
  const paths = new Set(locales.map((locale) => publishedPath(type, slug, locale)));
  for (const path of paths) {
    cache.revalidatePath(path);
  }

  const tags = new Set([...contentTags(type, slug), "page:home"]);
  for (const tag of tags) {
    cache.revalidateTag(tag, "max");
  }
}

export function invalidateMarketingShell(
  locales: readonly Locale[],
  cache: CacheInvalidation = defaultCacheInvalidation,
) {
  for (const locale of new Set(locales)) {
    cache.revalidatePath(`/${locale}`, "layout");
  }
  cache.revalidateTag("site:global", "max");
  cache.revalidateTag("media:global", "max");
}
