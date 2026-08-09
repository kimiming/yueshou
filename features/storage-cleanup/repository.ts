import { randomUUID } from "node:crypto";

import type { Prisma } from "@prisma/client";

import { prisma } from "@/lib/db/prisma";
import type {
  ClaimedStorageDeletionJob,
  StorageDeletionRepository,
} from "./service";

export type StorageDeletionKind =
  | "MEDIA_PENDING"
  | "MEDIA_FINAL"
  | "INQUIRY_TEMP"
  | "INQUIRY_FINAL";

type QueueInput = {
  storageKey: string;
  kind: StorageDeletionKind;
  sourceType: string;
  sourceId?: string | null;
  notBefore: Date;
};

type CleanupTx = Pick<Prisma.TransactionClient, "$executeRaw" | "$queryRaw" | "auditLog">;

async function queueInTransaction(tx: CleanupTx, input: QueueInput): Promise<boolean> {
  const inserted = await tx.$executeRaw`
    INSERT INTO "StorageDeletionJob" (
      "id", "storageKey", "kind", "sourceType", "sourceId", "status",
      "notBefore", "attempts", "maxAttempts", "createdAt", "updatedAt"
    ) VALUES (
      ${randomUUID()}, ${input.storageKey}, ${input.kind}::"StorageDeletionKind",
      ${input.sourceType}, ${input.sourceId ?? null}, 'PENDING', ${input.notBefore},
      0, 8, ${input.notBefore}, ${input.notBefore}
    )
    ON CONFLICT ("storageKey") DO UPDATE SET
      "kind" = EXCLUDED."kind",
      "sourceType" = EXCLUDED."sourceType",
      "sourceId" = EXCLUDED."sourceId",
      "status" = 'PENDING',
      "notBefore" = EXCLUDED."notBefore",
      "attempts" = 0,
      "leaseUntil" = NULL,
      "leaseToken" = NULL,
      "lastError" = NULL,
      "completedAt" = NULL,
      "deadLetterAt" = NULL,
      "updatedAt" = EXCLUDED."updatedAt"
    WHERE "StorageDeletionJob"."status" IN ('COMPLETED', 'CANCELLED')
  `;
  return inserted === 1;
}

export async function queueStorageDeletionJob(input: QueueInput): Promise<void> {
  await prisma.$transaction(async (tx) => {
    const queued = await queueInTransaction(tx, input);
    if (queued) {
      await tx.auditLog.create({
        data: {
          action: "STORAGE_DELETION_QUEUED",
          entityType: input.sourceType,
          entityId: input.sourceId ?? undefined,
          metadata: { kind: input.kind, notBefore: input.notBefore.toISOString() },
        },
      });
    }
  });
}

type ExpiredIntent = {
  id: string;
  storageKey: string;
  finalStorageKey: string | null;
  consumedAt: Date | null;
};

function safeFailureMessage(message: string): string {
  return message
    .replace(/https?:\/\/\S+/gi, "[url]")
    .replace(/[\w.+-]+@[\w.-]+\.[A-Za-z]{2,}/g, "[email]")
    .replace(/[\u0000-\u001f\u007f]/g, " ")
    .slice(0, 500) || "storage_delete_failed";
}

