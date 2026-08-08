import { Card, List, Typography } from "antd";

import { UserForm, UserUpdateForm } from "@/components/admin/domain-forms";
import { requireRole } from "@/lib/auth/permissions";
import { prisma } from "@/lib/db/prisma";

import { createUserAction, updateUserAction } from "./actions";

export default async function UsersPage() {
  const actor = await requireRole("ADMIN");
  const users = await prisma.user.findMany({ where: { deletedAt: null }, orderBy: { createdAt: "desc" } });
  return <main><Typography.Title level={1}>Users</Typography.Title><UserForm save={createUserAction} /><Card title="Accounts"><List dataSource={users} renderItem={(user) => <List.Item><Card title={user.email} style={{ width: "100%" }}><p>{user.role} · {user.isActive ? "active" : "disabled"}</p><UserUpdateForm user={user} update={updateUserAction} protectedAdmin={user.id === actor.id && user.role === "ADMIN"} /></Card></List.Item>} /></Card></main>;
}
