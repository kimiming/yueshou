import { Card, Typography } from "antd";

import { SiteSettingsForm } from "@/components/admin/editor-forms";
import { can } from "@/lib/auth/access";
import { requireUser } from "@/lib/auth/permissions";
import { prisma } from "@/lib/db/prisma";

import { saveSiteSettingAction } from "./actions";

export default async function SettingsPage() {
  const user = await requireUser();
  const setting = await prisma.siteSetting.findFirst({ where: { key: "brand", deletedAt: null }, include: { translations: true } });
  const translations = Object.fromEntries((setting?.translations ?? []).map((item) => [item.locale === "zh_CN" ? "zh-CN" : item.locale, { title: item.title, body: item.body }]));
  const editorPayload = { key: "brand", version: setting?.updatedAt.toISOString() ?? null, value: setting?.value && typeof setting.value === "object" && !Array.isArray(setting.value) ? setting.value as Record<string, unknown> : { email: "", phone: "", addressLines: [] }, translations: (setting?.translations ?? []).map((item) => ({ locale: (item.locale === "zh_CN" ? "zh-CN" : item.locale) as "en" | "zh-CN" | "de" | "fr" | "es", title: item.title, body: item.body })), status: setting?.status ?? "DRAFT" };
  return <main><Typography.Title level={1}>Site settings</Typography.Title><Card title="Brand, contact and default SEO"><p>{can(user, "settings:manage") ? "Administrators can change global branding, contact data, social links and publication status." : "You have read-only access to global settings."}</p>{can(user, "settings:manage") ? <SiteSettingsForm initial={editorPayload} save={saveSiteSettingAction} /> : <dl>{Object.entries(translations).map(([locale, translation]) => <div key={locale}><dt>{locale}</dt><dd>{translation.title}</dd></div>)}</dl>}</Card></main>;
}
