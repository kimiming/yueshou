import { AdminPageTitle, Card } from "@/components/admin/antd-server-bridge";

import { UserForm, UserUpdateForm } from "@/components/admin/domain-forms";
import { adminValueLabel } from "@/components/admin/admin-labels";
import { requireRole } from "@/lib/auth/permissions";
import { prisma } from "@/lib/db/prisma";

import { createUserAction, updateUserAction } from "./actions";

export default async function UsersPage() {
  const actor = await requireRole("ADMIN");
  const users = await prisma.user.findMany({ where: { deletedAt: null }, orderBy: { createdAt: "desc" } });
  return <main><AdminPageTitle level={1}>用户管理</AdminPageTitle><UserForm save={createUserAction} /><Card title="账号列表"><div className="admin-record-list">{users.map((user) => <Card key={user.id} title={user.email} style={{ width: "100%" }}><p>{adminValueLabel(user.role)} · {user.isActive ? "已启用" : "已停用"}</p><UserUpdateForm user={user} update={updateUserAction} protectedAdmin={user.id === actor.id && user.role === "ADMIN"} /></Card>)}</div></Card></main>;
}
