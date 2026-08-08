import { LoginForm } from "./login-form";
import type { AuthenticatedUser } from "@/lib/auth/permissions";

export function createAdminLoginPage(dependencies: { getUser(): Promise<AuthenticatedUser | null>; redirect(path: string): unknown }) {
  return async function AdminLoginPage() {
    const user = await dependencies.getUser();
    if (user) { dependencies.redirect("/admin"); return null; }
    return <main className="admin-login"><section className="admin-login__card" aria-labelledby="staff-sign-in"><h1 id="staff-sign-in">Staff sign in</h1><p>Use your authorized YueShou staff account.</p><LoginForm /></section></main>;
  };
}
