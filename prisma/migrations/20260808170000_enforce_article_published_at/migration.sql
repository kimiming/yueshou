-- Demote legacy rows that cannot satisfy the publication contract. Do not invent dates.
UPDATE "Article"
SET "status" = 'DRAFT'
WHERE "status" = 'PUBLISHED'
  AND "publishedAt" IS NULL;

ALTER TABLE "Article"
ADD CONSTRAINT "Article_published_at_check"
CHECK ("status" <> 'PUBLISHED' OR "publishedAt" IS NOT NULL);
