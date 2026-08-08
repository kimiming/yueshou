import { prisma } from "@/lib/db/prisma";

import type { InquiryAttachmentRepository } from "./attachments";
import type { RateLimitAdapter, RateLimitInput } from "./rate-limit";
import type { InquiryRepository } from "./service";

export class PrismaInquiryRateLimitAdapter implements RateLimitAdapter {
  async consume(input: RateLimitInput): Promise<boolean> {
    const expiresAt = new Date(input.now.getTime() + input.windowSeconds * 1000);
    const rows = await prisma.$queryRaw<Array<{ count: number }>>`
      INSERT INTO "InquiryRateLimit" ("key", "count", "expiresAt", "updatedAt")
      VALUES (${input.key}, 1, ${expiresAt}, ${input.now})
      ON CONFLICT ("key") DO UPDATE SET
        "count" = CASE WHEN "InquiryRateLimit"."expiresAt" <= ${input.now} THEN 1 ELSE "InquiryRateLimit"."count" + 1 END,
        "expiresAt" = CASE WHEN "InquiryRateLimit"."expiresAt" <= ${input.now} THEN ${expiresAt} ELSE "InquiryRateLimit"."expiresAt" END,
        "updatedAt" = ${input.now}
      WHERE "InquiryRateLimit"."expiresAt" <= ${input.now} OR "InquiryRateLimit"."count" < ${input.limit}
      RETURNING "count"
    `;
    return rows.length === 1;
  }
}

export const prismaInquiryRepository: InquiryRepository = {
  async createInquiryWithConsent(input) {
    return prisma.$transaction(async (transaction) => {
      const result = await transaction.inquiry.create({ data: { ...input.inquiry, consentRecords: { create: input.consent } }, select: { id: true } });
      if (!input.attachmentClaim?.intentIds.length) return result;
      const intents = await transaction.inquiryUploadIntent.findMany({ where: { id: { in: input.attachmentClaim.intentIds }, submissionHash: input.attachmentClaim.submissionHash, sessionHash: input.attachmentClaim.sessionHash, actorHash: input.attachmentClaim.actorHash, finalizedAt: { not: null }, consumedAt: null, expiresAt: { gt: input.attachmentClaim.claimedAt } } });
      if (intents.length !== input.attachmentClaim.intentIds.length) throw new Error("inquiry_attachment_claim_invalid");
      for (const intent of intents) {
        const consumed = await transaction.inquiryUploadIntent.updateMany({ where: { id: intent.id, consumedAt: null, finalizedAt: { not: null }, expiresAt: { gt: input.attachmentClaim.claimedAt } }, data: { consumedAt: input.attachmentClaim.claimedAt } });
        if (consumed.count !== 1 || !intent.finalStorageKey || !intent.sha256) throw new Error("inquiry_attachment_claim_conflict");
        await transaction.inquiryAttachment.create({ data: { inquiryId: result.id, storageKey: intent.finalStorageKey, filename: intent.filename, mimeType: intent.mimeType, sizeBytes: intent.sizeBytes, sha256: intent.sha256 } });
      }
      return result;
    });
  },
};

export const prismaInquiryAttachmentRepository: InquiryAttachmentRepository = {
  async createUploadIntent(input) {
    return prisma.inquiryUploadIntent.create({ data: input });
  },

  async findUploadIntent(storageKey) {
    return prisma.inquiryUploadIntent.findUnique({ where: { storageKey } });
  },

  async finalizeUploadIntent(input) {
    const finalized = await prisma.inquiryUploadIntent.updateMany({
        where: {
          id: input.intentId,
          storageKey: input.storageKey,
          submissionHash: input.binding.submissionHash,
          sessionHash: input.binding.sessionHash,
          actorHash: input.binding.actorHash,
          finalizedAt: null,
          consumedAt: null,
          expiresAt: { gt: input.completedAt },
        },
        data: { finalizedAt: input.completedAt, finalStorageKey: input.finalStorageKey, sha256: input.sha256 },
      });
    return finalized.count === 1 ? { id: input.intentId, finalStorageKey: input.finalStorageKey } : null;
  },

  async queueTempObjectDeletion(storageKey) {
    await prisma.auditLog.create({ data: { action: "INQUIRY_TEMP_DELETE_QUEUED", entityType: "InquiryUploadIntent", metadata: { storageKey } } });
  },
};
