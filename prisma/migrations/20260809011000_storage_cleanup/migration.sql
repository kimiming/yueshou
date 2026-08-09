ALTER TYPE "MediaDeletionJobStatus" ADD VALUE IF NOT EXISTS 'DEAD_LETTER';

CREATE TYPE "StorageDeletionJobStatus" AS ENUM (
  'PENDING',
  'PROCESSING',
  'DELETING',
  'COMPLETED',
  'FAILED',
  'DEAD_LETTER',
  'CANCELLED'
);

CREATE TYPE "StorageDeletionKind" AS ENUM (
  'MEDIA_PENDING',
  'MEDIA_FINAL',
  'INQUIRY_TEMP',
  'INQUIRY_FINAL'
);

ALTER TABLE "MediaDeletionJob"
  ADD COLUMN "maxAttempts" INTEGER NOT NULL DEFAULT 8,
  ADD COLUMN "deadLetterAt" TIMESTAMP(3);

ALTER TABLE "MediaDeletionJob"
  DROP CONSTRAINT "MediaDeletionJob_mediaAssetId_fkey";

ALTER TABLE "MediaDeletionJob"
  ADD CONSTRAINT "MediaDeletionJob_mediaAssetId_fkey"
  FOREIGN KEY ("mediaAssetId") REFERENCES "MediaAsset"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "MediaUploadIntent"
  ADD COLUMN "finalStorageKey" TEXT;

CREATE UNIQUE INDEX "MediaUploadIntent_finalStorageKey_key"
  ON "MediaUploadIntent"("finalStorageKey");

-- Existing unconsumed uploads used final-prefix keys and cannot be safely
-- normalized in-place. Expiring them forces a new pending-prefix upload while
-- the maintenance sweep durably queues their legacy object keys.
UPDATE "MediaUploadIntent"
SET "expiresAt" = CURRENT_TIMESTAMP
WHERE "consumedAt" IS NULL;

CREATE TABLE "StorageDeletionJob" (
  "id" TEXT NOT NULL,
  "storageKey" TEXT NOT NULL,
  "kind" "StorageDeletionKind" NOT NULL,
  "sourceType" TEXT NOT NULL,
  "sourceId" TEXT,
  "status" "StorageDeletionJobStatus" NOT NULL DEFAULT 'PENDING',
  "notBefore" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "attempts" INTEGER NOT NULL DEFAULT 0,
  "maxAttempts" INTEGER NOT NULL DEFAULT 8,
  "leaseUntil" TIMESTAMP(3),
  "leaseToken" TEXT,
  "lastError" TEXT,
  "completedAt" TIMESTAMP(3),
  "deadLetterAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "StorageDeletionJob_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "StorageDeletionJob_storageKey_key"
  ON "StorageDeletionJob"("storageKey");
CREATE INDEX "StorageDeletionJob_status_notBefore_idx"
  ON "StorageDeletionJob"("status", "notBefore");
CREATE INDEX "StorageDeletionJob_sourceType_sourceId_idx"
  ON "StorageDeletionJob"("sourceType", "sourceId");
