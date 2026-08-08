import { expect, it, vi } from "vitest";

import { processDueMediaDeletionJobs } from "@/features/media/deletion-worker";

it("claims, deletes and completes one due media deletion job", async () => {
  const repository = {
    claimDue: vi.fn(async () => ({ id: "job-1", storageKey: "media/2026/08/a.webp", attempts: 0 })),
    complete: vi.fn(async () => undefined),
    fail: vi.fn(async () => undefined),
  };
  const storage = { deleteObject: vi.fn(async () => undefined) };

  await expect(processDueMediaDeletionJobs({ repository, storage, now: () => new Date("2026-08-08T00:00:00.000Z") })).resolves.toEqual({ processed: 1, failed: 0 });
  expect(storage.deleteObject).toHaveBeenCalledWith("media/2026/08/a.webp");
  expect(repository.complete).toHaveBeenCalledWith("job-1", expect.any(Date));
});

it("records a retryable failure when object deletion fails", async () => {
  const repository = { claimDue: vi.fn(async () => ({ id: "job-1", storageKey: "media/2026/08/a.webp", attempts: 0 })), complete: vi.fn(), fail: vi.fn(async () => undefined) };
  const storage = { deleteObject: vi.fn(async () => { throw new Error("network unavailable"); }) };

  await expect(processDueMediaDeletionJobs({ repository, storage, now: () => new Date("2026-08-08T00:00:00.000Z") })).resolves.toEqual({ processed: 0, failed: 1 });
  expect(repository.fail).toHaveBeenCalledWith("job-1", "network unavailable", expect.any(Date));
});
