import { prisma } from "@/lib/db/prisma";
import {
  isLocale,
  toDatabaseLocale,
  type DatabaseLocale,
  type Locale,
} from "@/lib/i18n/config";
import { resolveTranslation } from "@/lib/i18n/resolve-translation";

export const SEARCH_QUERY_MAX_LENGTH = 100;
export const SEARCH_RESULT_LIMIT = 30;

type SearchTranslation = {
  locale: DatabaseLocale;
  title: string;
  body: string;
};

type SearchRecord = {
  id: string;
  slug: string;
  translations: SearchTranslation[];
};

type SearchProductRecord = SearchRecord & {
  casNumber: string | null;
  sequence: string | null;
};

type SearchArticleRecord = SearchRecord & {
  publishedAt: Date | null;
};

type FindMany<T> = {
  findMany(args: unknown): Promise<T[]>;
};

export type ContentSearchDatabase = {
  product: FindMany<SearchProductRecord>;
  service: FindMany<SearchRecord>;
  page: FindMany<SearchRecord>;
  article: FindMany<SearchArticleRecord>;
};

export type SearchResultType = "product" | "service" | "page" | "article";

export type SearchResultViewModel = {
  id: string;
  type: SearchResultType;
  title: string;
  excerpt: string;
  href: string;
  relevance: number;
  publishedAt: string | null;
};

export function normalizeSearchQuery(input: string) {
  return Array.from(input.normalize("NFC").trim().replace(/\s+/gu, " "))
    .slice(0, SEARCH_QUERY_MAX_LENGTH)
    .join("");
}

export function escapeLikePattern(input: string) {
  return input.replace(/[\\%_]/gu, "\\$&");
}

function lower(value: string | null | undefined) {
  return value?.normalize("NFC").toLocaleLowerCase() ?? "";
}

function relevance(
  type: SearchResultType,
  query: string,
  translation: SearchTranslation,
  record: SearchProductRecord | SearchRecord,
) {
  const needle = lower(query);
  const title = lower(translation.title);
  const body = lower(translation.body);
  if (title === needle) return 500;
  if (title.startsWith(needle)) return 400;
  if (title.includes(needle)) return 300;
  if (type === "product" && "casNumber" in record && lower(record.casNumber).includes(needle)) {
    return 200;
  }
  if (type === "product" && "sequence" in record && lower(record.sequence).includes(needle)) {
    return 150;
  }
  if (body.includes(needle)) return 100;
  return 0;
}

function excerpt(body: string) {
  const text = body.replace(/<[^>]*>/gu, " ").replace(/\s+/gu, " ").trim();
  return Array.from(text).slice(0, 180).join("");
}

const LEGAL_SLUGS = new Set([
  "terms",
  "privacy",
  "ruo-policy",
  "shipping-compliance",
  "cookie-policy",
]);

function resultHref(type: SearchResultType, slug: string, locale: Locale) {
  if (type === "product") return `/${locale}/products/${slug}`;
  if (type === "service") return `/${locale}/services/${slug}`;
  if (type === "article") return `/${locale}/news/${slug}`;
  return LEGAL_SLUGS.has(slug) ? `/${locale}/legal/${slug}` : `/${locale}/${slug}`;
}

function mapResult(
  type: SearchResultType,
  record: SearchProductRecord | SearchArticleRecord | SearchRecord,
  locale: Locale,
  query: string,
): SearchResultViewModel | null {
  const resolved = resolveTranslation(record.translations, toDatabaseLocale(locale));
  const score = relevance(type, query, resolved.value, record);
  if (score === 0) return null;
  return {
    id: record.id,
    type,
    title: resolved.value.title,
    excerpt: excerpt(resolved.value.body),
    href: resultHref(type, record.slug, locale),
    relevance: score,
    publishedAt:
      "publishedAt" in record && record.publishedAt
        ? record.publishedAt.toISOString()
        : null,
  };
}

const typeOrder: Record<SearchResultType, number> = {
  page: 0,
  product: 1,
  service: 2,
  article: 3,
};

export function createContentSearch(database: ContentSearchDatabase) {
  return async (localeInput: string, queryInput: string): Promise<SearchResultViewModel[]> => {
    if (!isLocale(localeInput)) throw new Error(`Invalid locale: ${localeInput}`);
    const query = normalizeSearchQuery(queryInput);
    if (!query) return [];

    const locale = localeInput;
    const databaseLocale = toDatabaseLocale(locale);
    const escapedQuery = escapeLikePattern(query);
    const textFilter = { contains: escapedQuery, mode: "insensitive" as const };
    const translationWhere = {
      locale: databaseLocale,
      OR: [{ title: textFilter }, { body: textFilter }],
    };
    const translationSelect = {
      where: { locale: { in: [...new Set<DatabaseLocale>([databaseLocale, "en"])] } },
      select: { locale: true, title: true, body: true },
    };

    const [products, services, pages, articles] = await Promise.all([
      database.product.findMany({
        where: {
          status: "PUBLISHED",
          deletedAt: null,
          category: { is: { status: "PUBLISHED", deletedAt: null } },
          OR: [
            { casNumber: textFilter },
            { sequence: textFilter },
            { translations: { some: translationWhere } },
          ],
        },
        orderBy: { id: "asc" },
        take: SEARCH_RESULT_LIMIT,
        select: {
          id: true,
          slug: true,
          casNumber: true,
          sequence: true,
          translations: translationSelect,
        },
      }),
      database.service.findMany({
        where: {
          status: "PUBLISHED",
          deletedAt: null,
          translations: { some: translationWhere },
        },
        orderBy: [{ position: "asc" }, { id: "asc" }],
        take: SEARCH_RESULT_LIMIT,
        select: { id: true, slug: true, translations: translationSelect },
      }),
      database.page.findMany({
        where: {
          status: "PUBLISHED",
          deletedAt: null,
          translations: { some: translationWhere },
        },
        orderBy: { id: "asc" },
        take: SEARCH_RESULT_LIMIT,
        select: { id: true, slug: true, translations: translationSelect },
      }),
      database.article.findMany({
        where: {
          status: "PUBLISHED",
          deletedAt: null,
          category: { is: { status: "PUBLISHED", deletedAt: null } },
          translations: { some: translationWhere },
        },
        orderBy: [{ publishedAt: "desc" }, { id: "asc" }],
        take: SEARCH_RESULT_LIMIT,
        select: {
          id: true,
          slug: true,
          publishedAt: true,
          translations: translationSelect,
        },
      }),
    ]);

    return [
      ...products.map((record) => mapResult("product", record, locale, query)),
      ...services.map((record) => mapResult("service", record, locale, query)),
      ...pages.map((record) => mapResult("page", record, locale, query)),
      ...articles.map((record) => mapResult("article", record, locale, query)),
    ]
      .filter((result): result is SearchResultViewModel => result !== null)
      .toSorted(
        (left, right) =>
          right.relevance - left.relevance ||
          typeOrder[left.type] - typeOrder[right.type] ||
          left.title.localeCompare(right.title, locale) ||
          left.id.localeCompare(right.id),
      )
      .slice(0, SEARCH_RESULT_LIMIT);
  };
}

export const searchPublishedContent = createContentSearch(
  prisma as unknown as ContentSearchDatabase,
);
