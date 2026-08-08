import { Button, Card, List, Typography } from "antd";

import { TranslationTabs } from "@/components/admin/translation-tabs";
import { requireUser } from "@/lib/auth/permissions";
import { prisma } from "@/lib/db/prisma";

import { saveNavigationItemAction } from "./actions";

export default async function NavigationPage() {
  await requireUser();
  const items = await prisma.navigationItem.findMany({ where: { deletedAt: null }, orderBy: [{ position: "asc" }, { id: "asc" }], include: { translations: true } });
  const initial = { slug: "new-menu-item", href: "/en/about", parentId: null, position: items.length, isVisible: true, version: null, translations: [{ locale: "en", title: "New menu item" }], status: "DRAFT" };
  return <main><Typography.Title level={1}>Navigation</Typography.Title><Card title="Menu structure"><List dataSource={items} renderItem={(item) => <List.Item>{item.position} · {item.translations.find((translation) => translation.locale === "en")?.title ?? item.slug} · {item.href}</List.Item>} /><form action={saveNavigationItemAction}><label htmlFor="navigation-payload">New navigation item payload</label><textarea id="navigation-payload" name="payload" defaultValue={JSON.stringify(initial, null, 2)} rows={12} style={{ display: "block", width: "100%" }} /><TranslationTabs completeLocales={["en"]} values={{ en: { title: "New menu item" } }} body={false} /><Button htmlType="submit" type="primary">Add menu item</Button></form></Card></main>;
}
