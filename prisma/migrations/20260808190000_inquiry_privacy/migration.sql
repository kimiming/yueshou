CREATE TABLE "InquiryUploadIntent" (
  "id" TEXT NOT NULL,
  "inquiryId" TEXT NOT NULL,
  "storageKey" TEXT NOT NULL,
  "inquiryTokenHash" TEXT NOT NULL,
  "sessionHash" TEXT NOT NULL,
  "actorHash" TEXT NOT NULL,
  "filename" TEXT NOT NULL,
  "mimeType" TEXT NOT NULL,
  "extension" TEXT NOT NULL,
  "sizeBytes" INTEGER NOT NULL,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "consumedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "InquiryUploadIntent_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "InquiryRateLimit" (
  "key" TEXT NOT NULL,
  "count" INTEGER NOT NULL,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "InquiryRateLimit_pkey" PRIMARY KEY ("key")
);

CREATE UNIQUE INDEX "InquiryUploadIntent_storageKey_key" ON "InquiryUploadIntent"("storageKey");
CREATE INDEX "InquiryUploadIntent_inquiryId_expiresAt_idx" ON "InquiryUploadIntent"("inquiryId", "expiresAt");
CREATE INDEX "InquiryUploadIntent_expiresAt_consumedAt_idx" ON "InquiryUploadIntent"("expiresAt", "consumedAt");
CREATE INDEX "InquiryRateLimit_expiresAt_idx" ON "InquiryRateLimit"("expiresAt");
ALTER TABLE "InquiryUploadIntent" ADD CONSTRAINT "InquiryUploadIntent_inquiryId_fkey"
  FOREIGN KEY ("inquiryId") REFERENCES "Inquiry"("id") ON DELETE CASCADE ON UPDATE CASCADE;
