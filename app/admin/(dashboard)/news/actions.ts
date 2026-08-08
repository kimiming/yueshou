"use server";

import { revalidatePath } from "next/cache";
import { prismaNewsAdminRepository } from "@/features/admin/domain-repository";
import { createNewsAdminService } from "@/features/admin/news";
import { invalidatePublishedEntity } from "@/features/publishing/cache";
import { requireUser } from "@/lib/auth/permissions";
import { SUPPORTED_LOCALES } from "@/lib/i18n/config";

const data = (input: unknown) => input instanceof FormData ? JSON.parse(String(input.get("payload") ?? "{}")) as object : input as object;
const service = () => createNewsAdminService({ repository: prismaNewsAdminRepository, invalidate: (type, slug) => invalidatePublishedEntity(type, slug, SUPPORTED_LOCALES) });
export async function saveArticleAction(input: unknown) { const actor = await requireUser(); const result = await service().save({ ...(data(input) as object), actor }); revalidatePath("/admin/news"); return result; }
export async function archiveArticleCategoryAction(input: unknown) { const actor = await requireUser(); const payload = data(input) as { categoryId: string }; await service().archiveCategory({ categoryId: payload.categoryId, actor }); revalidatePath("/admin/news"); }
