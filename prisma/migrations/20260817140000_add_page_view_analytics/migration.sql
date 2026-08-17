CREATE TABLE "PageView" (
  "id" TEXT NOT NULL,
  "path" TEXT NOT NULL,
  "locale" TEXT,
  "countryCode" TEXT,
  "deviceType" TEXT NOT NULL,
  "browser" TEXT NOT NULL,
  "viewedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "PageView_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "PageView_viewedAt_idx" ON "PageView"("viewedAt");
CREATE INDEX "PageView_countryCode_viewedAt_idx" ON "PageView"("countryCode", "viewedAt");
CREATE INDEX "PageView_deviceType_viewedAt_idx" ON "PageView"("deviceType", "viewedAt");
CREATE INDEX "PageView_browser_viewedAt_idx" ON "PageView"("browser", "viewedAt");
