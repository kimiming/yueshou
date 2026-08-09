import { redirect } from "next/navigation";
import { createAdminDashboardLayout } from "@/components/admin/dashboard-layout";
import { getOptionalUser } from "@/lib/auth/permissions";

export default createAdminDashboardLayout({ getUser: getOptionalUser, redirect });
