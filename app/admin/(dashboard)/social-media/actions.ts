"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { createAdminEditorService } from "@/features/admin/editors";
import { prismaAdminEditorRepository } from "@/features/admin/repository";
import { invalidateMarketingShell, invalidatePublishedEntity } from "@/features/publishing/cache";
import { requireRole } from "@/lib/auth/permissions";
import { prisma } from "@/lib/db/prisma";
import { SUPPORTED_LOCALES } from "@/lib/i18n/config";

const linkSchema = z.object({
  label: z.string().trim().min(1, "请输入平台名称").max(80),
  href: z.string().trim().url("请输入完整链接").refine((href) => new URL(href).protocol === "https:", "链接必须使用 HTTPS"),
});
const mutationSchema = z.discriminatedUnion("operation", [
  z.object({ operation: z.literal("create"), version: z.string().datetime(), item: linkSchema }),
  z.object({ operation: z.literal("update"), version: z.string().datetime(), index: z.number().int().nonnegative(), item: linkSchema }),
  z.object({ operation: z.literal("delete"), version: z.string().datetime(), index: z.number().int().nonnegative() }),
]);

function service() {
  return createAdminEditorService({
    repository: prismaAdminEditorRepository,
    invalidate: (type, slug) => invalidatePublishedEntity(type, slug, SUPPORTED_LOCALES),
  });
}

function links(value: unknown): Array<{ label: string; href: string }> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return [];
  const entries = (value as Record<string, unknown>).socialLinks;
  if (!Array.isArray(entries)) return [];
  return entries.filter((item): item is { label: string; href: string } => Boolean(item) && typeof item === "object" && typeof (item as { label?: unknown }).label === "string" && typeof (item as { href?: unknown }).href === "string");
}

export async function mutateSocialMediaAction(input: unknown) {
  const actor = await requireRole("ADMIN");
  const payload = mutationSchema.parse(input);
  const setting = await prisma.siteSetting.findFirst({ where: { key: "brand", deletedAt: null }, include: { translations: true } });
  if (!setting) throw new Error("未找到品牌设置");
  if (setting.updatedAt.toISOString() !== payload.version) throw new Error("社交媒体设置已被其他管理员修改，请刷新后重试");

  const value = setting.value && typeof setting.value === "object" && !Array.isArray(setting.value)
    ? { ...setting.value as Record<string, unknown> }
    : {};
  const socialLinks = links(value);
  if (payload.operation === "create") {
    if (socialLinks.length >= 12) throw new Error("最多可添加 12 个社交媒体账号");
    socialLinks.push(payload.item);
  } else {
    if (!socialLinks[payload.index]) throw new Error("该社交媒体记录已不存在，请刷新后重试");
    if (payload.operation === "update") socialLinks[payload.index] = payload.item;
    else socialLinks.splice(payload.index, 1);
  }
  value.socialLinks = socialLinks;

  const saved = await service().saveSiteSetting({
    actor,
    key: "brand",
    version: setting.updatedAt.toISOString(),
    value,
    status: "PUBLISHED",
    translations: setting.translations.map((translation) => ({
      locale: translation.locale === "zh_CN" ? "zh-CN" : translation.locale,
      title: translation.title,
      body: translation.body,
    })),
  });
  invalidateMarketingShell(SUPPORTED_LOCALES);
  revalidatePath("/admin/social-media");
  return { version: saved.version, items: socialLinks };
}
