import { Card, List, Typography } from "antd";

import { NavigationEditorForm } from "@/components/admin/editor-forms";
import { requireUser } from "@/lib/auth/permissions";
import { prisma } from "@/lib/db/prisma";

import { saveNavigationItemAction } from "./actions";

export default async function NavigationPage() {
  await requireUser();
  const items = await prisma.navigationItem.findMany({ where: { deletedAt: null }, orderBy: [{ position: "asc" }, { id: "asc" }], include: { translations: true } });
  const initial = { slug: "new-menu-item", href: "/en/about", parentId: null, position: items.length, isVisible: true, version: null, translations: [{ locale: "en" as const, title: "New menu item" }], status: "DRAFT" };
  return <main><Typography.Title level={1}>Navigation</Typography.Title><Card title="Menu structure"><List dataSource={items} renderItem={(item) => <List.Item>{item.position} · {item.translations.find((translation) => translation.locale === "en")?.title ?? item.slug} · {item.href}</List.Item>} /><NavigationEditorForm initial={initial} save={saveNavigationItemAction} /></Card></main>;
}
