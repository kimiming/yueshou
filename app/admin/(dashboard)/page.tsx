import { TrafficDashboard } from "@/components/admin/traffic-dashboard";
import { getTrafficDashboard } from "@/features/analytics/dashboard";
import { requireUser } from "@/lib/auth/permissions";

export default async function AdminDashboardPage() {
  await requireUser();
  const data = await getTrafficDashboard();
  return <main><TrafficDashboard data={data} /></main>;
}
