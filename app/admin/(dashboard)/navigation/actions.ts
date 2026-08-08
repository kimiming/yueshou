"use server";

import { revalidatePath } from "next/cache";

import { createAdminEditorService } from "@/features/admin/editors";
import { prismaAdminEditorRepository } from "@/features/admin/repository";
import { invalidatePublishedEntity } from "@/features/publishing/cache";
import { requireUser } from "@/lib/auth/permissions";
import { SUPPORTED_LOCALES } from "@/lib/i18n/config";

function readPayload(input: unknown) {
  if (!(input instanceof FormData)) return input;
  const value = input.get("payload");
  if (typeof value !== "string") throw new Error("Missing editor payload");
  return JSON.parse(value) as object;
}
function service() { return createAdminEditorService({ repository: prismaAdminEditorRepository, invalidate: (type, slug) => invalidatePublishedEntity(type, slug, SUPPORTED_LOCALES) }); }
function refreshNavigation() { revalidatePath("/admin/navigation"); for (const locale of SUPPORTED_LOCALES) revalidatePath(`/${locale}`); }

export async function saveNavigationItemAction(input: unknown) { const actor = await requireUser(); await service().saveNavigationItem({ ...(readPayload(input) as object), actor }); refreshNavigation(); }
export async function reorderNavigationAction(input: unknown) { const actor = await requireUser(); await service().reorderNavigation({ ...(readPayload(input) as object), actor }); refreshNavigation(); }
