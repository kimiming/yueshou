"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { createAdminEditorService } from "@/features/admin/editors";
import { prismaAdminEditorRepository } from "@/features/admin/repository";
import { invalidatePublishedEntity } from "@/features/publishing/cache";
import { requireUser } from "@/lib/auth/permissions";
import { prisma } from "@/lib/db/prisma";
import { SUPPORTED_LOCALES } from "@/lib/i18n/config";

const gallerySchema = z.object({
  imageIds: z.array(z.string().cuid()).max(12).refine((ids) => new Set(ids).size === ids.length, "画廊中不能包含重复图片"),
  version: z.string().datetime(),
});

function editorService() {
  return createAdminEditorService({
    repository: prismaAdminEditorRepository,
    invalidate: (type, slug) => invalidatePublishedEntity(type, slug, SUPPORTED_LOCALES),
  });
}

function defaultMediaText(filename: string) {
  return filename.replace(/\.[^.]+$/, "").replace(/[-_]+/g, " ").trim() || "Factory workshop";
}

export async function publishFactoryGalleryAction(input: unknown) {
  const actor = await requireUser();
  const payload = gallerySchema.parse(input);
  const section = await prisma.pageSection.findFirst({
    where: { type: "FACTORY", deletedAt: null, page: { slug: "home", deletedAt: null } },
    include: { page: { select: { id: true } }, translations: true },
  });
  if (!section) throw new Error("未找到首页 Our Factory 模块");
  if (section.updatedAt.toISOString() !== payload.version) throw new Error("画廊已被其他管理员修改，请刷新后重试");

  const assets = await prisma.mediaAsset.findMany({
    where: { id: { in: payload.imageIds }, deletedAt: null, mimeType: { startsWith: "image/" }, status: { not: "ARCHIVED" } },
    include: { translations: true },
  });
  if (assets.length !== payload.imageIds.length) throw new Error("部分图片不存在或已归档，请重新选择");

  const service = editorService();
  for (const asset of assets) {
    if (asset.status === "PUBLISHED") continue;
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
    const saved = await service.saveMediaMetadata({ actor, id: asset.id, version: asset.updatedAt.toISOString(), translations });
    await service.publishMedia({ actor, mediaAssetId: asset.id, version: saved.version });
  }

  const config = section.config && typeof section.config === "object" && !Array.isArray(section.config)
    ? { ...section.config as Record<string, unknown>, imageIds: payload.imageIds }
    : { imageIds: payload.imageIds };
  const saved = await service.savePageSection({
    actor,
    id: section.id,
    pageId: section.page.id,
    version: section.updatedAt.toISOString(),
    position: section.position,
    type: "factory",
    isEnabled: section.isEnabled,
    config,
    translations: section.translations.map((translation) => ({
      locale: translation.locale === "zh_CN" ? "zh-CN" : translation.locale,
      title: translation.title,
      body: translation.body,
    })),
  });

  invalidatePublishedEntity("page", "home", SUPPORTED_LOCALES);
  revalidatePath("/admin/factory");
  revalidatePath("/", "layout");
  return { version: saved.version, count: payload.imageIds.length };
}
