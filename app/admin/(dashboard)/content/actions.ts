"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";

import { createAdminEditorService } from "@/features/admin/editors";
import { prismaAdminEditorRepository } from "@/features/admin/repository";
import { isGenericPageSlug } from "@/features/content/public-slug";
import { invalidatePublishedEntity } from "@/features/publishing/cache";
import { requireUser } from "@/lib/auth/permissions";
import { SUPPORTED_LOCALES } from "@/lib/i18n/config";

function payload(input: unknown) {
  if (!(input instanceof FormData)) return input as Record<string, unknown>;
  return JSON.parse(String(input.get("payload") ?? "{}")) as Record<string, unknown>;
}

export async function createPageAction(input: unknown) {
  const actor = await requireUser();
  const body = payload(input);
  if (typeof body.slug !== "string" || !isGenericPageSlug(body.slug)) {
    throw new Error("Choose a non-reserved public page slug");
  }
  const service = createAdminEditorService({
    repository: prismaAdminEditorRepository,
    invalidate: (type, slug) => invalidatePublishedEntity(type, slug, SUPPORTED_LOCALES),
  });
  const result = await service.savePage({ ...body, actor });
  revalidatePath("/admin/content");
  redirect(`/admin/pages/${result.id}`);
}
