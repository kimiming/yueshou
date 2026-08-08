"use server";

import { revalidatePath } from "next/cache";
import { createProductAdminService } from "@/features/admin/products";
import { prismaProductAdminRepository } from "@/features/admin/domain-repository";
import { invalidatePublishedEntity } from "@/features/publishing/cache";
import { requireUser } from "@/lib/auth/permissions";
import { prisma } from "@/lib/db/prisma";
import { SUPPORTED_LOCALES } from "@/lib/i18n/config";

const data = (input: unknown) => input instanceof FormData ? JSON.parse(String(input.get("payload") ?? "{}")) as object : input as object;
const service = () => createProductAdminService({ repository: prismaProductAdminRepository, invalidate: (type, slug) => invalidatePublishedEntity(type, slug, SUPPORTED_LOCALES) });
export async function saveProductAction(input: unknown) { const actor = await requireUser(); const payload = data(input) as { id?: string }; const before = payload.id ? await prisma.product.findUnique({ where: { id: payload.id }, select: { slug: true, status: true } }) : null; const result = await service().save({ ...(payload as object), actor }); const after = await prisma.product.findUniqueOrThrow({ where: { id: result.id }, select: { slug: true, status: true } }); if (before?.status === "PUBLISHED") invalidatePublishedEntity("product", before.slug, SUPPORTED_LOCALES); if (after.status === "PUBLISHED") invalidatePublishedEntity("product", after.slug, SUPPORTED_LOCALES); revalidatePath("/admin/products"); return result; }
export async function archiveProductCategoryAction(input: unknown) { const actor = await requireUser(); const payload = data(input) as { categoryId: string }; await service().archiveCategory({ categoryId: payload.categoryId, actor }); revalidatePath("/admin/products"); }
