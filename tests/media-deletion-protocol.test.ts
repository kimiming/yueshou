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
    const tx = {
      mediaDeletionJob: { findFirst: vi.fn(async () => ({ mediaAssetId: "media-1", deleteAfter, leaseUntil })), updateMany },
      product: { count: vi.fn(async () => 0) },
      article: { count: vi.fn(async () => 0) },
      pageSection: { findMany: vi.fn(async () => []) },
      siteSetting: { findMany: vi.fn(async () => []) },
      auditLog: { create: vi.fn(async () => undefined) },
    };
    withTransaction(tx);

    await expect(confirmDeletable("job-1", "lease-1")).resolves.toEqual({ authorizationToken: "lease-1" });
    expect(updateMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: "job-1", status: "PROCESSING", leaseToken: "lease-1", deleteAfter, leaseUntil },
      data: { status: "DELETING" },
    }));
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
    const updateMany = vi.spyOn(prisma.mediaDeletionJob, "updateMany").mockResolvedValue({ count: 0 } as never);

    await prismaMediaDeletionJobRepository.complete("job-1", "old-token", new Date("2026-09-07T00:10:00.000Z"));
    await prismaMediaDeletionJobRepository.fail("job-1", "old-token", "late worker", new Date("2026-09-07T00:10:00.000Z"));

    expect(updateMany).toHaveBeenNthCalledWith(1, expect.objectContaining({ where: { id: "job-1", status: "DELETING", leaseToken: "old-token" } }));
    expect(updateMany).toHaveBeenNthCalledWith(2, expect.objectContaining({ where: { id: "job-1", status: "DELETING", leaseToken: "old-token" } }));
  });
});
