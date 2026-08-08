-- A page that requires legal review may only be published after an approval
-- timestamp has been recorded. Non-legal pages and drafts remain valid.
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
