import { prisma } from "@/lib/db/prisma";
import {
  isLocale,
  fromDatabaseLocale,
  toDatabaseLocale,
  type DatabaseLocale,
  type Locale,
} from "@/lib/i18n/config";
import { isLegalPageSlug, LEGAL_PAGE_SLUGS } from "@/features/content/public-slug";

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
  contentRevision?: number;
  legalReviewedRevision?: number | null;
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
  translationLocale: Locale;
  usedFallback: boolean;
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

function resultHref(type: SearchResultType, slug: string, locale: Locale) {
  if (type === "product") return `/${locale}/products/${slug}`;
  if (type === "service") return `/${locale}/services/${slug}`;
  if (type === "article") return `/${locale}/news/${slug}`;
  if (slug === "home") return `/${locale}`;
  return isLegalPageSlug(slug) ? `/${locale}/legal/${slug}` : `/${locale}/${slug}`;
}

function mapResult(
  type: SearchResultType,
  record: SearchProductRecord | SearchArticleRecord | SearchRecord,
  locale: Locale,
  query: string,
): SearchResultViewModel | null {
  const requestedLocale = toDatabaseLocale(locale);
  const requested = record.translations.find((translation) => translation.locale === requestedLocale);
  const english = record.translations.find((translation) => translation.locale === "en");
  if (!english) throw new Error("English translation is required");
  const requestedScore = requested ? relevance(type, query, requested, record) : 0;
  const selected = requested && requestedScore > 0 ? requested : english;
  const score = requestedScore > 0 ? requestedScore : relevance(type, query, english, record);
  if (score === 0) return null;
  return {
    id: record.id,
    type,
    title: selected.title,
    excerpt: excerpt(selected.body),
    href: resultHref(type, record.slug, locale),
    relevance: score,
    publishedAt:
      "publishedAt" in record && record.publishedAt
        ? record.publishedAt.toISOString()
        : null,
    translationLocale: fromDatabaseLocale(selected.locale),
    usedFallback: selected.locale !== requestedLocale,
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
    const translationLocales = [...new Set<DatabaseLocale>([databaseLocale, "en"])];
    const translationWhere = {
      locale: { in: translationLocales },
      OR: [{ title: textFilter }, { body: textFilter }],
    };
    const translationSelect = {
      where: { locale: { in: translationLocales } },
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
          OR: [
            { slug: { notIn: [...LEGAL_PAGE_SLUGS] } },
            { legalReviewStatus: "APPROVED", legalReviewedAt: { not: null }, legalReviewedRevision: { not: null } },
          ],
          translations: { some: translationWhere },
        },
        orderBy: { id: "asc" },
        take: SEARCH_RESULT_LIMIT,
        select: { id: true, slug: true, contentRevision: true, legalReviewedRevision: true, translations: translationSelect },
      }),
      database.article.findMany({
        where: {
          status: "PUBLISHED",
          publishedAt: { not: null },
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
      ...pages
        .filter((record) => !isLegalPageSlug(record.slug) || (
          typeof record.contentRevision === "number" &&
          typeof record.legalReviewedRevision === "number" &&
          record.legalReviewedRevision === record.contentRevision
        ))
        .map((record) => mapResult("page", record, locale, query)),
      ...articles
        .filter((record) => record.publishedAt !== null)
        .map((record) => mapResult("article", record, locale, query)),
    ]
      .filter((result): result is SearchResultViewModel => result !== null)
      .toSorted(
        (left, right) =>
          Number(left.usedFallback) - Number(right.usedFallback) ||
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
