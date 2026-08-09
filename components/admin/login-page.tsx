import { LoginForm } from "./login-form";
import type { AuthenticatedUser } from "@/lib/auth/permissions";

export function createAdminLoginPage(dependencies: { getUser(): Promise<AuthenticatedUser | null>; redirect(path: string): unknown }) {
  return async function AdminLoginPage() {
    const user = await dependencies.getUser();
    if (user) { dependencies.redirect("/admin"); return null; }
    return <main className="admin-login"><section className="admin-login__card admin-login__surface" aria-labelledby="staff-sign-in"><h1 id="staff-sign-in">员工登录</h1><p>请使用已授权的粤首员工账号登录。</p><LoginForm /></section></main>;
  };
}
