import {
  contentRepository,
  type ContentRepository,
  type PublishedArticleRecord,
  type PublishedPageRecord,
  type PublishedProductRecord,
} from "@/features/content/repository";
import type {
  ArticleViewModel,
  CategoryViewModel,
  MediaViewModel,
  PageViewModel,
  ProductViewModel,
} from "@/features/content/view-models";
import type { PageSectionType } from "@/features/content/types";
import {
  fromDatabaseLocale,
  isLocale,
  toDatabaseLocale,
  type DatabaseLocale,
  type Locale,
} from "@/lib/i18n/config";
import { resolveTranslation } from "@/lib/i18n/resolve-translation";

const slugPattern = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

function validateLookup(locale: string, slug: string): Locale {
  if (!isLocale(locale)) {
    throw new Error(`Invalid locale: ${locale}`);
  }

  if (!slugPattern.test(slug)) {
    throw new Error(`Invalid slug: ${slug}`);
  }

  return locale;
}

function translationLocale(locale: string): Locale {
  return fromDatabaseLocale(locale as DatabaseLocale);
}

function localized<T extends { locale: string; title: string; body: string }>(
  translations: readonly T[],
  locale: Locale,
) {
  const resolved = resolveTranslation(translations, toDatabaseLocale(locale));

  return {
    value: resolved.value,
    locale,
    translationLocale: translationLocale(resolved.value.locale),
    usedFallback: resolved.usedFallback,
    title: resolved.value.title,
    body: resolved.value.body,
  };
}

function mapPage(record: PublishedPageRecord, locale: Locale): PageViewModel {
  const page = localized(record.translations, locale);

  return {
    id: record.id,
    slug: record.slug,
    locale,
    translationLocale: page.translationLocale,
    usedFallback: page.usedFallback,
    title: page.title,
    body: page.body,
    seoTitle: page.value.seoTitle,
    seoDescription: page.value.seoDescription,
    publishedAt: record.publishedAt?.toISOString() ?? null,
    sections: record.sections.map((section) => {
      const translation = localized(section.translations, locale);
      return {
        id: section.id,
        type: section.type.toLowerCase().replaceAll("_", "-") as PageSectionType,
        position: section.position,
        config: section.config,
        locale,
        translationLocale: translation.translationLocale,
        usedFallback: translation.usedFallback,
        title: translation.title,
        body: translation.body,
      };
    }),
  };
}

type TranslatedCategory = {
  slug: string;
  translations: ReadonlyArray<{ locale: string; title: string; body: string }>;
};

function mapCategory(category: TranslatedCategory, locale: Locale): CategoryViewModel {
  const translation = localized(category.translations, locale);
  return {
    slug: category.slug,
    locale,
    translationLocale: translation.translationLocale,
    usedFallback: translation.usedFallback,
    title: translation.title,
    body: translation.body,
  };
}

type MediaRecord = NonNullable<PublishedArticleRecord["coverMedia"]>;

function mapMedia(record: MediaRecord, locale: Locale): MediaViewModel {
  const translation = localized(record.translations, locale);
  return {
    id: record.id,
    storageKey: record.storageKey,
    filename: record.filename,
    mimeType: record.mimeType,
    width: record.width,
    height: record.height,
    locale,
    translationLocale: translation.translationLocale,
    usedFallback: translation.usedFallback,
    title: translation.title,
    alt: translation.value.alt,
  };
}

function isPublicMedia(record: MediaRecord) {
  return record.visibility === "PUBLIC" && record.status === "PUBLISHED" && record.deletedAt === null;
}

function mapArticle(record: PublishedArticleRecord, locale: Locale): ArticleViewModel {
  const translation = localized(record.translations, locale);
  return {
    id: record.id,
    slug: record.slug,
    locale,
    translationLocale: translation.translationLocale,
    usedFallback: translation.usedFallback,
    title: translation.title,
    body: translation.body,
    excerpt: translation.value.excerpt,
    publishedAt: record.publishedAt?.toISOString() ?? null,
    category: mapCategory(record.category, locale),
    tags: record.tags.map((tag) => ({ slug: tag.slug, name: tag.name })),
    coverMedia:
      record.coverMedia && isPublicMedia(record.coverMedia)
        ? mapMedia(record.coverMedia, locale)
        : null,
  };
}

function mapProduct(record: PublishedProductRecord, locale: Locale): ProductViewModel {
  const translation = localized(record.translations, locale);
  return {
    id: record.id,
    slug: record.slug,
    locale,
    translationLocale: translation.translationLocale,
    usedFallback: translation.usedFallback,
    title: translation.title,
    body: translation.body,
    casNumber: record.casNumber,
    sequence: record.sequence,
    specifications: record.specifications,
    publishedAt: record.publishedAt?.toISOString() ?? null,
    category: mapCategory(record.category, locale),
    media: record.media.map((item) => mapMedia(item, locale)),
  };
}

function serviceFromRepository(repository: ContentRepository) {
  const getPageBySlug = async (localeInput: string, slug: string) => {
    const locale = validateLookup(localeInput, slug);
    const record = await repository.findPublishedPageBySlug(slug);
    return record ? mapPage(record, locale) : null;
  };

  return {
    getHomePage(locale: string) {
      return getPageBySlug(locale, "home");
    },
    getPageBySlug,
    async getPublishedArticle(localeInput: string, slug: string) {
      const locale = validateLookup(localeInput, slug);
      const record = await repository.findPublishedArticleBySlug(slug);
      return record ? mapArticle(record, locale) : null;
    },
    async getPublishedProduct(localeInput: string, slug: string) {
      const locale = validateLookup(localeInput, slug);
      const record = await repository.findPublishedProductBySlug(slug);
      return record ? mapProduct(record, locale) : null;
    },
  };
}

export function createContentService(repository: ContentRepository) {
  return serviceFromRepository(repository);
}

const contentService = createContentService(contentRepository);

export const getHomePage = contentService.getHomePage;
export const getPageBySlug = contentService.getPageBySlug;
export const getPublishedArticle = contentService.getPublishedArticle;
export const getPublishedProduct = contentService.getPublishedProduct;
