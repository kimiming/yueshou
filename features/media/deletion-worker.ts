import type { ObjectStorage } from "@/lib/storage";

export type MediaDeletionJobRepository = {
  claimDue(now: Date): Promise<{ id: string; storageKey: string; attempts: number } | null>;
  complete(id: string, completedAt: Date): Promise<void>;
  fail(id: string, message: string, failedAt: Date): Promise<void>;
};

export async function processDueMediaDeletionJobs(dependencies: {
  repository: MediaDeletionJobRepository;
  storage: Pick<ObjectStorage, "deleteObject">;
  now?: () => Date;
}) {
  const now = dependencies.now?.() ?? new Date();
  const job = await dependencies.repository.claimDue(now);
  if (!job) return { processed: 0, failed: 0 };
  try {
    await dependencies.storage.deleteObject(job.storageKey);
    await dependencies.repository.complete(job.id, now);
    return { processed: 1, failed: 0 };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Object deletion failed";
    await dependencies.repository.fail(job.id, message, now);
    return { processed: 0, failed: 1 };
  }
}
