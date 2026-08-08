import { Card, Typography } from "antd";
import { notFound } from "next/navigation";

import { PageEditorForm, PageSectionForm } from "@/components/admin/editor-forms";
import { PageSectionOrdering } from "@/components/admin/content-ordering";
import { requireUser } from "@/lib/auth/permissions";
import { prisma } from "@/lib/db/prisma";

import { savePageAction, savePageAndSetStatusAction, savePageSectionAction, setPageStatusAction } from "./actions";

export default async function PageEditorPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  const { id } = await params;
  const page = await prisma.page.findFirst({ where: { id, deletedAt: null }, include: { translations: true, sections: { where: { deletedAt: null }, orderBy: { position: "asc" }, include: { translations: true } } } });
  if (!page) notFound();
  const savePayload = { id: page.id, slug: page.slug, version: page.updatedAt.toISOString(), translations: page.translations.map((item) => ({ locale: (item.locale === "zh_CN" ? "zh-CN" : item.locale) as "en" | "zh-CN" | "de" | "fr" | "es", title: item.title, body: item.body })) };
  const sectionPayload = { pageId: page.id, type: "about", config: {}, position: page.sections.length, isEnabled: true, version: null, translations: [{ locale: "en" as const, title: "New section", body: "New section content" }] };
  return <main><Typography.Title level={1}>Page editor: {page.slug}</Typography.Title><Card title="Translations"><PageEditorForm initial={savePayload} save={savePageAction} publish={setPageStatusAction} archive={setPageStatusAction} transition={savePageAndSetStatusAction} allowArchive={user.role === "ADMIN"} /></Card><Card title="Sections" style={{ marginTop: 16 }}><PageSectionOrdering pageId={page.id} sections={page.sections.map((section) => ({ id: section.id, type: section.type, title: section.translations.find((translation) => translation.locale === "en")?.title ?? section.type, enabled: section.isEnabled }))} />{page.sections.map((section) => <Card key={section.id} size="small" title={`Edit ${section.type}`} style={{ marginTop: 12 }}><PageSectionForm initial={{ id: section.id, pageId: page.id, version: section.updatedAt.toISOString(), position: section.position, type: section.type.toLowerCase().replaceAll("_", "-"), config: section.config && typeof section.config === "object" && !Array.isArray(section.config) ? section.config as Record<string, unknown> : {}, isEnabled: section.isEnabled, translations: section.translations.map((translation) => ({ locale: (translation.locale === "zh_CN" ? "zh-CN" : translation.locale) as "en" | "zh-CN" | "de" | "fr" | "es", title: translation.title, body: translation.body })) }} save={savePageSectionAction} /></Card>)}<Card size="small" title="Add section" style={{ marginTop: 12 }}><PageSectionForm initial={sectionPayload} save={savePageSectionAction} /></Card></Card></main>;
}
