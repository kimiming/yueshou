import { Button, Card, Typography } from "antd";
import { notFound } from "next/navigation";

import { PublishControls } from "@/components/admin/publish-controls";
import { SortableSections } from "@/components/admin/sortable-sections";
import { TranslationTabs } from "@/components/admin/translation-tabs";
import { requireUser } from "@/lib/auth/permissions";
import { prisma } from "@/lib/db/prisma";

import { savePageAction, savePageSectionAction, setPageStatusAction } from "./actions";

export default async function PageEditorPage({ params }: { params: Promise<{ id: string }> }) {
  await requireUser();
  const { id } = await params;
  const page = await prisma.page.findFirst({ where: { id, deletedAt: null }, include: { translations: true, sections: { where: { deletedAt: null }, orderBy: { position: "asc" }, include: { translations: true } } } });
  if (!page) notFound();
  const translations = Object.fromEntries(page.translations.map((item) => [item.locale === "zh_CN" ? "zh-CN" : item.locale, { title: item.title, body: item.body }]));
  const savePayload = { id: page.id, slug: page.slug, version: page.updatedAt.toISOString(), translations: page.translations.map((item) => ({ locale: item.locale === "zh_CN" ? "zh-CN" : item.locale, title: item.title, body: item.body })) };
  const sectionPayload = { pageId: page.id, type: "about", config: {}, position: page.sections.length, isEnabled: true, version: null, translations: [{ locale: "en", title: "New section", body: "" }] };
  return <main><Typography.Title level={1}>Page editor: {page.slug}</Typography.Title><Card title="Translations"><form action={savePageAction}><textarea aria-label="Page payload" name="payload" defaultValue={JSON.stringify(savePayload, null, 2)} rows={12} style={{ display: "block", width: "100%" }} /><TranslationTabs completeLocales={Object.keys(translations) as never} values={translations} /><Button htmlType="submit" type="primary">Save page</Button></form></Card><Card title="Sections" style={{ marginTop: 16 }}><SortableSections sections={page.sections.map((section) => ({ id: section.id, type: section.type, title: section.translations.find((translation) => translation.locale === "en")?.title ?? section.type, enabled: section.isEnabled }))} /><form action={savePageSectionAction}><textarea aria-label="Section payload" name="payload" defaultValue={JSON.stringify(sectionPayload, null, 2)} rows={10} style={{ display: "block", width: "100%" }} /><Button htmlType="submit">Add section</Button></form></Card><Card title="Publication" style={{ marginTop: 16 }}><PublishControls /><form action={setPageStatusAction}><input type="hidden" name="payload" value={JSON.stringify({ pageId: page.id, version: page.updatedAt.toISOString(), status: "PUBLISHED" })} /><Button htmlType="submit" type="primary">Publish this page</Button></form></Card></main>;
}
