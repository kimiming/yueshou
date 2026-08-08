import type { Prisma, PrismaClient } from "@prisma/client";

export type ContentDatabase = Pick<PrismaClient, "page" | "article" | "product">;

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

export type PublishedPageRecord = Prisma.PageGetPayload<{ include: typeof pageInclude }>;
export type PublishedArticleRecord = Prisma.ArticleGetPayload<{ include: typeof articleInclude }>;
export type PublishedProductRecord = Prisma.ProductGetPayload<{ include: typeof productInclude }>;

export function createContentRepository(database: ContentDatabase) {
  return {
    findPublishedPageBySlug(slug: string): Promise<PublishedPageRecord | null> {
      return database.page.findFirst({
        where: { slug, status: "PUBLISHED", deletedAt: null },
        include: pageInclude,
      });
    },

    findPublishedArticleBySlug(slug: string): Promise<PublishedArticleRecord | null> {
      return database.article.findFirst({
        where: {
          slug,
          status: "PUBLISHED",
          deletedAt: null,
          category: { is: { status: "PUBLISHED", deletedAt: null } },
        },
        include: articleInclude,
      });
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
  };
}

export type ContentRepository = ReturnType<typeof createContentRepository>;
