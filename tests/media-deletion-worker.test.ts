import { expect, it, vi } from "vitest";

import { processDueMediaDeletionJobs } from "@/features/media/deletion-worker";

it("claims, deletes and completes one due media deletion job", async () => {
  const repository = {
    claimDue: vi.fn(async () => ({ id: "job-1", storageKey: "media/2026/08/a.webp", attempts: 0, leaseToken: "lease-1" })),
    complete: vi.fn(async () => undefined),
    fail: vi.fn(async () => undefined),
  };
  const storage = { deleteObject: vi.fn(async () => undefined) };

  await expect(processDueMediaDeletionJobs({ repository, storage, now: () => new Date("2026-08-08T00:00:00.000Z") })).resolves.toEqual({ processed: 1, failed: 0 });
  expect(storage.deleteObject).toHaveBeenCalledWith("media/2026/08/a.webp");
  expect(repository.complete).toHaveBeenCalledWith("job-1", "lease-1", expect.any(Date));
});

it("records a retryable failure when object deletion fails", async () => {
  const repository = { claimDue: vi.fn(async () => ({ id: "job-1", storageKey: "media/2026/08/a.webp", attempts: 0, leaseToken: "lease-1" })), complete: vi.fn(), fail: vi.fn(async () => undefined) };
  const storage = { deleteObject: vi.fn(async () => { throw new Error("network unavailable"); }) };

  await expect(processDueMediaDeletionJobs({ repository, storage, now: () => new Date("2026-08-08T00:00:00.000Z") })).resolves.toEqual({ processed: 0, failed: 1 });
  expect(repository.fail).toHaveBeenCalledWith("job-1", "lease-1", "network unavailable", expect.any(Date));
});

it("does not delete an object when a newly-created reference revokes its lease", async () => {
  const repository = {
    claimDue: vi.fn(async () => ({ id: "job-1", storageKey: "media/2026/08/a.webp", attempts: 1, leaseToken: "lease-1" })),
    confirmDeletable: vi.fn(async () => null),
    complete: vi.fn(async () => undefined),
    fail: vi.fn(async () => undefined),
  };
  const storage = { deleteObject: vi.fn(async () => undefined) };

  await expect(processDueMediaDeletionJobs({ repository, storage })).resolves.toEqual({ processed: 0, failed: 0 });
  expect(storage.deleteObject).not.toHaveBeenCalled();
  expect(repository.complete).not.toHaveBeenCalled();
});

it("uses the irreversible deletion authorization rather than the rearrangeable claim lease", async () => {
  const repository = {
    claimDue: vi.fn(async () => ({ id: "job-1", storageKey: "media/2026/08/a.webp", attempts: 1, leaseToken: "claim-lease" })),
    confirmDeletable: vi.fn(async () => ({ authorizationToken: "delete-authorization" })),
    complete: vi.fn(async () => undefined),
    fail: vi.fn(async () => undefined),
  };
  const storage = { deleteObject: vi.fn(async () => undefined) };

  await expect(processDueMediaDeletionJobs({ repository, storage })).resolves.toEqual({ processed: 1, failed: 0 });
  expect(repository.complete).toHaveBeenCalledWith("job-1", "delete-authorization", expect.any(Date));
});

it("retries an expired deletion authorization without reopening its confirmation window", async () => {
  const repository = {
    claimDue: vi.fn(async () => ({ id: "job-1", storageKey: "media/2026/08/a.webp", attempts: 2, leaseToken: "replacement-authorization", alreadyAuthorized: true })),
    confirmDeletable: vi.fn(async () => null),
    complete: vi.fn(async () => undefined),
    fail: vi.fn(async () => undefined),
  };
  const storage = { deleteObject: vi.fn(async () => undefined) };

  await expect(processDueMediaDeletionJobs({ repository, storage })).resolves.toEqual({ processed: 1, failed: 0 });
  expect(repository.confirmDeletable).not.toHaveBeenCalled();
  expect(storage.deleteObject).toHaveBeenCalledWith("media/2026/08/a.webp");
  expect(repository.complete).toHaveBeenCalledWith("job-1", "replacement-authorization", expect.any(Date));
});
