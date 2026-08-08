import { Card, Typography } from "antd";

import { LoginForm } from "./login-form";
import type { AuthenticatedUser } from "@/lib/auth/permissions";

export function createAdminLoginPage(dependencies: { getUser(): Promise<AuthenticatedUser | null>; redirect(path: string): unknown }) {
  return async function AdminLoginPage() {
    const user = await dependencies.getUser();
    if (user) { dependencies.redirect("/admin"); return null; }
    return <main className="admin-login"><Card className="admin-login__card"><Typography.Title level={1}>Staff sign in</Typography.Title><Typography.Paragraph type="secondary">Use your authorized YueShou staff account.</Typography.Paragraph><LoginForm /></Card></main>;
  };
}
