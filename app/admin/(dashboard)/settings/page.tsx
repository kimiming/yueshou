import { AdminPageTitle, Card } from "@/components/admin/antd-server-bridge";

import { SiteSettingsForm } from "@/components/admin/editor-forms";
import { HomepageBannerForm } from "@/components/admin/homepage-banner-form";
import { can } from "@/lib/auth/access";
import { requireUser } from "@/lib/auth/permissions";
import { prisma } from "@/lib/db/prisma";

import { saveHomepageBannerAction, saveSiteSettingAction } from "./actions";

export default async function SettingsPage() {
  const user = await requireUser();
  const [setting, media, home] = await Promise.all([
    prisma.siteSetting.findFirst({ where: { key: "brand", deletedAt: null }, include: { translations: true } }),
    prisma.mediaAsset.findMany({ where: { status: "PUBLISHED", deletedAt: null }, include: { translations: { where: { locale: "en" }, take: 1 } }, orderBy: [{ createdAt: "desc" }, { id: "asc" }], take: 100 }),
    prisma.page.findFirst({ where: { slug: "home", deletedAt: null }, include: { sections: { where: { type: "HERO", deletedAt: null }, take: 1 } } }),
  ]);
  const translations = Object.fromEntries((setting?.translations ?? []).map((item) => [item.locale === "zh_CN" ? "zh-CN" : item.locale, { title: item.title, body: item.body }]));
  const editorPayload = { key: "brand", version: setting?.updatedAt.toISOString() ?? null, value: setting?.value && typeof setting.value === "object" && !Array.isArray(setting.value) ? setting.value as Record<string, unknown> : { email: "", phone: "", addressLines: [] }, translations: (setting?.translations ?? []).map((item) => ({ locale: (item.locale === "zh_CN" ? "zh-CN" : item.locale) as "en" | "zh-CN" | "de" | "fr" | "es", title: item.title, body: item.body })), status: setting?.status ?? "DRAFT" };
  const mediaOptions = media.map((asset) => ({ id: asset.id, filename: asset.filename, alt: asset.translations[0]?.alt ?? asset.filename }));
  const heroConfig = home?.sections[0]?.config && typeof home.sections[0].config === "object" && !Array.isArray(home.sections[0].config) ? home.sections[0].config as Record<string, unknown> : {};
  return <main><AdminPageTitle level={1}>网站设置</AdminPageTitle><Card title="品牌、联系方式与默认 SEO"><p>{can(user, "settings:manage") ? "管理员可以修改全局品牌信息、联系方式、社交链接和发布状态。" : "您只有全局设置的只读权限。"}</p>{can(user, "settings:manage") ? <SiteSettingsForm initial={editorPayload} mediaOptions={mediaOptions} save={saveSiteSettingAction} /> : <dl>{Object.entries(translations).map(([locale, translation]) => <div key={locale}><dt>{locale}</dt><dd>{translation.title}</dd></div>)}</dl>}</Card>{can(user, "settings:manage") ? <HomepageBannerForm initialImageId={typeof heroConfig.imageId === "string" ? heroConfig.imageId : undefined} mediaOptions={mediaOptions} save={saveHomepageBannerAction} /> : null}</main>;
}
