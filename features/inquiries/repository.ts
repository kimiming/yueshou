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
    const result = await prisma.inquiry.create({
      data: {
        ...input.inquiry,
        consentRecords: { create: input.consent },
      },
      select: { id: true },
    });
    return result;
  },
};

export const prismaInquiryAttachmentRepository: InquiryAttachmentRepository = {
  async createUploadIntent(input) {
    return prisma.inquiryUploadIntent.create({ data: input });
  },

  async findUploadIntent(storageKey) {
    return prisma.inquiryUploadIntent.findUnique({ where: { storageKey } });
  },

  async consumeUploadIntent(input) {
    return prisma.$transaction(async (transaction) => {
      const consumed = await transaction.inquiryUploadIntent.updateMany({
        where: {
          id: input.intentId,
          inquiryId: input.inquiryId,
          storageKey: input.storageKey,
          inquiryTokenHash: input.inquiryTokenHash,
          sessionHash: input.sessionHash,
          actorHash: input.actorHash,
          filename: input.filename,
          mimeType: input.mimeType,
          sizeBytes: input.sizeBytes,
          consumedAt: null,
          expiresAt: { gt: input.completedAt },
        },
        data: { consumedAt: input.completedAt },
      });
      if (consumed.count !== 1) return null;
      return transaction.inquiryAttachment.create({
        data: {
          inquiryId: input.inquiryId,
          storageKey: input.storageKey,
          filename: input.filename,
          mimeType: input.mimeType,
          sizeBytes: input.sizeBytes,
        },
        select: { id: true, storageKey: true },
      });
    });
  },
};
