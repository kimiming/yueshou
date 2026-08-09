import { afterEach, describe, expect, it, vi } from "vitest";

import { prismaMediaDeletionJobRepository, prismaMediaRepository } from "@/features/media/repository";
import { prisma } from "@/lib/db/prisma";

const deleteAfter = new Date("2026-09-07T00:00:00.000Z");
const leaseUntil = new Date("2026-09-07T00:05:00.000Z");

function withTransaction(transaction: Record<string, unknown>) {
  return vi.spyOn(prisma, "$transaction").mockImplementation((async (callback: (value: Record<string, unknown>) => unknown) => callback(transaction)) as never);
}

const confirmDeletable = prismaMediaDeletionJobRepository.confirmDeletable!;

afterEach(() => vi.restoreAllMocks());

describe("media deletion authorization protocol", () => {
  it("authorizes external deletion only through an exact PROCESSING lease-and-schedule CAS", async () => {
    const updateMany = vi.fn(async () => ({ count: 1 }));
    const auditCreate = vi.fn(async () => undefined);
    const tx = {
      mediaDeletionJob: { findFirst: vi.fn(async () => ({ mediaAssetId: "media-1", deleteAfter, leaseUntil })), updateMany },
      product: { count: vi.fn(async () => 0) },
      article: { count: vi.fn(async () => 0) },
      pageSection: { findMany: vi.fn(async () => []) },
      siteSetting: { findMany: vi.fn(async () => []) },
      auditLog: { create: auditCreate },
    };
    withTransaction(tx);

    await expect(confirmDeletable("job-1", "lease-1")).resolves.toEqual({ authorizationToken: "lease-1" });
    expect(updateMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: "job-1", status: "PROCESSING", leaseToken: "lease-1", deleteAfter, leaseUntil },
      data: { status: "DELETING" },
    }));
    expect(auditCreate).toHaveBeenCalledWith({ data: {
      action: "MEDIA_DELETION_AUTHORIZED",
      entityType: "MediaAsset",
      entityId: "media-1",
      metadata: { jobId: "job-1" },
    } });
  });

  it("audits completion only when the exact authorized deletion CAS wins", async () => {
    const updateMany = vi.fn(async () => ({ count: 1 }));
    const auditCreate = vi.fn(async () => undefined);
    withTransaction({ mediaDeletionJob: { updateMany }, auditLog: { create: auditCreate } });

    await prismaMediaDeletionJobRepository.complete("job-1", "lease-1", deleteAfter);

    expect(updateMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: "job-1", status: "DELETING", leaseToken: "lease-1" },
    }));
    expect(auditCreate).toHaveBeenCalledWith({ data: {
      action: "MEDIA_DELETION_COMPLETED",
      entityType: "MediaDeletionJob",
      entityId: "job-1",
    } });
  });

  it("sanitizes provider failures and audits retry transitions without leaking the error", async () => {
    const updateMany = vi.fn(async (input: unknown) => {
      void input;
      return { count: 1 };
    });
    const auditCreate = vi.fn(async () => undefined);
    withTransaction({
      mediaDeletionJob: {
        findFirst: vi.fn(async () => ({ mediaAssetId: "media-1", attempts: 1, maxAttempts: 8 })),
        updateMany,
      },
      auditLog: { create: auditCreate },
    });

    await prismaMediaDeletionJobRepository.fail(
      "job-1",
      "lease-1",
      "https://provider.invalid/private?token=secret admin@example.com\nfailed",
      deleteAfter,
    );

    const update = updateMany.mock.calls[0]?.[0];
    expect(JSON.stringify(update)).not.toContain("provider.invalid");
    expect(JSON.stringify(update)).not.toContain("admin@example.com");
    expect(auditCreate).toHaveBeenCalledWith({ data: {
      action: "MEDIA_DELETION_RETRY_SCHEDULED",
      entityType: "MediaAsset",
      entityId: "media-1",
      metadata: { jobId: "job-1", attempts: 1 },
    } });
    expect(JSON.stringify(auditCreate.mock.calls)).not.toContain("provider.invalid");
  });

  it("refuses a stale authorization when the observed deletion schedule no longer matches", async () => {
    const updateMany = vi.fn(async () => ({ count: 0 }));
    const tx = {
      mediaDeletionJob: { findFirst: vi.fn(async () => ({ mediaAssetId: "media-1", deleteAfter, leaseUntil })), updateMany },
      product: { count: vi.fn(async () => 0) },
      article: { count: vi.fn(async () => 0) },
      pageSection: { findMany: vi.fn(async () => []) },
      siteSetting: { findMany: vi.fn(async () => []) },
      auditLog: { create: vi.fn(async () => undefined) },
    };
    withTransaction(tx);

    await expect(confirmDeletable("job-1", "old-lease")).resolves.toBeNull();
    expect(updateMany).toHaveBeenCalledOnce();
  });

  it("does not reset an in-flight job when archive is repeated", async () => {
    const tx = {
      mediaAsset: { findUnique: vi.fn(async () => ({ id: "media-1" })), update: vi.fn(async () => undefined) },
      mediaDeletionJob: { findUnique: vi.fn(async () => ({ status: "PROCESSING", deleteAfter })) },
      auditLog: { create: vi.fn(async () => undefined) },
    };
    withTransaction(tx);

    await expect(prismaMediaRepository.archiveWithReferences!({ actorId: "admin-1", mediaAssetId: "media-1", archivedAt: new Date("2026-08-08T00:00:00.000Z"), deleteAfter: new Date("2026-09-08T00:00:00.000Z") })).resolves.toEqual({ retained: false, deleteAfter });
    expect(tx.mediaAsset.update).not.toHaveBeenCalled();
    expect(tx.mediaDeletionJob.findUnique).toHaveBeenCalledOnce();
  });

  it("does not reschedule an existing job through the legacy queue path", async () => {
    const tx = {
      mediaDeletionJob: { findUnique: vi.fn(async () => ({ id: "job-1" })), create: vi.fn(async () => undefined) },
      auditLog: { create: vi.fn(async () => undefined) },
    };
    withTransaction(tx);

    await prismaMediaRepository.queueObjectDeletion({ actorId: "admin-1", mediaAssetId: "media-1", storageKey: "media/a.webp", deleteAfter: new Date("2026-10-01T00:00:00.000Z") });

    expect(tx.mediaDeletionJob.create).not.toHaveBeenCalled();
    expect(tx.auditLog.create).not.toHaveBeenCalled();
  });

  it("reclaims an expired DELETING authorization with a rotated token and keeps it authorized", async () => {
    const now = new Date("2026-09-07T00:10:00.000Z");
    const expiredLease = new Date("2026-09-07T00:05:00.000Z");
    const updateMany = vi.fn(async () => ({ count: 1 }));
    const tx = {
      mediaDeletionJob: {
        findFirst: vi.fn(async () => ({ id: "job-1", storageKey: "media/a.webp", attempts: 2, status: "DELETING", deleteAfter, leaseUntil: expiredLease, leaseToken: "old-token" })),
        updateMany,
      },
    };
    withTransaction(tx);

    const claimed = await prismaMediaDeletionJobRepository.claimDue(now);

    expect(claimed).toMatchObject({ id: "job-1", storageKey: "media/a.webp", attempts: 3, alreadyAuthorized: true });
    expect(claimed?.leaseToken).not.toBe("old-token");
    expect(updateMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: "job-1", status: "DELETING", deleteAfter, leaseUntil: expiredLease, leaseToken: "old-token" },
      data: expect.objectContaining({ status: "DELETING" }),
    }));
  });

  it("does not claim an unexpired DELETING authorization", async () => {
    const findFirst = vi.fn(async () => null);
    const tx = { mediaDeletionJob: { findFirst, updateMany: vi.fn() } };
    withTransaction(tx);

    await expect(prismaMediaDeletionJobRepository.claimDue(new Date("2026-09-07T00:00:00.000Z"))).resolves.toBeNull();
    expect(findFirst).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({ OR: expect.arrayContaining([expect.objectContaining({ status: "DELETING", leaseUntil: { lt: new Date("2026-09-07T00:00:00.000Z") } })]) }),
    }));
  });

  it("makes stale completion and failure tokens no-ops after authorization is reclaimed", async () => {
    const findFailureJob = vi.fn(async () => null);
    const updateMany = vi.fn(async () => ({ count: 0 }));
    withTransaction({
      mediaDeletionJob: { findFirst: findFailureJob, updateMany },
      auditLog: { create: vi.fn(async () => undefined) },
    });

    await prismaMediaDeletionJobRepository.complete("job-1", "old-token", new Date("2026-09-07T00:10:00.000Z"));
    await prismaMediaDeletionJobRepository.fail("job-1", "old-token", "late worker", new Date("2026-09-07T00:10:00.000Z"));

    expect(updateMany).toHaveBeenCalledOnce();
    expect(updateMany).toHaveBeenCalledWith(expect.objectContaining({ where: { id: "job-1", status: "DELETING", leaseToken: "old-token" } }));
    expect(findFailureJob).toHaveBeenCalledWith(expect.objectContaining({ where: { id: "job-1", status: "DELETING", leaseToken: "old-token" } }));
  });
});
