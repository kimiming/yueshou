import { redirect } from "next/navigation";
import { createAdminLoginPage } from "@/components/admin/login-page";
import { getOptionalUser } from "@/lib/auth/permissions";

export default createAdminLoginPage({ getUser: getOptionalUser, redirect });
