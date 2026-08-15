ALTER TABLE "Inquiry" ADD COLUMN "whatsapp" TEXT;
ALTER TABLE "Inquiry" ADD COLUMN "source" TEXT NOT NULL DEFAULT 'REQUEST_QUOTE';
CREATE INDEX "Inquiry_source_createdAt_idx" ON "Inquiry"("source", "createdAt");
