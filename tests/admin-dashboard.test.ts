import { expect, it, vi } from "vitest";

import { getAdminDashboard, type AdminDashboardRepository } from "@/features/admin/dashboard";

it("returns typed repository facts without manufacturing dashboard metrics", async () => {
  const repository: AdminDashboardRepository = {
    countDraftContent: vi.fn(async () => 7),
    countMissingTranslations: vi.fn(async () => 11),
    countOpenInquiries: vi.fn(async () => 3),
    listRecentAuditEntries: vi.fn(async () => [
      { id: "audit-1", action: "ARTICLE_PUBLISHED", entityType: "Article", createdAt: new Date("2026-08-08T09:00:00.000Z") },
    ]),
  };

  await expect(getAdminDashboard(repository)).resolves.toEqual({
    draftContent: 7,
    missingTranslations: 11,
    openInquiries: 3,
    recentAuditEntries: [
      { id: "audit-1", action: "ARTICLE_PUBLISHED", entityType: "Article", createdAt: new Date("2026-08-08T09:00:00.000Z") },
    ],
  });
});
