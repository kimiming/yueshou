CREATE TYPE "MediaDeletionJobStatus" AS ENUM ('PENDING', 'PROCESSING', 'COMPLETED', 'FAILED');

CREATE TABLE "MediaDeletionJob" (
    "id" TEXT NOT NULL,
    "mediaAssetId" TEXT NOT NULL,
    "storageKey" TEXT NOT NULL,
    "status" "MediaDeletionJobStatus" NOT NULL DEFAULT 'PENDING',
    "deleteAfter" TIMESTAMP(3) NOT NULL,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "leaseUntil" TIMESTAMP(3),
    "lastError" TEXT,
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "MediaDeletionJob_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "MediaDeletionJob_mediaAssetId_key" ON "MediaDeletionJob"("mediaAssetId");
CREATE INDEX "MediaDeletionJob_status_deleteAfter_idx" ON "MediaDeletionJob"("status", "deleteAfter");
ALTER TABLE "MediaDeletionJob" ADD CONSTRAINT "MediaDeletionJob_mediaAssetId_fkey" FOREIGN KEY ("mediaAssetId") REFERENCES "MediaAsset"("id") ON DELETE CASCADE ON UPDATE CASCADE;
