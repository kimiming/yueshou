export type RecentAuditEntry = { id: string; action: string; entityType: string; createdAt: Date };

export interface AdminDashboardRepository {
  countDraftContent(): Promise<number>;
  countMissingTranslations(): Promise<number>;
  countOpenInquiries(): Promise<number>;
  listRecentAuditEntries(): Promise<RecentAuditEntry[]>;
}

export async function getAdminDashboard(repository: AdminDashboardRepository) {
  const [draftContent, missingTranslations, openInquiries, recentAuditEntries] = await Promise.all([
    repository.countDraftContent(),
    repository.countMissingTranslations(),
    repository.countOpenInquiries(),
    repository.listRecentAuditEntries(),
  ]);
  return { draftContent, missingTranslations, openInquiries, recentAuditEntries };
}
