export type ClaimedStorageDeletionJob = {
  id: string;
  storageKey: string;
  leaseToken: string;
  deletionAuthorized?: boolean;
};

export type StorageSweepResult = {
  intentsQueued: number;
  sessionsDeleted: number;
  rateLimitsDeleted: number;
};

export interface StorageDeletionRepository {
  claimDue(now: Date): Promise<ClaimedStorageDeletionJob | null>;
  authorizeDeletion(job: ClaimedStorageDeletionJob, now: Date): Promise<{ authorizationToken: string } | null>;
  complete(id: string, authorizationToken: string, completedAt: Date): Promise<void>;
  fail(id: string, authorizationToken: string, message: string, failedAt: Date): Promise<void>;
  sweepExpired(now: Date, limit: number): Promise<StorageSweepResult>;
}

export async function processStorageDeletionBatch(dependencies: {
  repository: StorageDeletionRepository;
  storage: { deleteObject(key: string): Promise<void> };
  limit: number;
  now?: () => Date;
}) {
  const limit = Math.max(0, Math.floor(dependencies.limit));
  let processed = 0;
  let failed = 0;
  let cancelled = 0;

  for (let index = 0; index < limit; index += 1) {
    const now = dependencies.now?.() ?? new Date();
    const job = await dependencies.repository.claimDue(now);
    if (!job) break;
    const authorization = job.deletionAuthorized
      ? { authorizationToken: job.leaseToken }
      : await dependencies.repository.authorizeDeletion(job, now);
    if (!authorization) {
      cancelled += 1;
      continue;
    }
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

  return { processed, failed, cancelled };
}

export async function runStorageMaintenance(dependencies: {
  repository: StorageDeletionRepository;
  storage: { deleteObject(key: string): Promise<void> };
  sweepLimit: number;
  deletionLimit: number;
  now?: () => Date;
}) {
  const now = dependencies.now?.() ?? new Date();
  const sweep = await dependencies.repository.sweepExpired(now, Math.max(1, Math.floor(dependencies.sweepLimit)));
  const deletion = await processStorageDeletionBatch({
    repository: dependencies.repository,
    storage: dependencies.storage,
    limit: dependencies.deletionLimit,
    now: () => now,
  });
  return { sweep, deletion };
}
