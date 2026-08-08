"use server";

import { revalidatePath } from "next/cache";

import { createAdminEditorService } from "@/features/admin/editors";
import { prismaAdminEditorRepository } from "@/features/admin/repository";
import { invalidatePublishedEntity } from "@/features/publishing/cache";
import { requireUser } from "@/lib/auth/permissions";
import { SUPPORTED_LOCALES } from "@/lib/i18n/config";

function readPayload(input: unknown) { if (!(input instanceof FormData)) return input; const value = input.get("payload"); if (typeof value !== "string") throw new Error("Missing editor payload"); return JSON.parse(value) as object; }
function service() { return createAdminEditorService({ repository: prismaAdminEditorRepository, invalidate: (type, slug) => invalidatePublishedEntity(type, slug, SUPPORTED_LOCALES) }); }

export async function saveMediaMetadataAction(input: unknown) { const actor = await requireUser(); await service().saveMediaMetadata({ ...(readPayload(input) as object), actor }); revalidatePath("/admin/media"); }
export async function archiveMediaAction(input: unknown) { const actor = await requireUser(); await service().archiveMedia({ ...(readPayload(input) as object), actor }); revalidatePath("/admin/media"); }
