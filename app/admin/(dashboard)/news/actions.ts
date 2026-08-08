"use server";

import { revalidatePath } from "next/cache";
import { prismaNewsAdminRepository } from "@/features/admin/domain-repository";
import { createNewsAdminService } from "@/features/admin/news";
import { invalidatePublishedEntity } from "@/features/publishing/cache";
import { requireUser } from "@/lib/auth/permissions";
import { prisma } from "@/lib/db/prisma";
import { SUPPORTED_LOCALES } from "@/lib/i18n/config";

const data = (input: unknown) => input instanceof FormData ? JSON.parse(String(input.get("payload") ?? "{}")) as object : input as object;
const service = () => createNewsAdminService({ repository: prismaNewsAdminRepository, invalidate: (type, slug) => invalidatePublishedEntity(type, slug, SUPPORTED_LOCALES) });
export async function saveArticleAction(input: unknown) { const actor = await requireUser(); const payload = data(input) as { id?: string }; const before = payload.id ? await prisma.article.findUnique({ where: { id: payload.id }, select: { slug: true, status: true } }) : null; const result = await service().save({ ...(payload as object), actor }); const after = await prisma.article.findUniqueOrThrow({ where: { id: result.id }, select: { slug: true, status: true } }); if (before?.status === "PUBLISHED") invalidatePublishedEntity("article", before.slug, SUPPORTED_LOCALES); if (after.status === "PUBLISHED") invalidatePublishedEntity("article", after.slug, SUPPORTED_LOCALES); revalidatePath("/admin/news"); return result; }
export async function archiveArticleCategoryAction(input: unknown) { const actor = await requireUser(); const payload = data(input) as { categoryId: string }; await service().archiveCategory({ categoryId: payload.categoryId, actor }); revalidatePath("/admin/news"); }
export async function archiveTagAction(input: unknown) { const actor = await requireUser(); const payload = data(input) as { tagId: string }; await service().archiveTag({ tagId: payload.tagId, actor }); revalidatePath("/admin/news"); }
