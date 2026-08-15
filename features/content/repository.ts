import type { Prisma, PrismaClient } from "@prisma/client";

import type { PublishedEntityType } from "@/features/content/types";
import { isLegalPageSlug } from "@/features/content/public-slug";
import { prisma } from "@/lib/db/prisma";
import type { DatabaseLocale } from "@/lib/i18n/config";

export type ContentDatabase = Pick<
  PrismaClient,
  | "page"
  | "article"
  | "product"
  | "auditLog"
  | "mediaAsset"
  | "service"
  | "siteSetting"
  | "productCategory"
  | "navigationItem"
  | "$transaction"
>;

export type PublishEntityInput = {
  type: PublishedEntityType;
  id: string;
};

export type PublicationActor = {
  id: string;
};

export type PublishedEntityRecord = {
  id: string;
  slug: string;
  publishedAt: Date;
};

const pageInclude = {
  translations: true,
  sections: {
    where: {
      status: "PUBLISHED",
      deletedAt: null,
      isEnabled: true,
    },
    orderBy: { position: "asc" },
    include: { translations: true },
  },
} satisfies Prisma.PageInclude;

const translatedCategorySelect = {
  slug: true,
  translations: true,
} satisfies Prisma.ProductCategorySelect;

const mediaSelect = {
  id: true,
  storageKey: true,
  filename: true,
  mimeType: true,
  width: true,
  height: true,
  visibility: true,
  status: true,
  deletedAt: true,
  translations: true,
} satisfies Prisma.MediaAssetSelect;

const articleInclude = {
  translations: true,
  category: {
    select: {
      slug: true,
      translations: true,
    },
  },
  tags: {
    where: { deletedAt: null },
    select: { slug: true, name: true },
  },
  coverMedia: { select: mediaSelect },
} satisfies Prisma.ArticleInclude;

const productInclude = {
  translations: true,
  category: { select: translatedCategorySelect },
  media: {
    where: {
      visibility: "PUBLIC",
      status: "PUBLISHED",
      deletedAt: null,
    },
    select: mediaSelect,
  },
} satisfies Prisma.ProductInclude;

export type TranslationRecord = {
  locale: DatabaseLocale;
  title: string;
  body: string;
};

type CategoryRecord = {
  slug: string;
  translations: TranslationRecord[];
};

export type PublishedMediaRecord = {
  id: string;
  storageKey: string;
  filename: string;
  mimeType: string;
  width: number | null;
  height: number | null;
  visibility: "PUBLIC" | "PRIVATE";
  status: "DRAFT" | "PUBLISHED" | "ARCHIVED";
  deletedAt: Date | null;
  translations: Array<TranslationRecord & { alt: string }>;
};

export type PublishedServiceRecord = {
  id: string;
  slug: string;
  translations: TranslationRecord[];
};

export type PublishedHomepageItemRecord = {
  id: string;
  key: string;
  value: unknown;
  translations: TranslationRecord[];
};

export type PublishedProductCategoryRecord = {
  id: string;
  slug: string;
  translations: TranslationRecord[];
};

export type PublishedSiteSettingRecord = PublishedHomepageItemRecord;

export type PublishedNavigationRecord = {
  id: string;
  parentId: string | null;
  href: string;
  position: number;
  translations: Array<{ locale: DatabaseLocale; title: string }>;
};

export type SitemapContentRecord = {
  kind: "page" | "service" | "product" | "article";
  slug: string;
  status: "DRAFT" | "PUBLISHED" | "ARCHIVED";
  deletedAt: Date | null;
  publishedAt: Date | null;
  updatedAt: Date;
  legalReviewStatus?: "NOT_REQUIRED" | "PENDING" | "APPROVED";
  legalReviewedAt?: Date | null;
  contentRevision?: number;
  legalReviewedRevision?: number | null;
};

