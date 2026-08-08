import { prisma } from "@/lib/db/prisma";

import type { MediaReferences, MediaRepository } from "./service";

function jsonContainsMediaId(value: unknown, mediaId: string): boolean {
  if (value === mediaId) return true;
  if (Array.isArray(value)) return value.some((item) => jsonContainsMediaId(item, mediaId));
  if (value && typeof value === "object") {
    return Object.values(value).some((item) => jsonContainsMediaId(item, mediaId));
  }
  return false;
}

export const prismaMediaRepository: MediaRepository = {
  async createUploadIntent(input) {
    return prisma.mediaUploadIntent.create({ data: input });
  },

  async findUploadIntent(storageKey) {
    return prisma.mediaUploadIntent.findUnique({ where: { storageKey } });
  },

  async consumeUploadIntent(input) {
    return prisma.$transaction(async (transaction) => {
      const consumed = await transaction.mediaUploadIntent.updateMany({
        where: {
          id: input.intentId,
          actorId: input.actorId,
          storageKey: input.storageKey,
          consumedAt: null,
          expiresAt: { gt: input.completedAt },
        },
        data: { consumedAt: input.completedAt },
      });
      if (consumed.count !== 1) return null;

      return transaction.mediaAsset.create({
        data: {
          storageKey: input.storageKey,
          filename: input.filename,
          mimeType: input.mimeType,
          sizeBytes: input.sizeBytes,
        },
      });
    });
  },

  async getMediaAsset(id) {
    return prisma.mediaAsset.findUnique({ where: { id }, select: { id: true, storageKey: true } });
  },

  async countReferences(id): Promise<MediaReferences> {
    const media = await prisma.mediaAsset.findUnique({ where: { id }, select: { storageKey: true } });
    if (!media) return { pages: 0, products: 0, articles: 0, settings: 0 };

    const [productCount, articleCount, pageSections, settings] = await Promise.all([
      prisma.product.count({ where: { media: { some: { id } } } }),
      prisma.article.count({ where: { coverMediaId: id } }),
      prisma.pageSection.findMany({
        where: { deletedAt: null },
        select: { pageId: true, config: true },
      }),
      prisma.siteSetting.findMany({
        where: { deletedAt: null },
        select: { value: true },
      }),
    ]);

    const pageIds = new Set(
      pageSections
        .filter((section) => jsonContainsMediaId(section.config, id))
        .map((section) => section.pageId),
    );
    const settingCount = settings.filter((setting) => jsonContainsMediaId(setting.value, id)).length;
    return { pages: pageIds.size, products: productCount, articles: articleCount, settings: settingCount };
  },

  async archiveMediaAsset(id, archivedAt) {
    await prisma.mediaAsset.update({
      where: { id },
      data: { status: "ARCHIVED", deletedAt: archivedAt },
    });
  },

  async queueObjectDeletion(input) {
    await prisma.auditLog.create({
      data: {
        actorId: input.actorId,
        action: "MEDIA_DELETE_SCHEDULED",
        entityType: "MediaAsset",
        entityId: input.mediaAssetId,
        metadata: {
          storageKey: input.storageKey,
          deleteAfter: input.deleteAfter.toISOString(),
        },
      },
    });
  },
};
