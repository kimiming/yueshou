"use server";

import { revalidatePath } from "next/cache";

import { createAdminEditorService } from "@/features/admin/editors";
import { prismaAdminEditorRepository } from "@/features/admin/repository";
import { invalidatePublishedEntity } from "@/features/publishing/cache";
import { requireUser } from "@/lib/auth/permissions";
import { SUPPORTED_LOCALES } from "@/lib/i18n/config";

function readPayload(input: unknown) { if (!(input instanceof FormData)) return input; const value = input.get("payload"); if (typeof value !== "string") throw new Error("Missing editor payload"); return JSON.parse(value) as object; }
function service() { return createAdminEditorService({ repository: prismaAdminEditorRepository, invalidate: (type, slug) => invalidatePublishedEntity(type, slug, SUPPORTED_LOCALES) }); }
function refresh(id: string) { revalidatePath(`/admin/pages/${id}`); }

export async function savePageAction(input: unknown) { const actor = await requireUser(); const result = await service().savePage({ ...(readPayload(input) as object), actor }); refresh(result.id); }
export async function savePageSectionAction(input: unknown) { const actor = await requireUser(); const body = readPayload(input) as { pageId: string }; await service().savePageSection({ ...body, actor }); refresh(body.pageId); }
export async function reorderPageSectionsAction(input: unknown) { const actor = await requireUser(); const body = readPayload(input) as { pageId: string; orderedIds: string[] }; await service().reorderPageSections({ ...body, actor }); refresh(body.pageId); }
export async function setPageStatusAction(input: unknown) { const actor = await requireUser(); const body = readPayload(input) as { pageId: string; version: string; status: "DRAFT" | "PUBLISHED" | "ARCHIVED" }; await service().setPageStatus({ ...body, actor }); refresh(body.pageId); }
