import { prisma } from "@/lib/db/prisma";

import type { MediaReferences, MediaRepository } from "./service";

function jsonContainsStorageKey(value: unknown, storageKey: string): boolean {
  if (value === storageKey) return true;
  if (Array.isArray(value)) return value.some((item) => jsonContainsStorageKey(item, storageKey));
  if (value && typeof value === "object") {
    return Object.values(value).some((item) => jsonContainsStorageKey(item, storageKey));
  }
  return false;
}

export const prismaMediaRepository: MediaRepository = {
  async createMediaAsset(input) {
    return prisma.mediaAsset.create({ data: input });
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
        .filter((section) => jsonContainsStorageKey(section.config, media.storageKey))
        .map((section) => section.pageId),
    );
    const settingCount = settings.filter((setting) => jsonContainsStorageKey(setting.value, media.storageKey)).length;
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
