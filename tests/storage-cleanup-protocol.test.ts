import { afterEach, describe, expect, it, vi } from "vitest";

import { prismaStorageDeletionRepository } from "@/features/storage-cleanup/repository";
import { prisma } from "@/lib/db/prisma";

function withTransaction(transaction: Record<string, unknown>) {
  return vi.spyOn(prisma, "$transaction").mockImplementation((async (callback: (value: Record<string, unknown>) => unknown) => callback(transaction)) as never);
}

afterEach(() => vi.restoreAllMocks());

describe("storage cleanup audit protocol", () => {
  it("audits completion only when the exact deletion authorization CAS wins", async () => {
    const auditCreate = vi.fn(async () => undefined);
    const executeRaw = vi.fn(async () => 1);
    vi.spyOn(prisma, "$executeRaw").mockResolvedValue(1 as never);
    withTransaction({ $executeRaw: executeRaw, auditLog: { create: auditCreate } });

    await prismaStorageDeletionRepository.complete(
      "job-1",
      "authorization-1",
      new Date("2026-08-09T00:00:00.000Z"),
    );

    expect(auditCreate).toHaveBeenCalledWith({ data: {
      action: "STORAGE_DELETION_COMPLETED",
      entityType: "StorageDeletionJob",
      entityId: "job-1",
    } });
  });

  it("audits a retry transition without persisting the provider error in audit metadata", async () => {
    const auditCreate = vi.fn(async () => undefined);
    const queryRaw = vi.fn(async () => [{ attempts: 1, maxAttempts: 8 }]);
    const executeRaw = vi.fn(async () => 1);
    withTransaction({ $queryRaw: queryRaw, $executeRaw: executeRaw, auditLog: { create: auditCreate } });

    await prismaStorageDeletionRepository.fail(
      "job-1",
      "authorization-1",
      "https://provider.invalid/private?token=secret",
      new Date("2026-08-09T00:00:00.000Z"),
    );

    expect(auditCreate).toHaveBeenCalledWith({ data: {
      action: "STORAGE_DELETION_RETRY_SCHEDULED",
      entityType: "StorageDeletionJob",
      entityId: "job-1",
      metadata: { attempts: 1 },
    } });
    expect(JSON.stringify(auditCreate.mock.calls)).not.toContain("provider.invalid");
  });
});
