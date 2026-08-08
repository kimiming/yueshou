import type { PrismaClient } from "@prisma/client";

import {
  invalidatePublishedEntity,
  type PublishedEntityType,
} from "@/features/publishing/cache";
import { prisma } from "@/lib/db/prisma";
import { SUPPORTED_LOCALES } from "@/lib/i18n/config";

export type PublishEntityInput = {
  type: PublishedEntityType;
  id: string;
};

export type PublicationActor = {
  id: string;
};

type PublishDependencies = {
  database: PrismaClient;
  invalidate: typeof invalidatePublishedEntity;
  now: () => Date;
};

const defaultDependencies: PublishDependencies = {
  database: prisma,
  invalidate: invalidatePublishedEntity,
  now: () => new Date(),
};

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

export async function publishEntity(
  input: PublishEntityInput,
  actor: PublicationActor,
  dependencies: PublishDependencies = defaultDependencies,
) {
  if (!input.id.trim()) {
    throw new Error("Entity id is required");
  }
  if (!actor.id.trim()) {
    throw new Error("Publication actor id is required");
  }

  const publishedAt = dependencies.now();

  try {
    const entity = await dependencies.database.$transaction(async (transaction) => {
      let record: { id: string; slug: string };

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
        await transaction.article.findUniqueOrThrow({
          where: { id: input.id },
          select: { id: true, slug: true },
        });
        record = await transaction.article.update({
          where: { id: input.id },
          data: { status: "PUBLISHED", publishedAt },
          select: { id: true, slug: true },
        });
      } else {
        await transaction.product.findUniqueOrThrow({
          where: { id: input.id },
          select: { id: true, slug: true },
        });
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

    dependencies.invalidate(input.type, entity.slug, SUPPORTED_LOCALES);

    return {
      id: entity.id,
      slug: entity.slug,
      type: input.type,
      status: "PUBLISHED" as const,
      publishedAt: publishedAt.toISOString(),
    };
  } catch (error) {
    if (isLegalReviewConstraintError(error)) {
      throw new LegalReviewRequiredError(input.id);
    }
    throw error;
  }
}