export type PublishedPageRecord = {
  id: string;
  slug: string;
  publishedAt: Date | null;
  translations: Array<
    TranslationRecord & {
      seoTitle: string | null;
      seoDescription: string | null;
    }
  >;
  sections: Array<{
    id: string;
    type:
      | "HERO"
      | "SERVICES"
      | "ABOUT"
      | "FACTORY"
      | "CAPABILITIES"
      | "QUALITY"
      | "PRODUCT_CATEGORIES"
      | "GLOBAL_REACH"
      | "STATS"
      | "NEWS"
      | "CTA";
    position: number;
    config: unknown;
    translations: TranslationRecord[];
  }>;
};

export type PublishedArticleRecord = {
  id: string;
  slug: string;
  publishedAt: Date;
  translations: Array<TranslationRecord & { excerpt: string | null }>;
  category: CategoryRecord;
  tags: Array<{ slug: string; name: string }>;
  coverMedia: PublishedMediaRecord | null;
};

export type PublishedProductRecord = {
  id: string;
  slug: string;
  casNumber: string | null;
  sequence: string | null;
  specifications: unknown;
  publishedAt: Date | null;
  translations: TranslationRecord[];
  category: CategoryRecord;
  media: PublishedMediaRecord[];
};

export type PublishedProductFilters = {
  query?: string;
  category?: string;
  translationLocales?: DatabaseLocale[];
  offset?: number;
  limit?: number;
};

export interface ContentRepository {
  findPublishedPageBySlug(slug: string): Promise<PublishedPageRecord | null>;
  findApprovedLegalPageBySlug(slug: string): Promise<PublishedPageRecord | null>;
  findPublishedArticleBySlug(slug: string): Promise<PublishedArticleRecord | null>;
  findPublishedProductBySlug(slug: string): Promise<PublishedProductRecord | null>;
  findPublishedServiceBySlug(slug: string): Promise<PublishedServiceRecord | null>;
  findPublishedServices(): Promise<PublishedServiceRecord[]>;
  findPublishedProducts(filters?: PublishedProductFilters): Promise<PublishedProductRecord[]>;
  countPublishedProducts(filters?: PublishedProductFilters): Promise<number>;
  findPublishedProductCategories(): Promise<PublishedProductCategoryRecord[]>;
  findPublishedMediaByIds(ids: string[]): Promise<PublishedMediaRecord[]>;
  findPublishedServicesByIds(ids: string[]): Promise<PublishedServiceRecord[]>;
  findPublishedHomepageItemsByIds(ids: string[]): Promise<PublishedHomepageItemRecord[]>;
  findPublishedProductCategoriesByIds(ids: string[]): Promise<PublishedProductCategoryRecord[]>;
  findLatestPublishedArticles(count: number): Promise<PublishedArticleRecord[]>;
  findPublishedArticlesPage(offset: number, limit: number): Promise<PublishedArticleRecord[]>;
  countPublishedArticles(): Promise<number>;
  findPublishedSiteSettingByKey(key: string): Promise<PublishedSiteSettingRecord | null>;
  findPublishedNavigationItems(): Promise<PublishedNavigationRecord[]>;
  findSitemapContent(): Promise<SitemapContentRecord[]>;
}

export interface PublicationRepository {
  publishEntity(
    input: PublishEntityInput,
    actor: PublicationActor,
    publishedAt: Date,
  ): Promise<PublishedEntityRecord>;
}

export class LegalReviewRequiredError extends Error {
  constructor(pageId: string) {
    super(`Page ${pageId} requires an approved legal review with a review timestamp before publication`);
    this.name = "LegalReviewRequiredError";
  }
}

function publishedProductWhere(filters: PublishedProductFilters): Prisma.ProductWhereInput {
  return {
    status: "PUBLISHED",
    deletedAt: null,
    category: {
      is: {
        ...(filters.category ? { slug: filters.category } : {}),
        status: "PUBLISHED",
        deletedAt: null,
      },
    },
    ...(filters.query ? {
      OR: [
        { casNumber: { contains: filters.query, mode: "insensitive" } },
        { sequence: { contains: filters.query, mode: "insensitive" } },
        {
          translations: {
            some: {
              locale: { in: filters.translationLocales?.length ? filters.translationLocales : ["en"] },
              OR: [
                { title: { contains: filters.query, mode: "insensitive" } },
                { body: { contains: filters.query, mode: "insensitive" } },
              ],
            },
          },
        },
      ],
    } : {}),
  };
}

