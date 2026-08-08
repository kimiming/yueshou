ALTER TABLE "Product" ADD COLUMN "scheduledAt" TIMESTAMP(3);
ALTER TABLE "Article" ADD COLUMN "scheduledAt" TIMESTAMP(3);
CREATE INDEX "Product_scheduledAt_idx" ON "Product"("scheduledAt");
CREATE INDEX "Article_scheduledAt_idx" ON "Article"("scheduledAt");
