import { AdminPageTitle } from "@/components/admin/antd-server-bridge";
import { ArticleForm } from "@/components/admin/domain-forms";
import { requireUser } from "@/lib/auth/permissions";
import { prisma } from "@/lib/db/prisma";
import { saveArticleAction } from "../actions";

export default async function NewArticlePage() { await requireUser(); const [categories, tags] = await Promise.all([prisma.articleCategory.findMany({ where: { deletedAt: null, status: "PUBLISHED" }, include: { translations: { where: { locale: "en" }, take: 1 } } }), prisma.tag.findMany({ where: { deletedAt: null }, orderBy: { name: "asc" } })]); return <main><AdminPageTitle level={1}>新建文章</AdminPageTitle><ArticleForm categories={categories.map((item) => ({ id: item.id, label: item.translations[0]?.title ?? item.slug }))} tags={tags} save={saveArticleAction} /></main>; }
