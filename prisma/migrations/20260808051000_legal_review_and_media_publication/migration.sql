-- CreateEnum
CREATE TYPE "LegalReviewStatus" AS ENUM ('NOT_REQUIRED', 'PENDING', 'APPROVED');

-- AlterTable
ALTER TABLE "Page"
ADD COLUMN "legalReviewStatus" "LegalReviewStatus" NOT NULL DEFAULT 'NOT_REQUIRED',
ADD COLUMN "legalReviewedAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "MediaAsset"
ADD COLUMN "publishedAt" TIMESTAMP(3);

-- Mark the required legal templates as pending legal review without changing
-- pages that have already been explicitly reviewed.
UPDATE "Page"
SET "legalReviewStatus" = 'PENDING'
WHERE "slug" IN ('terms', 'privacy', 'ruo-policy', 'shipping-compliance', 'cookie-policy')
  AND "legalReviewStatus" = 'NOT_REQUIRED';
