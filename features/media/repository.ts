import { prisma } from "@/lib/db/prisma";
import { randomUUID } from "node:crypto";

import type { MediaReferences, MediaRepository } from "./service";
import type { MediaDeletionJobRepository } from "./deletion-worker";

function jsonContainsMediaId(value: unknown, mediaId: string): boolean {
  if (value === mediaId) return true;
  if (Array.isArray(value)) return value.some((item) => jsonContainsMediaId(item, mediaId));
  if (value && typeof value === "object") {
    return Object.values(value).some((item) => jsonContainsMediaId(item, mediaId));
  }
  return false;
}

export const prismaMediaRepository: MediaRepository = {
  async archiveWithReferences({ actorId, mediaAssetId, archivedAt, deleteAfter }) {
    return prisma.$transaction(async (tx) => {
      const media = await tx.mediaAsset.findUnique({ where: { id: mediaAssetId }, select: { id: true } });
      if (!media) throw new Error("Media asset not found");
      const existingJob = await tx.mediaDeletionJob.findUnique({ where: { mediaAssetId }, select: { status: true, deleteAfter: true } });
      if (existingJob) {
        await tx.auditLog.create({ data: { actorId, action: existingJob.status === "COMPLETED" ? "MEDIA_ARCHIVE_ALREADY_COMPLETED" : "MEDIA_ARCHIVE_ALREADY_QUEUED", entityType: "MediaAsset", entityId: mediaAssetId, metadata: { status: existingJob.status, deleteAfter: existingJob.deleteAfter.toISOString() } } });
        return { retained: existingJob.status === "COMPLETED", deleteAfter: existingJob.status === "COMPLETED" ? null : existingJob.deleteAfter };
      }
      const [products, articles, sections, settings] = await Promise.all([
        tx.product.count({ where: { media: { some: { id: mediaAssetId } } } }),
        tx.article.count({ where: { coverMediaId: mediaAssetId } }),
        tx.pageSection.findMany({ where: { deletedAt: null }, select: { pageId: true, config: true } }),
        tx.siteSetting.findMany({ where: { deletedAt: null }, select: { value: true } }),
      ]);
      const pages = new Set(sections.filter((section) => jsonContainsMediaId(section.config, mediaAssetId)).map((section) => section.pageId)).size;
      const settingCount = settings.filter((setting) => jsonContainsMediaId(setting.value, mediaAssetId)).length;
      const retained = products + articles + pages + settingCount > 0;
      await tx.mediaAsset.update({ where: { id: mediaAssetId }, data: { status: "ARCHIVED", deletedAt: archivedAt } });
      if (!retained) await tx.mediaDeletionJob.create({ data: { mediaAssetId, storageKey: (await tx.mediaAsset.findUniqueOrThrow({ where: { id: mediaAssetId }, select: { storageKey: true } })).storageKey, deleteAfter } });
      await tx.auditLog.create({ data: { actorId, action: retained ? "MEDIA_ARCHIVED_RETAINED" : "MEDIA_ARCHIVED_QUEUED", entityType: "MediaAsset", entityId: mediaAssetId, metadata: { retained, deleteAfter: retained ? null : deleteAfter.toISOString() } } });
      return { retained, deleteAfter: retained ? null : deleteAfter };
    });
  },
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
    await prisma.$transaction(async (tx) => {
      const existing = await tx.mediaDeletionJob.findUnique({ where: { mediaAssetId: input.mediaAssetId }, select: { id: true } });
      if (existing) return;
      await tx.mediaDeletionJob.create({ data: { mediaAssetId: input.mediaAssetId, storageKey: input.storageKey, deleteAfter: input.deleteAfter } });
      await tx.auditLog.create({
        data: {
          actorId: input.actorId,
          action: "MEDIA_DELETE_SCHEDULED",
          entityType: "MediaAsset",
          entityId: input.mediaAssetId,
          metadata: { storageKey: input.storageKey, deleteAfter: input.deleteAfter.toISOString() },
        },
      });
    });
  },
};

