import { Card, Typography } from "antd";
import { notFound } from "next/navigation";

import { PageEditorForm, PageSectionForm } from "@/components/admin/editor-forms";
import { PageSectionOrdering } from "@/components/admin/content-ordering";
import { requireUser } from "@/lib/auth/permissions";
import { prisma } from "@/lib/db/prisma";

import { approveLegalPageAction, savePageAction, savePageAndSetStatusAction, savePageSectionAction, setPageStatusAction } from "./actions";

export default async function PageEditorPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  const { id } = await params;
  const [page, services, categories, homepageItems, media] = await Promise.all([
    prisma.page.findFirst({ where: { id, deletedAt: null }, include: { translations: true, sections: { where: { deletedAt: null }, orderBy: { position: "asc" }, include: { translations: true } } } }),
    prisma.service.findMany({ where: { deletedAt: null, status: { not: "ARCHIVED" } }, include: { translations: { where: { locale: "en" }, take: 1 } }, orderBy: [{ position: "asc" }, { id: "asc" }] }),
    prisma.productCategory.findMany({ where: { deletedAt: null, status: { not: "ARCHIVED" } }, include: { translations: { where: { locale: "en" }, take: 1 } }, orderBy: [{ position: "asc" }, { id: "asc" }] }),
    prisma.siteSetting.findMany({ where: { key: { not: "brand" }, deletedAt: null, status: { not: "ARCHIVED" } }, include: { translations: { where: { locale: "en" }, take: 1 } }, orderBy: [{ key: "asc" }, { id: "asc" }] }),
    prisma.mediaAsset.findMany({ where: { status: "PUBLISHED", visibility: "PUBLIC", deletedAt: null }, include: { translations: { where: { locale: "en" }, take: 1 } }, orderBy: [{ updatedAt: "desc" }, { id: "asc" }], take: 100 }),
  ]);
  if (!page) notFound();
  const savePayload = { id: page.id, slug: page.slug, version: page.updatedAt.toISOString(), status: page.status, contentRevision: page.contentRevision, legalReviewStatus: page.legalReviewStatus, translations: page.translations.map((item) => ({ locale: (item.locale === "zh_CN" ? "zh-CN" : item.locale) as "en" | "zh-CN" | "de" | "fr" | "es", title: item.title, body: item.body, seoTitle: item.seoTitle ?? undefined, seoDescription: item.seoDescription ?? undefined })) };
  const sectionPayload = { pageId: page.id, type: "about", config: {}, position: page.sections.length, isEnabled: true, version: null, translations: [{ locale: "en" as const, title: "New section", body: "New section content" }] };
  const orderingPayloads = Object.fromEntries(page.sections.map((section) => [section.id, { id: section.id, pageId: page.id, version: section.updatedAt.toISOString(), position: section.position, type: section.type.toLowerCase().replaceAll("_", "-"), config: section.config, translations: section.translations.map((translation) => ({ locale: translation.locale === "zh_CN" ? "zh-CN" : translation.locale, title: translation.title, body: translation.body })) }]));
  const referenceOptions = [
    ...services.map((item) => ({ id: item.id, kind: "service" as const, label: item.translations[0]?.title ?? item.slug, status: item.status })),
    ...categories.map((item) => ({ id: item.id, kind: "category" as const, label: item.translations[0]?.title ?? item.slug, status: item.status })),
    ...homepageItems.map((item) => ({ id: item.id, kind: "homepage-item" as const, label: item.translations[0]?.title ?? item.key, status: item.status })),
  ];
  const mediaOptions = media.map((item) => ({ id: item.id, filename: item.filename, alt: item.translations[0]?.alt ?? item.filename }));
  return <main><Typography.Title level={1}>Page editor: {page.slug}</Typography.Title><Card title="Translations"><PageEditorForm initial={savePayload} save={savePageAction} publish={setPageStatusAction} archive={setPageStatusAction} approve={user.role === "ADMIN" ? approveLegalPageAction : undefined} transition={savePageAndSetStatusAction} allowArchive={user.role === "ADMIN"} /></Card><Card title="Sections" style={{ marginTop: 16 }}><PageSectionOrdering pageId={page.id} sections={page.sections.map((section) => ({ id: section.id, type: section.type, title: section.translations.find((translation) => translation.locale === "en")?.title ?? section.type, enabled: section.isEnabled }))} payloads={orderingPayloads} />{page.sections.map((section) => <Card key={section.id} size="small" title={`Edit ${section.type}`} style={{ marginTop: 12 }}><PageSectionForm referenceOptions={referenceOptions} mediaOptions={mediaOptions} initial={{ id: section.id, pageId: page.id, version: section.updatedAt.toISOString(), position: section.position, type: section.type.toLowerCase().replaceAll("_", "-"), config: section.config && typeof section.config === "object" && !Array.isArray(section.config) ? section.config as Record<string, unknown> : {}, isEnabled: section.isEnabled, translations: section.translations.map((translation) => ({ locale: (translation.locale === "zh_CN" ? "zh-CN" : translation.locale) as "en" | "zh-CN" | "de" | "fr" | "es", title: translation.title, body: translation.body })) }} save={savePageSectionAction} /></Card>)}<Card size="small" title="Add section" style={{ marginTop: 12 }}><PageSectionForm referenceOptions={referenceOptions} mediaOptions={mediaOptions} initial={sectionPayload} save={savePageSectionAction} /></Card></Card></main>;
}
