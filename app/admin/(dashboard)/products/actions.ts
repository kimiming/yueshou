"use server";

import { revalidatePath } from "next/cache";
import { createProductAdminService } from "@/features/admin/products";
import { prismaProductAdminRepository } from "@/features/admin/domain-repository";
import { invalidatePublishedEntity } from "@/features/publishing/cache";
import { requireUser } from "@/lib/auth/permissions";
import { SUPPORTED_LOCALES } from "@/lib/i18n/config";

const data = (input: unknown) => input instanceof FormData ? JSON.parse(String(input.get("payload") ?? "{}")) as object : input as object;
const service = () => createProductAdminService({ repository: prismaProductAdminRepository, invalidate: (type, slug) => invalidatePublishedEntity(type, slug, SUPPORTED_LOCALES) });
export async function saveProductAction(input: unknown) { const actor = await requireUser(); const result = await service().save({ ...(data(input) as object), actor }); revalidatePath("/admin/products"); return result; }
export async function archiveProductCategoryAction(input: unknown) { const actor = await requireUser(); const payload = data(input) as { categoryId: string }; await service().archiveCategory({ categoryId: payload.categoryId, actor }); revalidatePath("/admin/products"); }
