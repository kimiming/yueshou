import {
  contentRepository,
  type ContentRepository,
  type PublishedArticleRecord,
  type PublishedHomepageItemRecord,
  type PublishedMediaRecord,
  type PublishedPageRecord,
  type PublishedProductCategoryRecord,
  type PublishedProductRecord,
  type PublishedServiceRecord,
} from "@/features/content/repository";
import {
  homepageItemValueSchema,
  marketingShellValueSchema,
  pageSectionSchema,
} from "@/features/content/schemas";
import type {
  ArticleViewModel,
  CategoryViewModel,
  HomepageSectionItemViewModel,
  MarketingShellContentViewModel,
  MediaViewModel,
  PageViewModel,
  ProductViewModel,
  ServiceViewModel,
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

type ResolvedHomepageSection = {
  config: unknown;
  items: HomepageSectionItemViewModel[];
  media: MediaViewModel | null;
};

function persistedSectionType(section: PublishedPageRecord["sections"][number]): PageSectionType {
  return section.type.toLowerCase().replaceAll("_", "-") as PageSectionType;
}

function mapPage(
  record: PublishedPageRecord,
  locale: Locale,
  resolvedSections: ReadonlyMap<string, ResolvedHomepageSection> = new Map(),
): PageViewModel {
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
      const resolved = resolvedSections.get(section.id);
      return {
        id: section.id,
        type: persistedSectionType(section),
        position: section.position,
        sortOrder: section.position,
        enabled: true,
        config: resolved?.config ?? section.config,
        items: resolved?.items ?? [],
        media: resolved?.media ?? null,
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

type MediaRecord = PublishedMediaRecord;

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

function mapService(record: PublishedServiceRecord, locale: Locale): ServiceViewModel {
  const translation = localized(record.translations, locale);
  return {
    id: record.id,
    slug: record.slug,
    locale,
    translationLocale: translation.translationLocale,
    usedFallback: translation.usedFallback,
    title: translation.title,
    body: translation.body,
  };
}

function mapLocalizedItem(
  record: { id: string; translations: ReadonlyArray<{ locale: string; title: string; body: string }> },
  locale: Locale,
  href?: string,
): HomepageSectionItemViewModel {
  const translation = localized(record.translations, locale);
  return {
    id: record.id,
    locale,
    translationLocale: translation.translationLocale,
    usedFallback: translation.usedFallback,
    title: translation.title,
    body: translation.body,
    ...(href ? { href } : {}),
  };
}

function orderReferences<T extends { id: string }>(ids: readonly string[], records: readonly T[]) {
  const byId = new Map(records.map((record) => [record.id, record]));
  return ids.flatMap((id) => {
    const record = byId.get(id);
    return record ? [record] : [];
  });
}

function unique(values: readonly (string | undefined)[]) {
  return [...new Set(values.filter((value): value is string => Boolean(value)))];
}

function mapHomepageSettingItem(record: PublishedHomepageItemRecord, locale: Locale) {
  const parsedValue = homepageItemValueSchema.safeParse(record.value);
  return mapLocalizedItem(record, locale, parsedValue.success ? parsedValue.data.href : undefined);
}

function mapServiceItem(record: PublishedServiceRecord, locale: Locale) {
  return mapLocalizedItem(record, locale, `/services/${record.slug}`);
}

function mapProductCategoryItem(record: PublishedProductCategoryRecord, locale: Locale) {
  return mapLocalizedItem(record, locale, `/products?category=${encodeURIComponent(record.slug)}`);
}

function mapArticleItem(record: PublishedArticleRecord, locale: Locale) {
  const article = mapArticle(record, locale);
  return {
    id: article.id,
    locale,
    translationLocale: article.translationLocale,
    usedFallback: article.usedFallback,
    title: article.title,
    body: article.excerpt ?? article.body,
    href: `/news/${article.slug}`,
  } satisfies HomepageSectionItemViewModel;
}

async function hydrateHomePage(
  repository: ContentRepository,
  record: PublishedPageRecord,
  locale: Locale,
) {
  const parsedSections = record.sections.map((section) => {
    const parsed = pageSectionSchema.safeParse({
      type: persistedSectionType(section),
      config: section.config,
    });
    if (!parsed.success) {
      throw new Error(`Invalid published homepage section config: ${section.id}`);
    }
    return { section, parsed: parsed.data };
  });

  const mediaIds = unique(parsedSections.flatMap(({ parsed }) =>
    parsed.type === "hero" || parsed.type === "about" || parsed.type === "quality"
      ? [parsed.config.imageId]
      : [],
  ));
  const serviceIds = unique(parsedSections.flatMap(({ parsed }) =>
    parsed.type === "services" ? parsed.config.serviceIds ?? [] : [],
  ));
  const itemIds = unique(parsedSections.flatMap(({ parsed }) =>
    parsed.type === "capabilities" || parsed.type === "quality" || parsed.type === "global-reach"
      ? parsed.config.itemIds ?? []
      : [],
  ));
  const categoryIds = unique(parsedSections.flatMap(({ parsed }) =>
    parsed.type === "product-categories" ? parsed.config.categoryIds ?? [] : [],
  ));
  const newsCount = parsedSections.reduce(
    (count, { parsed }) => parsed.type === "news" ? Math.max(count, parsed.config.count) : count,
    0,
  );

  const [media, services, homepageItems, categories, articles] = await Promise.all([
    repository.findPublishedMediaByIds(mediaIds),
    repository.findPublishedServicesByIds(serviceIds),
    repository.findPublishedHomepageItemsByIds(itemIds),
    repository.findPublishedProductCategoriesByIds(categoryIds),
    newsCount > 0 ? repository.findLatestPublishedArticles(newsCount) : Promise.resolve([]),
  ]);
  const mediaById = new Map(media.map((item) => [item.id, item]));
  const resolved = new Map<string, ResolvedHomepageSection>();

  for (const { section, parsed } of parsedSections) {
    let items: HomepageSectionItemViewModel[] = [];
    let imageId: string | undefined;

    switch (parsed.type) {
      case "hero":
      case "about":
        imageId = parsed.config.imageId;
        break;
      case "services":
        items = orderReferences(parsed.config.serviceIds ?? [], services)
          .map((item) => mapServiceItem(item, locale));
        break;
      case "capabilities":
      case "global-reach":
        items = orderReferences(parsed.config.itemIds ?? [], homepageItems)
          .map((item) => mapHomepageSettingItem(item, locale));
        break;
      case "quality":
        imageId = parsed.config.imageId;
        items = orderReferences(parsed.config.itemIds ?? [], homepageItems)
          .map((item) => mapHomepageSettingItem(item, locale));
        break;
      case "product-categories":
        items = orderReferences(parsed.config.categoryIds ?? [], categories)
          .map((item) => mapProductCategoryItem(item, locale));
        break;
      case "stats":
        items = (parsed.config.items ?? []).map((item, index) => ({
          id: `${section.id}-stat-${index}`,
          locale,
          translationLocale: locale,
          usedFallback: false,
          title: item.label,
          body: "",
          value: item.value,
        }));
        break;
      case "news":
        items = articles.slice(0, parsed.config.count).map((item) => mapArticleItem(item, locale));
        break;
      case "cta":
        break;
    }

    const mediaRecord = imageId ? mediaById.get(imageId) : undefined;
    resolved.set(section.id, {
      config: parsed.config,
      items,
      media: mediaRecord ? mapMedia(mediaRecord, locale) : null,
    });
  }

  return mapPage(record, locale, resolved);
}

function serviceFromRepository(repository: ContentRepository) {
  const getPageBySlug = async (localeInput: string, slug: string) => {
    const locale = validateLookup(localeInput, slug);
    const record = await repository.findPublishedPageBySlug(slug);
    return record ? mapPage(record, locale) : null;
  };

  return {
    async getHomePage(localeInput: string) {
      const locale = validateLookup(localeInput, "home");
      const record = await repository.findPublishedPageBySlug("home");
      return record ? hydrateHomePage(repository, record, locale) : null;
    },
    getPageBySlug,
    async getMarketingShell(localeInput: string): Promise<MarketingShellContentViewModel | null> {
      const locale = validateLookup(localeInput, "home");
      const [setting, navigationRecords] = await Promise.all([
        repository.findPublishedSiteSettingByKey("brand"),
        repository.findPublishedNavigationItems(),
      ]);
      if (!setting) return null;

      const settingTranslation = localized(setting.translations, locale);
      const contact = marketingShellValueSchema.parse(setting.value ?? {});
      const navigation = navigationRecords
        .map((item) => {
          const translation = resolveTranslation(item.translations, toDatabaseLocale(locale));
          return {
            id: item.id,
            label: translation.value.title,
            href: item.href,
            sortOrder: item.position,
            enabled: true as const,
          };
        })
        .toSorted((left, right) => left.sortOrder - right.sortOrder || left.id.localeCompare(right.id));

      return {
        locale,
        translationLocale: settingTranslation.translationLocale,
        usedFallback: settingTranslation.usedFallback,
        summary: settingTranslation.body,
        contact,
        navigation,
      };
    },
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
    async getPublishedService(localeInput: string, slug: string) {
      const locale = validateLookup(localeInput, slug);
      const record = await repository.findPublishedServiceBySlug(slug);
      return record ? mapService(record, locale) : null;
    },
    async getPublishedProducts(localeInput: string) {
      const locale = validateLookup(localeInput, "products");
      const records = await repository.findPublishedProducts();
      return records.map((record) => mapProduct(record, locale));
    },
    async getPublishedArticles(localeInput: string) {
      const locale = validateLookup(localeInput, "news");
      const records = await repository.findLatestPublishedArticles(30);
      return records.map((record) => mapArticle(record, locale));
    },
  };
}

export function createContentService(repository: ContentRepository) {
  return serviceFromRepository(repository);
}

const contentService = createContentService(contentRepository);

export const getHomePage = contentService.getHomePage;
export const getMarketingShell = contentService.getMarketingShell;
export const getPageBySlug = contentService.getPageBySlug;
export const getPublishedArticle = contentService.getPublishedArticle;
export const getPublishedProduct = contentService.getPublishedProduct;
export const getPublishedService = contentService.getPublishedService;
export const getPublishedProducts = contentService.getPublishedProducts;
export const getPublishedArticles = contentService.getPublishedArticles;