function requirePublicationDate<T extends { publishedAt: Date | null }>(
  record: T,
): T & { publishedAt: Date } {
  if (!record.publishedAt) {
    throw new Error(`Published record ${"id" in record ? String(record.id) : ""} has no publication date`);
  }
  return { ...record, publishedAt: record.publishedAt };
}

function isLegalReviewConstraintError(error: unknown) {
  if (!(error instanceof Error)) {
    return false;
  }

  return (
    error.message.includes("Page_published_legal_review_check") ||
    ("code" in error && error.code === "P2004" && error.message.toLowerCase().includes("legal"))
  );
}

export function createContentRepository(database: ContentDatabase) {
  return {
    findPublishedPageBySlug(slug: string): Promise<PublishedPageRecord | null> {
      return database.page.findFirst({
        where: { slug, status: "PUBLISHED", deletedAt: null },
        include: pageInclude,
      });
    },

    async findApprovedLegalPageBySlug(slug: string): Promise<PublishedPageRecord | null> {
      if (!isLegalPageSlug(slug)) return Promise.resolve(null);
      const record = await database.page.findFirst({
        where: {
          slug,
          status: "PUBLISHED",
          deletedAt: null,
          legalReviewStatus: "APPROVED",
          legalReviewedAt: { not: null },
          legalReviewedRevision: { not: null },
        },
        include: pageInclude,
      });
      return record &&
        typeof record.contentRevision === "number" &&
        typeof record.legalReviewedRevision === "number" &&
        record.legalReviewedRevision === record.contentRevision
        ? record
        : null;
    },

    async findPublishedArticleBySlug(slug: string): Promise<PublishedArticleRecord | null> {
      const record = await database.article.findFirst({
        where: {
          slug,
          status: "PUBLISHED",
          publishedAt: { not: null },
          deletedAt: null,
          category: { is: { status: "PUBLISHED", deletedAt: null } },
        },
        include: articleInclude,
      });
      return record?.publishedAt
        ? { ...record, publishedAt: record.publishedAt }
        : null;
    },

    findPublishedProductBySlug(slug: string): Promise<PublishedProductRecord | null> {
      return database.product.findFirst({
        where: {
          slug,
          status: "PUBLISHED",
          deletedAt: null,
          category: { is: { status: "PUBLISHED", deletedAt: null } },
        },
        include: productInclude,
      });
    },

    findPublishedServiceBySlug(slug: string): Promise<PublishedServiceRecord | null> {
      return database.service.findFirst({
        where: { slug, status: "PUBLISHED", deletedAt: null },
        select: { id: true, slug: true, translations: true },
      });
    },

    findPublishedServices(): Promise<PublishedServiceRecord[]> {
      return database.service.findMany({
        where: { status: "PUBLISHED", deletedAt: null },
        orderBy: [{ position: "asc" }, { id: "asc" }],
        select: { id: true, slug: true, translations: true },
      });
    },

    findPublishedProducts(filters: PublishedProductFilters = {}): Promise<PublishedProductRecord[]> {
      return database.product.findMany({
        where: publishedProductWhere(filters),
        orderBy: [{ publishedAt: "desc" }, { id: "asc" }],
        ...(filters.offset === undefined ? {} : { skip: filters.offset }),
        ...(filters.limit === undefined ? {} : { take: filters.limit }),
        include: productInclude,
      });
    },

    countPublishedProducts(filters: PublishedProductFilters = {}): Promise<number> {
      return database.product.count({ where: publishedProductWhere(filters) });
    },

    findPublishedProductCategories(): Promise<PublishedProductCategoryRecord[]> {
      return database.productCategory.findMany({
        where: { status: "PUBLISHED", deletedAt: null },
        orderBy: [{ position: "asc" }, { id: "asc" }],
        select: { id: true, slug: true, translations: true },
      });
    },

    findPublishedMediaByIds(ids: string[]): Promise<PublishedMediaRecord[]> {
      if (ids.length === 0) return Promise.resolve([]);
      return database.mediaAsset.findMany({
        where: {
          id: { in: ids },
          visibility: "PUBLIC",
          status: "PUBLISHED",
          deletedAt: null,
        },
        select: mediaSelect,
      });
    },

    findPublishedServicesByIds(ids: string[]): Promise<PublishedServiceRecord[]> {
      if (ids.length === 0) return Promise.resolve([]);
      return database.service.findMany({
        where: { id: { in: ids }, status: "PUBLISHED", deletedAt: null },
        select: { id: true, slug: true, translations: true },
      });
    },

    findPublishedHomepageItemsByIds(ids: string[]): Promise<PublishedHomepageItemRecord[]> {
      if (ids.length === 0) return Promise.resolve([]);
      return database.siteSetting.findMany({
        where: { id: { in: ids }, status: "PUBLISHED", deletedAt: null },
        select: { id: true, key: true, value: true, translations: true },
      });
    },

    findPublishedProductCategoriesByIds(ids: string[]): Promise<PublishedProductCategoryRecord[]> {
      if (ids.length === 0) return Promise.resolve([]);
      return database.productCategory.findMany({
        where: { id: { in: ids }, status: "PUBLISHED", deletedAt: null },
        select: { id: true, slug: true, translations: true },
      });
    },

    async findLatestPublishedArticles(count: number): Promise<PublishedArticleRecord[]> {
      const records = await database.article.findMany({
        where: {
          status: "PUBLISHED",
          publishedAt: { not: null },
          deletedAt: null,
          category: { is: { status: "PUBLISHED", deletedAt: null } },
        },
        orderBy: [{ publishedAt: "desc" }, { id: "asc" }],
        take: count,
        include: articleInclude,
      });
      return records.filter(
        (record): record is typeof record & { publishedAt: Date } =>
          record.publishedAt !== null,
      );
    },

    async findPublishedArticlesPage(offset: number, limit: number): Promise<PublishedArticleRecord[]> {
      const records = await database.article.findMany({
        where: {
          status: "PUBLISHED",
          publishedAt: { not: null },
          deletedAt: null,
          category: { is: { status: "PUBLISHED", deletedAt: null } },
        },
        orderBy: [{ publishedAt: "desc" }, { id: "asc" }],
        skip: offset,
        take: limit,
        include: articleInclude,
      });
      return records.filter(
        (record): record is typeof record & { publishedAt: Date } => record.publishedAt !== null,
      );
    },

    countPublishedArticles() {
      return database.article.count({
        where: {
          status: "PUBLISHED",
          publishedAt: { not: null },
          deletedAt: null,
          category: { is: { status: "PUBLISHED", deletedAt: null } },
        },
      });
    },

    findPublishedSiteSettingByKey(key: string): Promise<PublishedSiteSettingRecord | null> {
      return database.siteSetting.findFirst({
        where: { key, status: "PUBLISHED", deletedAt: null },
        select: { id: true, key: true, value: true, translations: true },
      });
    },

    findPublishedNavigationItems(): Promise<PublishedNavigationRecord[]> {
      return database.navigationItem.findMany({
        where: {
          isVisible: true,
          status: "PUBLISHED",
          deletedAt: null,
        },
        orderBy: [{ position: "asc" }, { id: "asc" }],
        select: { id: true, parentId: true, href: true, position: true, translations: true },
      });
    },

    async findSitemapContent(): Promise<SitemapContentRecord[]> {
      const [pages, services, products, articles] = await Promise.all([
        database.page.findMany({
          where: {
            status: "PUBLISHED",
            deletedAt: null,
            OR: [
              { legalReviewStatus: "NOT_REQUIRED" },
              { legalReviewStatus: "APPROVED", legalReviewedAt: { not: null }, legalReviewedRevision: { not: null } },
            ],
          },
          select: {
            slug: true,
            status: true,
            deletedAt: true,
            publishedAt: true,
            updatedAt: true,
            legalReviewStatus: true,
            legalReviewedAt: true,
            contentRevision: true,
            legalReviewedRevision: true,
          },
        }),
        database.service.findMany({
          where: { status: "PUBLISHED", deletedAt: null },
          select: {
            slug: true,
            status: true,
            deletedAt: true,
            publishedAt: true,
            updatedAt: true,
          },
        }),
        database.product.findMany({
          where: {
            status: "PUBLISHED",
            deletedAt: null,
            category: { is: { status: "PUBLISHED", deletedAt: null } },
          },
          select: {
            slug: true,
            status: true,
            deletedAt: true,
            publishedAt: true,
            updatedAt: true,
          },
        }),
        database.article.findMany({
          where: {
            status: "PUBLISHED",
            publishedAt: { not: null },
            deletedAt: null,
            category: { is: { status: "PUBLISHED", deletedAt: null } },
          },
          select: {
            slug: true,
            status: true,
            deletedAt: true,
            publishedAt: true,
            updatedAt: true,
          },
        }),
      ]);

      return [
        ...pages.map((record) => ({ ...record, kind: "page" as const })),
        ...services.map((record) => ({ ...record, kind: "service" as const })),
        ...products.map((record) => ({ ...record, kind: "product" as const })),
        ...articles.map((record) => ({ ...record, kind: "article" as const })),
      ];
    },

    async publishEntity(
      input: PublishEntityInput,
      actor: PublicationActor,
      publishedAt: Date,
    ): Promise<PublishedEntityRecord> {
      try {
        return await database.$transaction(async (transaction) => {
          let record: PublishedEntityRecord;

          if (input.type === "page") {
            const page = await transaction.page.findUniqueOrThrow({
              where: { id: input.id },
              select: {
                id: true,
                slug: true,
                legalReviewStatus: true,
                legalReviewedAt: true,
                contentRevision: true,
                legalReviewedRevision: true,
              },
            });

            if (
              page.legalReviewStatus !== "NOT_REQUIRED" &&
              (page.legalReviewStatus !== "APPROVED" ||
                page.legalReviewedAt === null ||
                page.legalReviewedRevision === null ||
                page.legalReviewedRevision !== page.contentRevision)
            ) {
              throw new LegalReviewRequiredError(page.id);
            }

            record = requirePublicationDate(await transaction.page.update({
              where: { id: input.id },
              data: { status: "PUBLISHED", publishedAt },
              select: { id: true, slug: true, publishedAt: true },
            }));
          } else if (input.type === "article") {
            await transaction.article.updateMany({
              where: { id: input.id, publishedAt: null },
              data: { publishedAt },
            });
            record = requirePublicationDate(await transaction.article.update({
              where: { id: input.id },
              data: { status: "PUBLISHED" },
              select: { id: true, slug: true, publishedAt: true },
            }));
          } else {
            record = requirePublicationDate(await transaction.product.update({
              where: { id: input.id },
              data: { status: "PUBLISHED", publishedAt },
              select: { id: true, slug: true, publishedAt: true },
            }));
          }

          await transaction.auditLog.create({
            data: {
              actorId: actor.id,
              action: "PUBLISH",
              entityType: input.type,
              entityId: record.id,
              metadata: {
                slug: record.slug,
                status: "PUBLISHED",
                publishedAt: record.publishedAt.toISOString(),
              },
            },
          });

          return record;
        });
      } catch (error) {
        if (isLegalReviewConstraintError(error)) {
          throw new LegalReviewRequiredError(input.id);
        }
        throw error;
      }
    },
  };
}

export const contentRepository = createContentRepository(prisma);
