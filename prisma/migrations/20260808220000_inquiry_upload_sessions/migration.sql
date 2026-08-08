CREATE TABLE "InquiryUploadSession" (
  "id" TEXT NOT NULL, "secretDigest" TEXT NOT NULL, "emailDigest" TEXT NOT NULL, "ipDigest" TEXT,
  "expiresAt" TIMESTAMP(3) NOT NULL, "maxFiles" INTEGER NOT NULL DEFAULT 5, "maxBytes" INTEGER NOT NULL DEFAULT 78643200,
  "usedFiles" INTEGER NOT NULL DEFAULT 0, "usedBytes" INTEGER NOT NULL DEFAULT 0, "consumedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, CONSTRAINT "InquiryUploadSession_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "InquiryUploadSession_emailDigest_expiresAt_idx" ON "InquiryUploadSession"("emailDigest", "expiresAt");
CREATE INDEX "InquiryUploadSession_expiresAt_consumedAt_idx" ON "InquiryUploadSession"("expiresAt", "consumedAt");
ALTER TABLE "InquiryUploadIntent" ADD COLUMN "uploadSessionId" TEXT;
INSERT INTO "InquiryUploadSession" (
  "id", "secretDigest", "emailDigest", "ipDigest", "expiresAt", "maxFiles", "maxBytes",
  "usedFiles", "usedBytes", "consumedAt", "createdAt"
)
SELECT
  'legacy-' || "id", "submissionHash", "actorHash", NULL, "expiresAt", 5, 78643200,
  1, "sizeBytes", CURRENT_TIMESTAMP, "createdAt"
FROM "InquiryUploadIntent";
UPDATE "InquiryUploadIntent" SET "uploadSessionId" = 'legacy-' || "id";
ALTER TABLE "InquiryUploadIntent" ALTER COLUMN "uploadSessionId" SET NOT NULL;
DROP INDEX "InquiryUploadIntent_submissionHash_expiresAt_idx";
ALTER TABLE "InquiryUploadIntent" DROP COLUMN "submissionHash", DROP COLUMN "sessionHash", DROP COLUMN "actorHash";
CREATE INDEX "InquiryUploadIntent_uploadSessionId_expiresAt_idx" ON "InquiryUploadIntent"("uploadSessionId", "expiresAt");
ALTER TABLE "InquiryUploadIntent" ADD CONSTRAINT "InquiryUploadIntent_uploadSessionId_fkey" FOREIGN KEY ("uploadSessionId") REFERENCES "InquiryUploadSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;
