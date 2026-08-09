import { describe, expect, it, vi } from "vitest";

import {
  processStorageDeletionBatch,
  runStorageMaintenance,
  type StorageDeletionRepository,
} from "@/features/storage-cleanup/service";

function repository(
  jobs: Array<{ id: string; storageKey: string; leaseToken: string }> = [],
  overrides: Partial<StorageDeletionRepository> = {},
): StorageDeletionRepository {
  const pending = [...jobs];
  return {
    claimDue: vi.fn(async () => pending.shift() ?? null),
    authorizeDeletion: vi.fn(async (job) => ({ authorizationToken: job.leaseToken })),
    complete: vi.fn(async () => undefined),
    fail: vi.fn(async () => undefined),
    sweepExpired: vi.fn(async () => ({ intentsQueued: 0, sessionsDeleted: 0, rateLimitsDeleted: 0 })),
    ...overrides,
  };
}

describe("durable storage cleanup", () => {
  it("processes a bounded number of due jobs in one invocation", async () => {
    const repo = repository([
      { id: "job-1", storageKey: "media/pending/a.png", leaseToken: "lease-1" },
      { id: "job-2", storageKey: "inquiry/tmp/b.pdf", leaseToken: "lease-2" },
      { id: "job-3", storageKey: "inquiry/final/c.pdf", leaseToken: "lease-3" },
    ]);
    const storage = { deleteObject: vi.fn(async () => undefined) };

    await expect(processStorageDeletionBatch({ repository: repo, storage, limit: 2 }))
      .resolves.toEqual({ processed: 2, failed: 0, cancelled: 0 });
    expect(storage.deleteObject).toHaveBeenCalledTimes(2);
    expect(repo.claimDue).toHaveBeenCalledTimes(2);
  });

  it("rechecks live references transactionally before authorizing deletion", async () => {
    const repo = repository(
      [{ id: "job-1", storageKey: "media/pending/a.png", leaseToken: "lease-1" }],
      { authorizeDeletion: vi.fn(async () => null) },
    );
    const storage = { deleteObject: vi.fn(async () => undefined) };

    await expect(processStorageDeletionBatch({ repository: repo, storage, limit: 1 }))
      .resolves.toEqual({ processed: 0, failed: 0, cancelled: 1 });
    expect(storage.deleteObject).not.toHaveBeenCalled();
  });

  it("persists retry/dead-letter state when an external delete fails", async () => {
    const repo = repository([
      { id: "job-1", storageKey: "inquiry/tmp/a.pdf", leaseToken: "lease-1" },
    ]);
    const storage = { deleteObject: vi.fn(async () => { throw new Error("provider unavailable"); }) };

    await expect(processStorageDeletionBatch({ repository: repo, storage, limit: 1 }))
      .resolves.toEqual({ processed: 0, failed: 1, cancelled: 0 });
    expect(repo.fail).toHaveBeenCalledWith(
      "job-1",
      "lease-1",
      "provider unavailable",
      expect.any(Date),
    );
  });

  it("sweeps expired intent/session/rate-limit metadata before processing jobs", async () => {
    const repo = repository([], {
      sweepExpired: vi.fn(async () => ({ intentsQueued: 4, sessionsDeleted: 2, rateLimitsDeleted: 10 })),
    });
    const now = new Date("2026-08-09T00:00:00.000Z");

    await expect(runStorageMaintenance({
      repository: repo,
      storage: { deleteObject: vi.fn(async () => undefined) },
      now: () => now,
      sweepLimit: 25,
      deletionLimit: 10,
    })).resolves.toEqual({
      sweep: { intentsQueued: 4, sessionsDeleted: 2, rateLimitsDeleted: 10 },
      deletion: { processed: 0, failed: 0, cancelled: 0 },
    });
    expect(repo.sweepExpired).toHaveBeenCalledWith(now, 25);
  });
});
