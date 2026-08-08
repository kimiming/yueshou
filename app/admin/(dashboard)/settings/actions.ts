"use server";

import { revalidatePath } from "next/cache";

import { createAdminEditorService } from "@/features/admin/editors";
import { prismaAdminEditorRepository } from "@/features/admin/repository";
import { invalidateMarketingShell, invalidatePublishedEntity } from "@/features/publishing/cache";
import { requireUser } from "@/lib/auth/permissions";
import { SUPPORTED_LOCALES } from "@/lib/i18n/config";

function payload(input: unknown) {
  if (!(input instanceof FormData)) return input;
  const value = input.get("payload");
  if (typeof value !== "string") throw new Error("Missing editor payload");
  return JSON.parse(value) as unknown;
}

function editorService() {
  return createAdminEditorService({
    repository: prismaAdminEditorRepository,
    invalidate: (type, slug) => invalidatePublishedEntity(type, slug, SUPPORTED_LOCALES),
  });
}

export async function saveSiteSettingAction(input: unknown) {
  const actor = await requireUser();
  const result = await editorService().saveSiteSetting({ ...(payload(input) as object), actor });
  revalidatePath("/admin/settings");
  invalidateMarketingShell(SUPPORTED_LOCALES);
  void result;
}
