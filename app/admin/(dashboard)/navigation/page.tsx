import { Card, List, Typography } from "antd";

import { NavigationEditorForm } from "@/components/admin/editor-forms";
import { NavigationOrdering } from "@/components/admin/content-ordering";
import { requireUser } from "@/lib/auth/permissions";
import { prisma } from "@/lib/db/prisma";

import { saveNavigationItemAction } from "./actions";

export default async function NavigationPage() {
  await requireUser();
  const items = await prisma.navigationItem.findMany({ where: { deletedAt: null }, orderBy: [{ position: "asc" }, { id: "asc" }], include: { translations: true } });
  const initial = { slug: "new-menu-item", href: "/en/about", parentId: null, position: items.length, isVisible: true, version: null, translations: [{ locale: "en" as const, title: "New menu item" }], status: "DRAFT" };
  return <main><Typography.Title level={1}>Navigation</Typography.Title><Card title="Menu structure"><NavigationOrdering items={items.map((item) => ({ id: item.id, title: item.translations.find((translation) => translation.locale === "en")?.title ?? item.slug, type: "menu", enabled: item.isVisible }))} /><List dataSource={items} renderItem={(item) => <List.Item><Card title={item.translations.find((translation) => translation.locale === "en")?.title ?? item.slug} style={{ width: "100%" }}><NavigationEditorForm initial={{ id: item.id, slug: item.slug, href: item.href, parentId: item.parentId, position: item.position, isVisible: item.isVisible, version: item.updatedAt.toISOString(), translations: item.translations.map((translation) => ({ locale: (translation.locale === "zh_CN" ? "zh-CN" : translation.locale) as "en" | "zh-CN" | "de" | "fr" | "es", title: translation.title })), status: item.status }} save={saveNavigationItemAction} /></Card></List.Item>} /><Card title="Add menu item"><NavigationEditorForm initial={initial} save={saveNavigationItemAction} /></Card></Card></main>;
}
