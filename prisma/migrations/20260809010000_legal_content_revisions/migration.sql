ALTER TABLE "Page" DROP CONSTRAINT IF EXISTS "Page_published_legal_review_check";

ALTER TABLE "Page"
  ADD COLUMN "contentRevision" INTEGER NOT NULL DEFAULT 1,
  ADD COLUMN "legalReviewedRevision" INTEGER,
  ADD COLUMN "legalReviewedById" TEXT;

-- Historic approvals cannot prove which child translations/sections were reviewed.
-- Fail closed and require an administrator to reapprove the migrated revision.
UPDATE "Page"
SET
  "status" = 'DRAFT',
  "publishedAt" = NULL,
  "contentRevision" = "contentRevision" + 1,
  "legalReviewStatus" = 'PENDING',
  "legalReviewedAt" = NULL,
  "legalReviewedRevision" = NULL,
  "legalReviewedById" = NULL
WHERE "legalReviewStatus" <> 'NOT_REQUIRED'
   OR "slug" IN ('terms', 'privacy', 'ruo-policy', 'shipping-compliance', 'cookie-policy');

ALTER TABLE "Page"
  ADD CONSTRAINT "Page_legalReviewedById_fkey"
  FOREIGN KEY ("legalReviewedById") REFERENCES "User"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX "Page_legalReviewedById_idx" ON "Page"("legalReviewedById");

CREATE FUNCTION "enforceAdminLegalReviewer"()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW."legalReviewStatus" = 'APPROVED' AND NOT EXISTS (
    SELECT 1
    FROM "User"
    WHERE "id" = NEW."legalReviewedById"
      AND "role" = 'ADMIN'
      AND "isActive" = TRUE
      AND "deletedAt" IS NULL
  ) THEN
    RAISE EXCEPTION 'Legal revisions may only be approved by an active administrator'
      USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "Page_enforce_admin_legal_reviewer"
BEFORE INSERT OR UPDATE OF "legalReviewStatus", "legalReviewedById" ON "Page"
FOR EACH ROW EXECUTE FUNCTION "enforceAdminLegalReviewer"();

ALTER TABLE "Page"
  ADD CONSTRAINT "Page_content_revision_positive_check"
    CHECK ("contentRevision" > 0),
  ADD CONSTRAINT "Page_legal_slug_review_check"
    CHECK (
      "slug" NOT IN ('terms', 'privacy', 'ruo-policy', 'shipping-compliance', 'cookie-policy')
      OR "legalReviewStatus" <> 'NOT_REQUIRED'
    ),
  ADD CONSTRAINT "Page_legal_review_metadata_check"
    CHECK (
      (
        "legalReviewStatus" IN ('NOT_REQUIRED', 'PENDING')
        AND "legalReviewedAt" IS NULL
        AND "legalReviewedRevision" IS NULL
        AND "legalReviewedById" IS NULL
      )
      OR (
        "legalReviewStatus" = 'APPROVED'
        AND "legalReviewedAt" IS NOT NULL
        AND "legalReviewedRevision" = "contentRevision"
        AND "legalReviewedById" IS NOT NULL
      )
    ),
  ADD CONSTRAINT "Page_published_legal_review_check"
    CHECK (
      "status" <> 'PUBLISHED'
      OR "legalReviewStatus" = 'NOT_REQUIRED'
      OR (
        "legalReviewStatus" = 'APPROVED'
        AND "legalReviewedAt" IS NOT NULL
        AND "legalReviewedRevision" = "contentRevision"
        AND "legalReviewedById" IS NOT NULL
      )
    );

CREATE FUNCTION "invalidateLegalPageReview"("targetPageId" TEXT)
RETURNS VOID AS $$
  UPDATE "Page"
  SET
    "status" = 'DRAFT',
    "publishedAt" = NULL,
    "contentRevision" = "contentRevision" + 1,
    "legalReviewStatus" = 'PENDING',
    "legalReviewedAt" = NULL,
    "legalReviewedRevision" = NULL,
    "legalReviewedById" = NULL,
    "updatedAt" = CURRENT_TIMESTAMP
  WHERE "id" = "targetPageId"
    AND (
      "legalReviewStatus" <> 'NOT_REQUIRED'
      OR "slug" IN ('terms', 'privacy', 'ruo-policy', 'shipping-compliance', 'cookie-policy')
    );