export const prismaMediaDeletionJobRepository: MediaDeletionJobRepository = {
  async claimDue(now) {
    return prisma.$transaction(async (tx) => {
      const job = await tx.mediaDeletionJob.findFirst({ where: { deleteAfter: { lte: now }, OR: [{ status: "PENDING" }, { status: "FAILED", leaseUntil: { lt: now } }, { status: "PROCESSING", leaseUntil: { lt: now } }] }, orderBy: { deleteAfter: "asc" } });
      if (!job) return null;
      const leaseToken = randomUUID();
      const claimed = await tx.mediaDeletionJob.updateMany({ where: { id: job.id, deleteAfter: job.deleteAfter, OR: [{ status: "PENDING", leaseToken: null }, { status: "FAILED", leaseUntil: { lt: now }, leaseToken: null }, { status: "PROCESSING", leaseUntil: { lt: now } }] }, data: { status: "PROCESSING", attempts: { increment: 1 }, leaseUntil: new Date(now.getTime() + 5 * 60_000), leaseToken } });
      return claimed.count === 1 ? { id: job.id, storageKey: job.storageKey, attempts: job.attempts + 1, leaseToken } : null;
    });
  },
  async confirmDeletable(id, leaseToken) {
    return prisma.$transaction(async (tx) => {
      const job = await tx.mediaDeletionJob.findFirst({ where: { id, status: "PROCESSING", leaseToken }, select: { mediaAssetId: true, deleteAfter: true, leaseUntil: true } });
      if (!job?.leaseUntil || job.leaseUntil <= new Date()) return null;
      const [products, articles, sections, settings] = await Promise.all([
        tx.product.count({ where: { media: { some: { id: job.mediaAssetId } } } }),
        tx.article.count({ where: { coverMediaId: job.mediaAssetId } }),
        tx.pageSection.findMany({ where: { deletedAt: null }, select: { config: true } }),
        tx.siteSetting.findMany({ where: { deletedAt: null }, select: { value: true } }),
      ]);
      const referenced = products + articles + sections.filter((section) => jsonContainsMediaId(section.config, job.mediaAssetId)).length + settings.filter((setting) => jsonContainsMediaId(setting.value, job.mediaAssetId)).length > 0;
      if (referenced) {
        const cancelled = await tx.mediaDeletionJob.updateMany({ where: { id, status: "PROCESSING", leaseToken, deleteAfter: job.deleteAfter, leaseUntil: job.leaseUntil }, data: { status: "COMPLETED", completedAt: new Date(), leaseUntil: null, leaseToken: null, lastError: "Deletion cancelled because the asset was referenced again" } });
        if (cancelled.count === 1) await tx.auditLog.create({ data: { action: "MEDIA_DELETION_CANCELLED_REFERENCED", entityType: "MediaAsset", entityId: job.mediaAssetId, metadata: { jobId: id } } });
        return null;
      }
      const authorized = await tx.mediaDeletionJob.updateMany({ where: { id, status: "PROCESSING", leaseToken, deleteAfter: job.deleteAfter, leaseUntil: job.leaseUntil }, data: { status: "DELETING" } });
      return authorized.count === 1 ? { authorizationToken: leaseToken } : null;
    });
  },
  async complete(id, leaseToken, completedAt) { await prisma.mediaDeletionJob.updateMany({ where: { id, status: "DELETING", leaseToken }, data: { status: "COMPLETED", completedAt, leaseUntil: null, leaseToken: null, lastError: null } }); },
  async fail(id, leaseToken, message, failedAt) { await prisma.mediaDeletionJob.updateMany({ where: { id, status: "DELETING", leaseToken }, data: { status: "FAILED", lastError: message.slice(0, 1_000), leaseUntil: new Date(failedAt.getTime() + 60_000), leaseToken: null } }); },
};
