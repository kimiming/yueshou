ALTER TABLE "MediaDeletionJob" ADD COLUMN "leaseUntil" TIMESTAMP(3);
ALTER TABLE "MediaDeletionJob" ADD COLUMN "leaseToken" TEXT;
