"use server";

import { revalidatePath } from "next/cache";

import { createAdminEditorService } from "@/features/admin/editors";
import { prismaAdminEditorRepository } from "@/features/admin/repository";
import { invalidateMarketingShell, invalidatePublishedEntity } from "@/features/publishing/cache";
import { requireUser } from "@/lib/auth/permissions";
import { prisma } from "@/lib/db/prisma";
import { SUPPORTED_LOCALES } from "@/lib/i18n/config";

function defaultMediaText(filename: string) {
  const text = filename.replace(/\.[^.]+$/, "").replace(/[-_]+/g, " ").trim();
  return text || "Homepage banner";
}

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

export async function saveHomepageBannerAction(input: unknown) {
  const actor = await requireUser();
  const body = payload(input) as { imageId?: string };
  let imageId: string | undefined;
  if (body.imageId) {
    const asset = await prisma.mediaAsset.findFirst({
      where: { id: body.imageId, deletedAt: null },
      include: { translations: true },
    });
    if (!asset || asset.status === "ARCHIVED" || !asset.mimeType.startsWith("image/")) {
      throw new Error("Homepage banner image is unavailable");
    }

    if (asset.status !== "PUBLISHED") {
      const fallback = defaultMediaText(asset.filename);
      const translations = asset.translations.map((translation) => ({
        locale: translation.locale === "zh_CN" ? "zh-CN" as const : translation.locale,
        title: translation.title.trim() || fallback,
        body: translation.body,
        alt: translation.alt.trim() || translation.title.trim() || fallback,
      }));
      if (!translations.some((translation) => translation.locale === "en")) {
        translations.push({ locale: "en", title: fallback, body: "", alt: fallback });
      }
      const saved = await editorService().saveMediaMetadata({
        actor,
        id: asset.id,
        version: asset.updatedAt.toISOString(),
        translations,
      });
      await editorService().publishMedia({ actor, mediaAssetId: asset.id, version: saved.version });
    }
    imageId = asset.id;
  }
  const record = await prisma.page.findFirst({
    where: { slug: "home", deletedAt: null },
    include: { sections: { where: { type: "HERO", deletedAt: null }, include: { translations: true }, take: 1 } },
  });
  const section = record?.sections[0];
  if (!record || !section) throw new Error("Homepage hero section not found");
  const config = section.config && typeof section.config === "object" && !Array.isArray(section.config) ? { ...section.config as Record<string, unknown> } : {};
  if (imageId) config.imageId = imageId;
  else delete config.imageId;
  await editorService().savePageSection({
    actor,
    id: section.id,
    pageId: record.id,
    version: section.updatedAt.toISOString(),
    position: section.position,
    type: "hero",
    isEnabled: section.isEnabled,
    config,
    translations: section.translations.map((translation) => ({
      locale: translation.locale === "zh_CN" ? "zh-CN" : translation.locale,
      title: translation.title,
      body: translation.body,
    })),
  });
  invalidatePublishedEntity("page", "home", SUPPORTED_LOCALES);
  revalidatePath("/admin/settings");
}
