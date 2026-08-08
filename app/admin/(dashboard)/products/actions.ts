"use server";

import { revalidatePath } from "next/cache";
import { createProductAdminService } from "@/features/admin/products";
import { prismaProductAdminRepository } from "@/features/admin/domain-repository";
import { invalidatePublishedEntity } from "@/features/publishing/cache";
import { requireUser } from "@/lib/auth/permissions";
import { prisma } from "@/lib/db/prisma";
import { SUPPORTED_LOCALES } from "@/lib/i18n/config";
import { z } from "zod";

const data = (input: unknown) => input instanceof FormData ? JSON.parse(String(input.get("payload") ?? "{}")) as object : input as object;
const service = () => createProductAdminService({ repository: prismaProductAdminRepository, invalidate: (type, slug) => invalidatePublishedEntity(type, slug, SUPPORTED_LOCALES) });
export async function saveProductAction(input: unknown) { const actor = await requireUser(); const payload = data(input) as { id?: string }; const before = payload.id ? await prisma.product.findUnique({ where: { id: payload.id }, select: { slug: true, status: true } }) : null; const result = await service().save({ ...(payload as object), actor }); const after = await prisma.product.findUniqueOrThrow({ where: { id: result.id }, select: { slug: true, status: true } }); if (before?.status === "PUBLISHED") invalidatePublishedEntity("product", before.slug, SUPPORTED_LOCALES); if (after.status === "PUBLISHED") invalidatePublishedEntity("product", after.slug, SUPPORTED_LOCALES); revalidatePath("/admin/products"); return result; }
export async function archiveProductCategoryAction(input: unknown) { const actor = await requireUser(); const payload = data(input) as { categoryId: string }; await service().archiveCategory({ categoryId: payload.categoryId, actor }); revalidatePath("/admin/products"); }
export async function saveProductCategoryAction(input: unknown) { const actor = await requireUser(); const payload = z.object({ id: z.string().optional(), slug: z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/), title: z.string().trim().min(1).max(160), body: z.string().trim().max(4_000).default("") }).parse(data(input)); await prisma.$transaction(async (tx) => { const category = payload.id ? await tx.productCategory.update({ where: { id: payload.id }, data: { slug: payload.slug } }) : await tx.productCategory.create({ data: { slug: payload.slug } }); await tx.productCategoryTranslation.upsert({ where: { productCategoryId_locale: { productCategoryId: category.id, locale: "en" } }, update: { title: payload.title, body: payload.body }, create: { productCategoryId: category.id, locale: "en", title: payload.title, body: payload.body } }); await tx.auditLog.create({ data: { actorId: actor.id, action: "PRODUCT_CATEGORY_SAVED", entityType: "ProductCategory", entityId: category.id } }); }); revalidatePath("/admin/products"); }
