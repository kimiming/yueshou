import type { ObjectStorage } from "@/lib/storage";

export type MediaDeletionJobRepository = {
  claimDue(now: Date): Promise<{ id: string; storageKey: string; attempts: number; leaseToken: string } | null>;
  confirmDeletable?(id: string, leaseToken: string): Promise<{ authorizationToken: string } | null>;
  complete(id: string, leaseToken: string, completedAt: Date): Promise<void>;
  fail(id: string, leaseToken: string, message: string, failedAt: Date): Promise<void>;
};

export async function processDueMediaDeletionJobs(dependencies: {
  repository: MediaDeletionJobRepository;
  storage: Pick<ObjectStorage, "deleteObject">;
  now?: () => Date;
}) {
  const now = dependencies.now?.() ?? new Date();
  const job = await dependencies.repository.claimDue(now);
  if (!job) return { processed: 0, failed: 0 };
  const authorization = dependencies.repository.confirmDeletable
    ? await dependencies.repository.confirmDeletable(job.id, job.leaseToken)
    : { authorizationToken: job.leaseToken };
  if (!authorization) return { processed: 0, failed: 0 };
  try {
    await dependencies.storage.deleteObject(job.storageKey);
    await dependencies.repository.complete(job.id, authorization.authorizationToken, now);
    return { processed: 1, failed: 0 };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Object deletion failed";
    await dependencies.repository.fail(job.id, authorization.authorizationToken, message, now);
    return { processed: 0, failed: 1 };
  }
}
