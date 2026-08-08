import { revalidatePath, revalidateTag } from "next/cache";

import type { Locale } from "@/lib/i18n/config";

export type PublishedEntityType = "page" | "article" | "product";

type CacheInvalidation = {
  revalidatePath(path: string): void;
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
  for (const locale of locales) {
    cache.revalidatePath(publishedPath(type, slug, locale));
  }

  for (const tag of contentTags(type, slug)) {
    cache.revalidateTag(tag, "max");
  }
}