$$ LANGUAGE SQL;

CREATE FUNCTION "invalidateLegalPageReviewFromTranslation"()
RETURNS TRIGGER AS $$
BEGIN
  PERFORM "invalidateLegalPageReview"(CASE WHEN TG_OP = 'DELETE' THEN OLD."pageId" ELSE NEW."pageId" END);
  IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "PageTranslation_invalidate_legal_review"
AFTER INSERT OR UPDATE OR DELETE ON "PageTranslation"
FOR EACH ROW EXECUTE FUNCTION "invalidateLegalPageReviewFromTranslation"();

CREATE FUNCTION "invalidateLegalPageReviewFromSection"()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    PERFORM "invalidateLegalPageReview"(OLD."pageId");
    RETURN OLD;
  END IF;
  IF TG_OP = 'UPDATE' AND OLD."pageId" IS DISTINCT FROM NEW."pageId" THEN
    PERFORM "invalidateLegalPageReview"(OLD."pageId");
  END IF;
  PERFORM "invalidateLegalPageReview"(NEW."pageId");
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "PageSection_insert_delete_invalidate_legal_review"
AFTER INSERT OR DELETE ON "PageSection"
FOR EACH ROW EXECUTE FUNCTION "invalidateLegalPageReviewFromSection"();

CREATE TRIGGER "PageSection_update_invalidate_legal_review"
AFTER UPDATE OF "pageId", "type", "position", "isEnabled", "config", "deletedAt" ON "PageSection"
FOR EACH ROW
WHEN (
  OLD."pageId" IS DISTINCT FROM NEW."pageId"
  OR OLD."type" IS DISTINCT FROM NEW."type"
  OR OLD."position" IS DISTINCT FROM NEW."position"
  OR OLD."isEnabled" IS DISTINCT FROM NEW."isEnabled"
  OR OLD."config" IS DISTINCT FROM NEW."config"
  OR OLD."deletedAt" IS DISTINCT FROM NEW."deletedAt"
)
EXECUTE FUNCTION "invalidateLegalPageReviewFromSection"();

CREATE FUNCTION "invalidateLegalPageReviewFromSectionTranslation"()
RETURNS TRIGGER AS $$
DECLARE
  "targetSectionId" TEXT;
  "targetPageId" TEXT;
BEGIN
  "targetSectionId" := CASE WHEN TG_OP = 'DELETE' THEN OLD."pageSectionId" ELSE NEW."pageSectionId" END;
  SELECT "pageId" INTO "targetPageId" FROM "PageSection" WHERE "id" = "targetSectionId";
  IF "targetPageId" IS NOT NULL THEN
    PERFORM "invalidateLegalPageReview"("targetPageId");
  END IF;
  IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "PageSectionTranslation_invalidate_legal_review"
AFTER INSERT OR UPDATE OR DELETE ON "PageSectionTranslation"
FOR EACH ROW EXECUTE FUNCTION "invalidateLegalPageReviewFromSectionTranslation"();

CREATE FUNCTION "invalidateLegalPageReviewFromSlug"()
RETURNS TRIGGER AS $$
BEGIN
  IF OLD."slug" IS DISTINCT FROM NEW."slug" AND (
    OLD."legalReviewStatus" <> 'NOT_REQUIRED'
    OR OLD."slug" IN ('terms', 'privacy', 'ruo-policy', 'shipping-compliance', 'cookie-policy')
    OR NEW."slug" IN ('terms', 'privacy', 'ruo-policy', 'shipping-compliance', 'cookie-policy')
  ) THEN
    NEW."status" := 'DRAFT';
    NEW."publishedAt" := NULL;
    NEW."contentRevision" := OLD."contentRevision" + 1;
    NEW."legalReviewStatus" := 'PENDING';
    NEW."legalReviewedAt" := NULL;
    NEW."legalReviewedRevision" := NULL;
    NEW."legalReviewedById" := NULL;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "Page_slug_invalidate_legal_review"
BEFORE UPDATE OF "slug" ON "Page"
FOR EACH ROW EXECUTE FUNCTION "invalidateLegalPageReviewFromSlug"();
