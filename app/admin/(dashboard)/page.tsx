import { DashboardView } from "@/components/admin/dashboard-view";
import { getAdminDashboard } from "@/features/admin/dashboard";
import { prismaAdminDashboardRepository } from "@/features/admin/repository";
import { requireUser } from "@/lib/auth/permissions";

export default async function AdminDashboardPage() {
  await requireUser();
  const dashboard = await getAdminDashboard(prismaAdminDashboardRepository);

  return <DashboardView
    draftContent={dashboard.draftContent}
    missingTranslations={dashboard.missingTranslations}
    openInquiries={dashboard.openInquiries}
    recentAuditEntries={dashboard.recentAuditEntries.map((entry) => ({
      ...entry,
      createdAt: entry.createdAt.toISOString(),
    }))}
  />;
}
