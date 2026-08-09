import type { MetadataRoute } from "next";

import {
  isGenericPageSlug,
  isPublicContentSlug,
  LEGAL_PAGE_SLUGS,
} from "@/features/content/public-slug";
import {
  buildLanguageAlternates,
  localizedAbsoluteUrl,
} from "@/features/seo/metadata";
import { SUPPORTED_LOCALES } from "@/lib/i18n/config";

export const dynamic = "force-dynamic";

export type SitemapContentEntry = {
  kind: "page" | "service" | "product" | "article";
  slug: string;
  status: "DRAFT" | "PUBLISHED" | "ARCHIVED";
  deletedAt: string | null;
  publishedAt: string | null;
  updatedAt: string;
  legalReviewStatus?: "NOT_REQUIRED" | "PENDING" | "APPROVED";
  legalReviewedAt?: string | null;
  contentRevision?: number;
  legalReviewedRevision?: number | null;
};

const internalPageSlugs = new Set([
  "admin",
  "api",
  "preview",
  "search",
  "services",
  "legal",
]);
const legalPageSlugs = new Set<string>(LEGAL_PAGE_SLUGS);
const indexedPageSlugs = new Set([
  "home",
  "about",
  "contact",
  "products",
  "news",
  "request-a-quote",
]);

function publicRoute(entry: SitemapContentEntry): string | null {
  if (entry.status !== "PUBLISHED" || entry.deletedAt) return null;
  if (!isPublicContentSlug(entry.slug)) return null;
  if (entry.kind === "article" && !entry.publishedAt) return null;
  if (entry.kind === "page" && internalPageSlugs.has(entry.slug)) return null;

  if (entry.kind === "page" && legalPageSlugs.has(entry.slug)) {
    if (
      entry.legalReviewStatus !== "APPROVED" ||
      !entry.legalReviewedAt ||
      entry.legalReviewedRevision === null ||
      entry.legalReviewedRevision === undefined ||
      entry.legalReviewedRevision !== entry.contentRevision
    ) return null;
    return `/legal/${entry.slug}`;
  }

  if (entry.kind === "page") {
    if (!indexedPageSlugs.has(entry.slug) && !isGenericPageSlug(entry.slug)) return null;
    return entry.slug === "home" ? "/" : `/${entry.slug}`;
  }
  if (entry.kind === "article") return `/news/${entry.slug}`;
  return `/${entry.kind === "service" ? "services" : "products"}/${entry.slug}`;
}

export function buildSitemap(entries: SitemapContentEntry[]): MetadataRoute.Sitemap {
  return entries
    .flatMap((entry) => {
      const route = publicRoute(entry);
      if (!route) return [];
      const lastModified = legalPageSlugs.has(entry.slug)
        ? entry.legalReviewedAt ?? entry.updatedAt
        : entry.updatedAt;
      return SUPPORTED_LOCALES.map((locale) => ({
        url: localizedAbsoluteUrl(locale, route),
        lastModified,
        alternates: { languages: buildLanguageAlternates(route) },
      }));
    })
    .toSorted((left, right) => left.url.localeCompare(right.url));
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const { getSitemapContent } = await import("@/features/content/service");
  return buildSitemap(await getSitemapContent());
}
