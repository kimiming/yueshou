import type { Prisma } from "@prisma/client";
import { Button, Card, Input, List, Space, Typography } from "antd";
import Link from "next/link";

import { ArticleForm } from "@/components/admin/domain-forms";
import { AdminPagination } from "@/components/admin/server-pagination";
import { TaxonomyManager } from "@/components/admin/taxonomy-manager";
import { requireUser } from "@/lib/auth/permissions";
import { prisma } from "@/lib/db/prisma";
import { archiveArticleCategoryAction, archiveTagAction, saveArticleAction, saveArticleCategoryAction, saveTagAction } from "./actions";

const PAGE_SIZE = 25;

export default async function NewsPage({ searchParams }: {
  searchParams: Promise<{ q?: string; status?: "DRAFT" | "PUBLISHED" | "ARCHIVED"; page?: string }>;
}) {
  await requireUser();
  const filters = await searchParams;
  const q = filters.q?.trim().slice(0, 100);
  const status = ["DRAFT", "PUBLISHED", "ARCHIVED"].includes(filters.status ?? "") ? filters.status : undefined;
  const page = Math.min(1_000, Math.max(1, Number.parseInt(filters.page ?? "1", 10) || 1));
  const where: Prisma.ArticleWhereInput = {
    deletedAt: null,
    ...(status ? { status } : {}),
    ...(q ? {
      OR: [
        { slug: { contains: q, mode: "insensitive" } },
        { translations: { some: { title: { contains: q, mode: "insensitive" } } } },
      ],
    } : {}),
  };
  const [categories, tags, total, articles] = await Promise.all([
    prisma.articleCategory.findMany({
      where: { deletedAt: null },
      include: { translations: { where: { locale: "en" }, take: 1 } },
      orderBy: { position: "asc" },
    }),
    prisma.tag.findMany({ where: { deletedAt: null }, orderBy: { name: "asc" } }),
    prisma.article.count({ where }),
    prisma.article.findMany({
      where,
      include: {
        translations: { where: { locale: "en" }, take: 1 },
        category: { include: { translations: { where: { locale: "en" }, take: 1 } } },
        tags: true,
      },
      orderBy: [{ updatedAt: "desc" }, { id: "asc" }],
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
    }),
  ]);
  const categoryItems = categories.map((item) => ({
    id: item.id,
    slug: item.slug,
    label: item.translations[0]?.title ?? item.slug,
    body: item.translations[0]?.body ?? "",
    status: item.status,
    version: item.updatedAt.toISOString(),
  }));
  const tagItems = tags.map((item) => ({ id: item.id, slug: item.slug, label: item.name, version: item.updatedAt.toISOString() }));

  return <main>
    <Typography.Title level={1}>News</Typography.Title>
    <ArticleForm categories={categoryItems} tags={tags} save={saveArticleAction} />
    <TaxonomyManager kind="category" title="Article categories" items={categoryItems} save={saveArticleCategoryAction} archive={archiveArticleCategoryAction} />
    <TaxonomyManager kind="tag" title="Tags" items={tagItems} save={saveTagAction} archive={archiveTagAction} />
    <Card title="Articles">
      <form><Space wrap>
        <Input name="q" defaultValue={q} placeholder="Search articles" aria-label="Search articles" />
        <select name="status" defaultValue={status ?? ""} aria-label="Article status"><option value="">All statuses</option>{["DRAFT", "PUBLISHED", "ARCHIVED"].map((value) => <option key={value} value={value}>{value}</option>)}</select>
        <Button htmlType="submit">Filter</Button>
      </Space></form>
      <List dataSource={articles} renderItem={(item) => <List.Item><List.Item.Meta
        title={<Link href={`/admin/news/${item.id}`}>{item.translations[0]?.title ?? item.slug}</Link>}
        description={`${item.category.translations[0]?.title ?? item.category.slug} · ${item.status}${item.scheduledAt ? ` · scheduled ${item.scheduledAt.toISOString()}` : ""}`}
      /></List.Item>} />
      <AdminPagination pathname="/admin/news" currentPage={page} totalItems={total} pageSize={PAGE_SIZE} query={{ q, status }} />
    </Card>
  </main>;
}
