-- A page that requires legal review may only be published after an approval
-- timestamp has been recorded. Non-legal pages and drafts remain valid.
UPDATE "Page"
SET
  "status" = 'DRAFT',
  "publishedAt" = NULL
WHERE "status" = 'PUBLISHED'
  AND "legalReviewStatus" <> 'NOT_REQUIRED'
  AND (
    "legalReviewStatus" <> 'APPROVED'
    OR "legalReviewedAt" IS NULL
  );

ALTER TABLE "Page"
ADD CONSTRAINT "Page_published_legal_review_check"
CHECK (
  "status" <> 'PUBLISHED'
  OR "legalReviewStatus" = 'NOT_REQUIRED'
  OR (
    "legalReviewStatus" = 'APPROVED'
    AND "legalReviewedAt" IS NOT NULL
  )
);
