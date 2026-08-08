import { Button, Card, Typography } from "antd";

import { TranslationTabs } from "@/components/admin/translation-tabs";
import { can } from "@/lib/auth/access";
import { requireUser } from "@/lib/auth/permissions";
import { prisma } from "@/lib/db/prisma";

import { saveSiteSettingAction } from "./actions";

export default async function SettingsPage() {
  const user = await requireUser();
  const setting = await prisma.siteSetting.findFirst({ where: { key: "brand", deletedAt: null }, include: { translations: true } });
  const translations = Object.fromEntries((setting?.translations ?? []).map((item) => [item.locale === "zh_CN" ? "zh-CN" : item.locale, { title: item.title, body: item.body }]));
  const editorPayload = { key: "brand", version: setting?.updatedAt.toISOString() ?? null, value: setting?.value ?? { email: "", phone: "", addressLines: [] }, translations: (setting?.translations ?? []).map((item) => ({ locale: item.locale === "zh_CN" ? "zh-CN" : item.locale, title: item.title, body: item.body })), status: setting?.status ?? "DRAFT" };
  return <main><Typography.Title level={1}>Site settings</Typography.Title><Card title="Brand, contact and default SEO"><p>{can(user, "settings:manage") ? "Administrators can change global branding, contact data, social links and publication status." : "You have read-only access to global settings."}</p>{can(user, "settings:manage") ? <form action={saveSiteSettingAction}><label htmlFor="settings-payload">Editor payload</label><textarea id="settings-payload" name="payload" defaultValue={JSON.stringify(editorPayload, null, 2)} rows={16} style={{ display: "block", width: "100%" }} /><TranslationTabs completeLocales={Object.keys(translations) as never} values={translations} /><Button htmlType="submit" type="primary">Save settings</Button></form> : <TranslationTabs completeLocales={Object.keys(translations) as never} values={translations} />}</Card></main>;
}
