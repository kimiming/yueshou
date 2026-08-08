import { prisma } from "@/lib/db/prisma";
import { SUPPORTED_LOCALES } from "@/lib/i18n/config";

import type { AdminDashboardRepository } from "./dashboard";

const requiredLocales = new Set(SUPPORTED_LOCALES.map((locale) => locale === "zh-CN" ? "zh_CN" : locale));

function missingLocaleCount(records: Array<{ translations: Array<{ locale: string }> }>): number {
  return records.reduce((total, record) => {
    const present = new Set(record.translations.map((translation) => translation.locale));
    return total + [...requiredLocales].filter((locale) => !present.has(locale)).length;
  }, 0);
}

export const prismaAdminDashboardRepository: AdminDashboardRepository = {
  async countDraftContent() {
    const counts = await Promise.all([
      prisma.page.count({ where: { status: "DRAFT", deletedAt: null } }),
      prisma.service.count({ where: { status: "DRAFT", deletedAt: null } }),
      prisma.product.count({ where: { status: "DRAFT", deletedAt: null } }),
      prisma.article.count({ where: { status: "DRAFT", deletedAt: null } }),
    ]);
    return counts.reduce((total, count) => total + count, 0);
  },

  async countMissingTranslations() {
    const groups = await Promise.all([
      prisma.page.findMany({ where: { deletedAt: null }, select: { translations: { select: { locale: true } } } }),
      prisma.service.findMany({ where: { deletedAt: null }, select: { translations: { select: { locale: true } } } }),
      prisma.product.findMany({ where: { deletedAt: null }, select: { translations: { select: { locale: true } } } }),
      prisma.article.findMany({ where: { deletedAt: null }, select: { translations: { select: { locale: true } } } }),
    ]);
    return groups.reduce((total, records) => total + missingLocaleCount(records), 0);
  },

  countOpenInquiries() {
    return prisma.inquiry.count({ where: { status: { in: ["NEW", "IN_PROGRESS"] } } });
  },

  listRecentAuditEntries() {
    return prisma.auditLog.findMany({
      orderBy: { createdAt: "desc" },
      take: 5,
      select: { id: true, action: true, entityType: true, createdAt: true },
    });
  },
};
