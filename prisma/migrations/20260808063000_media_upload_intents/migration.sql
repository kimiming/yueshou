-- CreateTable
CREATE TABLE "MediaUploadIntent" (
    "id" TEXT NOT NULL,
    "storageKey" TEXT NOT NULL,
    "actorId" TEXT NOT NULL,
    "filename" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "extension" TEXT NOT NULL,
    "sizeBytes" INTEGER NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "consumedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MediaUploadIntent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "MediaUploadIntent_storageKey_key" ON "MediaUploadIntent"("storageKey");

-- CreateIndex
CREATE INDEX "MediaUploadIntent_actorId_expiresAt_idx" ON "MediaUploadIntent"("actorId", "expiresAt");

-- CreateIndex
CREATE INDEX "MediaUploadIntent_expiresAt_consumedAt_idx" ON "MediaUploadIntent"("expiresAt", "consumedAt");

-- AddForeignKey
ALTER TABLE "MediaUploadIntent" ADD CONSTRAINT "MediaUploadIntent_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
