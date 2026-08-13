import { AdminPageTitle, Card } from "@/components/admin/antd-server-bridge";
import { UserManagement } from "@/components/admin/user-management";
import { requireRole } from "@/lib/auth/permissions";
import { prisma } from "@/lib/db/prisma";
import { createUserAction, deleteUserAction, updateUserAction } from "./actions";

export default async function UsersPage() { const actor = await requireRole("ADMIN"); const users = await prisma.user.findMany({ where: { deletedAt: null }, orderBy: { createdAt: "desc" } }); return <main><AdminPageTitle level={1}>用户管理</AdminPageTitle><Card><UserManagement users={users.map((user) => ({ id: user.id, email: user.email, role: user.role, isActive: user.isActive, createdAt: user.createdAt.toLocaleString("zh-CN"), protected: user.id === actor.id && user.role === "ADMIN" }))} create={createUserAction} update={updateUserAction} remove={deleteUserAction} /></Card></main>; }
