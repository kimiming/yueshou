"use server";

import { revalidatePath } from "next/cache";

import { createAdminEditorService } from "@/features/admin/editors";
import { prismaAdminEditorRepository } from "@/features/admin/repository";
import { invalidatePublishedEntity } from "@/features/publishing/cache";
import { requireUser } from "@/lib/auth/permissions";
import { prisma } from "@/lib/db/prisma";
import { SUPPORTED_LOCALES } from "@/lib/i18n/config";

function readPayload(input: unknown) { if (!(input instanceof FormData)) return input; const value = input.get("payload"); if (typeof value !== "string") throw new Error("Missing editor payload"); return JSON.parse(value) as object; }
function service() { return createAdminEditorService({ repository: prismaAdminEditorRepository, invalidate: (type, slug) => invalidatePublishedEntity(type, slug, SUPPORTED_LOCALES) }); }
function refresh(id: string) { revalidatePath(`/admin/pages/${id}`); }
async function invalidatePublishedPage(pageId: string, oldSlug?: string) { const record = await prisma.page.findUnique({ where: { id: pageId }, select: { slug: true, status: true } }); if (oldSlug) invalidatePublishedEntity("page", oldSlug, SUPPORTED_LOCALES); if (record?.status === "PUBLISHED") invalidatePublishedEntity("page", record.slug, SUPPORTED_LOCALES); }

export async function savePageAction(input: unknown) { const actor = await requireUser(); const body = readPayload(input) as { id?: string }; const old = body.id ? await prisma.page.findUnique({ where: { id: body.id }, select: { slug: true } }) : null; const result = await service().savePage({ ...body, actor }); await invalidatePublishedPage(result.id, old?.slug); refresh(result.id); }
export async function savePageSectionAction(input: unknown) { const actor = await requireUser(); const body = readPayload(input) as { pageId: string }; await service().savePageSection({ ...body, actor }); await invalidatePublishedPage(body.pageId); refresh(body.pageId); }
export async function reorderPageSectionsAction(input: unknown) { const actor = await requireUser(); const body = readPayload(input) as { pageId: string; orderedIds: string[] }; await service().reorderPageSections({ ...body, actor }); await invalidatePublishedPage(body.pageId); refresh(body.pageId); }
export async function setPageStatusAction(input: unknown) { const actor = await requireUser(); const body = readPayload(input) as { pageId: string; version: string; status: "DRAFT" | "PUBLISHED" | "ARCHIVED" }; const old = await prisma.page.findUnique({ where: { id: body.pageId }, select: { slug: true, status: true } }); await service().setPageStatus({ ...body, actor }); await invalidatePublishedPage(body.pageId, old?.status === "PUBLISHED" ? old.slug : undefined); refresh(body.pageId); }
