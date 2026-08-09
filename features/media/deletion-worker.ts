import type { ObjectStorage } from "@/lib/storage";

export type MediaDeletionJobRepository = {
  claimDue(now: Date): Promise<{ id: string; storageKey: string; attempts: number; leaseToken: string; alreadyAuthorized?: boolean } | null>;
  confirmDeletable?(id: string, leaseToken: string): Promise<{ authorizationToken: string } | null>;
  complete(id: string, leaseToken: string, completedAt: Date): Promise<void>;
  fail(id: string, leaseToken: string, message: string, failedAt: Date): Promise<void>;
};

export async function processDueMediaDeletionJobs(dependencies: {
  repository: MediaDeletionJobRepository;
  storage: Pick<ObjectStorage, "deleteObject">;
  now?: () => Date;
  limit?: number;
}) {
  let processed = 0;
  let failed = 0;
  const limit = Math.max(0, Math.min(100, Math.floor(dependencies.limit ?? 1)));
  for (let index = 0; index < limit; index += 1) {
    const now = dependencies.now?.() ?? new Date();
    const job = await dependencies.repository.claimDue(now);
    if (!job) break;
    const authorization = job.alreadyAuthorized
      ? { authorizationToken: job.leaseToken }
      : dependencies.repository.confirmDeletable
      ? await dependencies.repository.confirmDeletable(job.id, job.leaseToken)
      : { authorizationToken: job.leaseToken };
    if (!authorization) continue;
    try {
      await dependencies.storage.deleteObject(job.storageKey);
      await dependencies.repository.complete(job.id, authorization.authorizationToken, now);
      processed += 1;
    } catch (error) {
      const message = error instanceof Error ? error.message : "Object deletion failed";
      await dependencies.repository.fail(job.id, authorization.authorizationToken, message, now);
      failed += 1;
    }
  }
  return { processed, failed };
}
