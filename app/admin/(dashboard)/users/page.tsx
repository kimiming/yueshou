import { Card, List, Switch, Typography } from "antd";
import { UserForm } from "@/components/admin/domain-forms";
import { requireRole } from "@/lib/auth/permissions";
import { prisma } from "@/lib/db/prisma";
import { createUserAction, updateUserAction } from "./actions";
export default async function UsersPage() { const actor = await requireRole("ADMIN"); const users = await prisma.user.findMany({ where: { deletedAt: null }, orderBy: { createdAt: "desc" } }); return <main><Typography.Title level={1}>Users</Typography.Title><UserForm save={createUserAction} /><Card title="Accounts"><List dataSource={users} renderItem={(user) => <List.Item actions={[<form key="disable" action={async () => { "use server"; await updateUserAction({ id: user.id, isActive: !user.isActive }); }}><Switch checked={user.isActive} disabled={user.id === actor.id && user.role === "ADMIN"} aria-label={`Toggle ${user.email}`} /></form>] }><List.Item.Meta title={user.email} description={`${user.role} · ${user.isActive ? "active" : "disabled"}`} /></List.Item>} /></Card></main>; }
