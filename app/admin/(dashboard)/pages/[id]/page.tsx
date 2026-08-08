import { Card, Typography } from "antd";
import { notFound } from "next/navigation";

import { PageEditorForm, PageSectionForm } from "@/components/admin/editor-forms";
import { SortableSections } from "@/components/admin/sortable-sections";
import { requireUser } from "@/lib/auth/permissions";
import { prisma } from "@/lib/db/prisma";

import { savePageAction, savePageSectionAction, setPageStatusAction } from "./actions";

export default async function PageEditorPage({ params }: { params: Promise<{ id: string }> }) {
  await requireUser();
  const { id } = await params;
  const page = await prisma.page.findFirst({ where: { id, deletedAt: null }, include: { translations: true, sections: { where: { deletedAt: null }, orderBy: { position: "asc" }, include: { translations: true } } } });
  if (!page) notFound();
  const savePayload = { id: page.id, slug: page.slug, version: page.updatedAt.toISOString(), translations: page.translations.map((item) => ({ locale: (item.locale === "zh_CN" ? "zh-CN" : item.locale) as "en" | "zh-CN" | "de" | "fr" | "es", title: item.title, body: item.body })) };
  const sectionPayload = { pageId: page.id, type: "about", config: {}, position: page.sections.length, isEnabled: true, version: null, translations: [{ locale: "en" as const, title: "New section", body: "New section content" }] };
  return <main><Typography.Title level={1}>Page editor: {page.slug}</Typography.Title><Card title="Translations"><PageEditorForm initial={savePayload} save={savePageAction} publish={setPageStatusAction} archive={setPageStatusAction} /></Card><Card title="Sections" style={{ marginTop: 16 }}><SortableSections sections={page.sections.map((section) => ({ id: section.id, type: section.type, title: section.translations.find((translation) => translation.locale === "en")?.title ?? section.type, enabled: section.isEnabled }))} /><PageSectionForm initial={sectionPayload} save={savePageSectionAction} /></Card></main>;
}
