import type { ReactNode } from "react";

import { AdminShell } from "./admin-shell";
import type { AuthenticatedUser } from "@/lib/auth/permissions";

export function createAdminDashboardLayout(dependencies: { getUser(): Promise<AuthenticatedUser | null>; redirect(path: string): unknown }) {
  return async function AdminDashboardLayout({ children }: { children: ReactNode }) {
    const user = await dependencies.getUser();
    if (!user) { dependencies.redirect("/admin/login"); return null; }
    return <AdminShell user={user}>{children}</AdminShell>;
  };
}
