import { prisma } from "@/lib/db/prisma";

import type { InquiryAttachmentRepository } from "./attachments";
import type { RateLimitAdapter, RateLimitInput } from "./rate-limit";
import type { InquiryRepository } from "./service";
import type { UploadSessionRepository } from "./upload-session";

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

export const prismaUploadSessionRepository: UploadSessionRepository = {
  async create(input) { return prisma.inquiryUploadSession.create({ data: input }); },
  async reserve(input) {
    if (!Number.isSafeInteger(input.bytes) || input.bytes <= 0) return "invalid";
    const updated = await prisma.$queryRaw<Array<{ id: string }>>`
      UPDATE "InquiryUploadSession"
      SET "usedFiles" = "usedFiles" + 1,
          "usedBytes" = "usedBytes" + CAST(${input.bytes} AS INTEGER)
      WHERE "id" = ${input.id}
        AND "secretDigest" = ${input.secretDigest}
        AND "emailDigest" = ${input.emailDigest}
        AND "expiresAt" > ${input.now}
        AND "consumedAt" IS NULL
        AND "usedFiles" < "maxFiles"
        AND "usedBytes" + CAST(${input.bytes} AS INTEGER) <= "maxBytes"
      RETURNING "id"
    `;
    if (updated.length === 1) return "ok";
    const record = await prisma.inquiryUploadSession.findUnique({ where: { id: input.id } });
    if (!record || record.secretDigest !== input.secretDigest || record.emailDigest !== input.emailDigest || record.expiresAt <= input.now || record.consumedAt) return "invalid";
    return record.usedFiles >= record.maxFiles ? "count" : "bytes";
  },
  async verify(input) { return Boolean(await prisma.inquiryUploadSession.findFirst({ where: { id: input.id, secretDigest: input.secretDigest, emailDigest: input.emailDigest, expiresAt: { gt: input.now }, consumedAt: null }, select: { id: true } })); },
};

export const prismaInquiryRepository: InquiryRepository = {
  async createInquiryWithConsent(input) {
    return prisma.$transaction(async (transaction) => {
      const result = await transaction.inquiry.create({ data: { ...input.inquiry, consentRecords: { create: input.consent } }, select: { id: true } });
      if (!input.attachmentClaim) return result;
      const session = await transaction.inquiryUploadSession.updateMany({ where: { id: input.attachmentClaim.sessionId, secretDigest: input.attachmentClaim.secretDigest, emailDigest: input.attachmentClaim.emailDigest, expiresAt: { gt: input.attachmentClaim.claimedAt }, consumedAt: null }, data: { consumedAt: input.attachmentClaim.claimedAt } });
      if (session.count !== 1) throw new Error("inquiry_upload_session_invalid");
      if (!input.attachmentClaim.intentIds.length) return result;
      const intents = await transaction.inquiryUploadIntent.findMany({ where: { id: { in: input.attachmentClaim.intentIds }, uploadSessionId: input.attachmentClaim.sessionId, finalizedAt: { not: null }, consumedAt: null, expiresAt: { gt: input.attachmentClaim.claimedAt } } });
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
          uploadSessionId: input.uploadSessionId,
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
