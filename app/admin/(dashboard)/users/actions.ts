"use server";

import { revalidatePath } from "next/cache";
import { prismaUserAdminRepository } from "@/features/admin/domain-repository";
import { createUserAdminService } from "@/features/admin/users";
import { requireRole } from "@/lib/auth/permissions";

const data = (input: unknown) => input instanceof FormData ? JSON.parse(String(input.get("payload") ?? "{}")) as object : input as object;
const service = () => createUserAdminService({ repository: prismaUserAdminRepository });
export async function createUserAction(input: unknown) { const actor = await requireRole("ADMIN"); const payload = data(input) as { email: string; password: string; role: "ADMIN" | "EDITOR" }; const result = await service().create({ ...payload, actor }); revalidatePath("/admin/users"); return result; }
export async function updateUserAction(input: unknown) { const actor = await requireRole("ADMIN"); const payload = data(input) as { id: string; role?: "ADMIN" | "EDITOR"; isActive?: boolean; password?: string }; await service().update({ ...payload, actor }); revalidatePath("/admin/users"); }
