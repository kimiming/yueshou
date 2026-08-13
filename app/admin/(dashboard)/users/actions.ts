"use server";

import { revalidatePath } from "next/cache";
import { prismaUserAdminRepository } from "@/features/admin/domain-repository";
import { createUserAdminService } from "@/features/admin/users";
import { requireRole } from "@/lib/auth/permissions";
import { prisma } from "@/lib/db/prisma";
import { z } from "zod";

const data = (input: unknown) => input instanceof FormData ? JSON.parse(String(input.get("payload") ?? "{}")) as object : input as object;
const service = () => createUserAdminService({ repository: prismaUserAdminRepository });
export async function createUserAction(input: unknown) { const actor = await requireRole("ADMIN"); const payload = data(input) as { email: string; password: string; role: "ADMIN" | "EDITOR" }; const result = await service().create({ ...payload, actor }); revalidatePath("/admin/users"); return result; }
export async function updateUserAction(input: unknown) { const actor = await requireRole("ADMIN"); const payload = data(input) as { id: string; role?: "ADMIN" | "EDITOR"; isActive?: boolean; password?: string }; await service().update({ ...payload, actor }); revalidatePath("/admin/users"); }
export async function deleteUserAction(input: unknown) { const actor = await requireRole("ADMIN"); const { id } = z.object({ id: z.string().min(1) }).parse(data(input)); if (id === actor.id) throw new Error("不能删除当前登录账号"); const user = await prisma.user.findFirst({ where: { id, deletedAt: null } }); if (!user) return; if (user.role === "ADMIN" && user.isActive && await prisma.user.count({ where: { role: "ADMIN", isActive: true, deletedAt: null } }) <= 1) throw new Error("不能删除最后一个管理员"); await prisma.$transaction(async (tx) => { await tx.user.update({ where: { id }, data: { isActive: false, deletedAt: new Date() } }); await tx.auditLog.create({ data: { actorId: actor.id, action: "USER_DELETED", entityType: "User", entityId: id } }); }); revalidatePath("/admin/users"); }
