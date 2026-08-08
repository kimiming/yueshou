import type { Prisma, PrismaClient } from "@prisma/client";

import type { PublishedEntityType } from "@/features/content/types";
import { prisma } from "@/lib/db/prisma";
import type { DatabaseLocale } from "@/lib/i18n/config";

export type ContentDatabase = Pick<
  PrismaClient,
  "page" | "article" | "product" | "auditLog" | "$transaction"
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

type TranslationRecord = {
  locale: DatabaseLocale;
  title: string;
  body: string;
};

type CategoryRecord = {
  slug: string;
  translations: TranslationRecord[];
};

type MediaRecord = {
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
    type: "HERO" | "SERVICES" | "ABOUT" | "CAPABILITIES" | "QUALITY" | "STATS" | "NEWS" | "CTA";
    position: number;
    config: unknown;
    translations: TranslationRecord[];
  }>;
};

export type PublishedArticleRecord = {
  id: string;
  slug: string;
  publishedAt: Date | null;
  translations: Array<TranslationRecord & { excerpt: string | null }>;
  category: CategoryRecord;
  tags: Array<{ slug: string; name: string }>;
  coverMedia: MediaRecord | null;
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
  media: MediaRecord[];
};

export interface ContentRepository {
  findPublishedPageBySlug(slug: string): Promise<PublishedPageRecord | null>;
  findPublishedArticleBySlug(slug: string): Promise<PublishedArticleRecord | null>;
  findPublishedProductBySlug(slug: string): Promise<PublishedProductRecord | null>;
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
              },
            });

            if (
              page.legalReviewStatus !== "NOT_REQUIRED" &&
              (page.legalReviewStatus !== "APPROVED" || page.legalReviewedAt === null)
            ) {
              throw new LegalReviewRequiredError(page.id);
            }

            record = await transaction.page.update({
              where: { id: input.id },
              data: { status: "PUBLISHED", publishedAt },
              select: { id: true, slug: true },
            });
          } else if (input.type === "article") {
            record = await transaction.article.update({
              where: { id: input.id },
              data: { status: "PUBLISHED", publishedAt },
              select: { id: true, slug: true },
            });
          } else {
            record = await transaction.product.update({
              where: { id: input.id },
              data: { status: "PUBLISHED", publishedAt },
              select: { id: true, slug: true },
            });
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
                publishedAt: publishedAt.toISOString(),
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