export const prismaStorageDeletionRepository: StorageDeletionRepository = {
  async sweepExpired(now, limit) {
    return prisma.$transaction(async (tx) => {
      const boundedLimit = Math.max(1, Math.min(250, Math.floor(limit)));
      const media = await tx.$queryRaw<ExpiredIntent[]>`
        SELECT "id", "storageKey", "finalStorageKey", "consumedAt"
        FROM "MediaUploadIntent"
        WHERE "expiresAt" <= ${now}
        ORDER BY "expiresAt", "id"
        FOR UPDATE SKIP LOCKED
        LIMIT ${boundedLimit}
      `;
      const inquiryLimit = Math.max(0, boundedLimit - media.length);
      const inquiries = inquiryLimit
        ? await tx.$queryRaw<ExpiredIntent[]>`
            SELECT "id", "storageKey", "finalStorageKey", "consumedAt"
            FROM "InquiryUploadIntent"
            WHERE "expiresAt" <= ${now}
            ORDER BY "expiresAt", "id"
            FOR UPDATE SKIP LOCKED
            LIMIT ${inquiryLimit}
          `
        : [];

      let intentsQueued = 0;
      for (const intent of media) {
        if (await queueInTransaction(tx, {
          storageKey: intent.storageKey,
          kind: "MEDIA_PENDING",
          sourceType: "MediaUploadIntent",
          sourceId: intent.id,
          notBefore: now,
        })) intentsQueued += 1;
        if (!intent.consumedAt && intent.finalStorageKey && await queueInTransaction(tx, {
          storageKey: intent.finalStorageKey,
          kind: "MEDIA_FINAL",
          sourceType: "MediaUploadIntent",
          sourceId: intent.id,
          notBefore: now,
        })) intentsQueued += 1;
      }
      for (const intent of inquiries) {
        if (await queueInTransaction(tx, {
          storageKey: intent.storageKey,
          kind: "INQUIRY_TEMP",
          sourceType: "InquiryUploadIntent",
          sourceId: intent.id,
          notBefore: now,
        })) intentsQueued += 1;
        if (!intent.consumedAt && intent.finalStorageKey && await queueInTransaction(tx, {
          storageKey: intent.finalStorageKey,
          kind: "INQUIRY_FINAL",
          sourceType: "InquiryUploadIntent",
          sourceId: intent.id,
          notBefore: now,
        })) intentsQueued += 1;
      }

      const mediaIds = media.map((intent) => intent.id);
      const inquiryIds = inquiries.map((intent) => intent.id);
      if (mediaIds.length) await tx.mediaUploadIntent.deleteMany({ where: { id: { in: mediaIds } } });
      if (inquiryIds.length) await tx.inquiryUploadIntent.deleteMany({ where: { id: { in: inquiryIds } } });

      const sessions = await tx.$queryRaw<Array<{ id: string }>>`
        SELECT session."id"
        FROM "InquiryUploadSession" AS session
        WHERE session."expiresAt" <= ${now}
          AND NOT EXISTS (
            SELECT 1 FROM "InquiryUploadIntent" AS intent
            WHERE intent."uploadSessionId" = session."id"
          )
        ORDER BY session."expiresAt", session."id"
        FOR UPDATE SKIP LOCKED
        LIMIT ${boundedLimit}
      `;
      const sessionIds = sessions.map((session) => session.id);
      const sessionsDeleted = sessionIds.length
        ? (await tx.inquiryUploadSession.deleteMany({ where: { id: { in: sessionIds } } })).count
        : 0;

      const rateLimitsDeleted = await tx.$executeRaw`
        DELETE FROM "InquiryRateLimit"
        WHERE "key" IN (
          SELECT "key" FROM "InquiryRateLimit"
          WHERE "expiresAt" <= ${now}
          ORDER BY "expiresAt", "key"
          FOR UPDATE SKIP LOCKED
          LIMIT ${boundedLimit}
        )
      `;

      if (intentsQueued || sessionsDeleted || rateLimitsDeleted) {
        await tx.auditLog.create({
          data: {
            action: "STORAGE_MAINTENANCE_SWEPT",
            entityType: "StorageMaintenance",
            metadata: {
              intentRows: media.length + inquiries.length,
              deletionJobsQueued: intentsQueued,
              sessionsDeleted,
              rateLimitsDeleted,
            },
          },
        });
      }
      return { intentsQueued, sessionsDeleted, rateLimitsDeleted };
    }, { isolationLevel: "Serializable" });
  },

  async claimDue(now) {
    const leaseToken = randomUUID();
    const rows = await prisma.$queryRaw<Array<ClaimedStorageDeletionJob>>`
      WITH candidate AS (
        SELECT "id", "status"
        FROM "StorageDeletionJob"
        WHERE "notBefore" <= ${now}
          AND "attempts" < "maxAttempts"
          AND (
            "status" = 'PENDING'
            OR "status" = 'FAILED'
            OR ("status" IN ('PROCESSING', 'DELETING') AND "leaseUntil" < ${now})
          )
        ORDER BY "notBefore", "id"
        FOR UPDATE SKIP LOCKED
        LIMIT 1
      )
      UPDATE "StorageDeletionJob" AS job
      SET "status" = CASE WHEN candidate."status" = 'DELETING'
                            THEN 'DELETING'::"StorageDeletionJobStatus"
                            ELSE 'PROCESSING'::"StorageDeletionJobStatus" END,
          "attempts" = job."attempts" + 1,
          "leaseToken" = ${leaseToken},
          "leaseUntil" = ${new Date(now.getTime() + 5 * 60_000)},
          "updatedAt" = ${now}
      FROM candidate
      WHERE job."id" = candidate."id"
      RETURNING job."id", job."storageKey", job."leaseToken",
                (candidate."status" = 'DELETING') AS "deletionAuthorized"
    `;
    return rows[0] ?? null;
  },

  async authorizeDeletion(job, now) {
    return prisma.$transaction(async (tx) => {
      const current = await tx.$queryRaw<Array<{ id: string }>>`
        SELECT "id" FROM "StorageDeletionJob"
        WHERE "id" = ${job.id}
          AND "status" = 'PROCESSING'
          AND "leaseToken" = ${job.leaseToken}
          AND "leaseUntil" > ${now}
        FOR UPDATE
      `;
      if (!current.length) return null;
      const [mediaAssets, inquiryAttachments, mediaIntents, inquiryIntents] = await Promise.all([
        tx.mediaAsset.count({ where: { storageKey: job.storageKey } }),
        tx.inquiryAttachment.count({ where: { storageKey: job.storageKey } }),
        tx.mediaUploadIntent.count({
          where: {
            expiresAt: { gt: now },
            consumedAt: null,
            OR: [{ storageKey: job.storageKey }, { finalStorageKey: job.storageKey }],
          },
        }),
        tx.inquiryUploadIntent.count({
          where: {
            expiresAt: { gt: now },
            consumedAt: null,
            OR: [{ storageKey: job.storageKey }, { finalStorageKey: job.storageKey }],
          },
        }),
      ]);
      if (mediaAssets + inquiryAttachments + mediaIntents + inquiryIntents > 0) {
        await tx.$executeRaw`
          UPDATE "StorageDeletionJob"
          SET "status" = 'CANCELLED', "leaseToken" = NULL, "leaseUntil" = NULL,
              "lastError" = 'Deletion cancelled because the object is referenced',
              "updatedAt" = ${now}
          WHERE "id" = ${job.id} AND "status" = 'PROCESSING'
            AND "leaseToken" = ${job.leaseToken}
        `;
        await tx.auditLog.create({
          data: {
            action: "STORAGE_DELETION_CANCELLED_REFERENCED",
            entityType: "StorageDeletionJob",
            entityId: job.id,
          },
        });
        return null;
      }
      const authorized = await tx.$executeRaw`
        UPDATE "StorageDeletionJob"
        SET "status" = 'DELETING', "updatedAt" = ${now}
        WHERE "id" = ${job.id} AND "status" = 'PROCESSING'
          AND "leaseToken" = ${job.leaseToken}
      `;
      if (authorized !== 1) return null;
      await tx.auditLog.create({
        data: {
          action: "STORAGE_DELETION_AUTHORIZED",
          entityType: "StorageDeletionJob",
          entityId: job.id,
        },
      });
      return { authorizationToken: job.leaseToken };
    }, { isolationLevel: "Serializable" });
  },

  async complete(id, authorizationToken, completedAt) {
    await prisma.$transaction(async (tx) => {
      const changed = await tx.$executeRaw`
        UPDATE "StorageDeletionJob"
        SET "status" = 'COMPLETED', "completedAt" = ${completedAt},
            "leaseUntil" = NULL, "leaseToken" = NULL, "lastError" = NULL,
            "updatedAt" = ${completedAt}
        WHERE "id" = ${id} AND "status" = 'DELETING'
          AND "leaseToken" = ${authorizationToken}
      `;
      if (changed === 1) {
        await tx.auditLog.create({
          data: {
            action: "STORAGE_DELETION_COMPLETED",
            entityType: "StorageDeletionJob",
            entityId: id,
          },
        });
      }
    }, { isolationLevel: "Serializable" });
  },

  async fail(id, authorizationToken, message, failedAt) {
    await prisma.$transaction(async (tx) => {
      const rows = await tx.$queryRaw<Array<{ attempts: number; maxAttempts: number }>>`
        SELECT "attempts", "maxAttempts" FROM "StorageDeletionJob"
        WHERE "id" = ${id} AND "status" = 'DELETING'
          AND "leaseToken" = ${authorizationToken}
        FOR UPDATE
      `;
      const job = rows[0];
      if (!job) return;
      const terminal = job.attempts >= job.maxAttempts;
      const retryAt = new Date(failedAt.getTime() + Math.min(86_400_000, 60_000 * (2 ** Math.max(0, job.attempts - 1))));
      const changed = await tx.$executeRaw`
        UPDATE "StorageDeletionJob"
        SET "status" = ${terminal ? "DEAD_LETTER" : "FAILED"}::"StorageDeletionJobStatus",
            "notBefore" = ${terminal ? failedAt : retryAt},
            "deadLetterAt" = ${terminal ? failedAt : null},
            "lastError" = ${safeFailureMessage(message)},
            "leaseUntil" = NULL, "leaseToken" = NULL, "updatedAt" = ${failedAt}
        WHERE "id" = ${id} AND "status" = 'DELETING'
          AND "leaseToken" = ${authorizationToken}
      `;
      if (changed !== 1) return;
      await tx.auditLog.create({
        data: {
          action: terminal ? "STORAGE_DELETION_DEAD_LETTERED" : "STORAGE_DELETION_RETRY_SCHEDULED",
          entityType: "StorageDeletionJob",
          entityId: id,
          metadata: { attempts: job.attempts },
        },
      });
    }, { isolationLevel: "Serializable" });
  },
};
