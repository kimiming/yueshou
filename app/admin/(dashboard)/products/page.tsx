import type { Prisma } from "@prisma/client";
import { Button, Card, Input, List, Space, Typography } from "antd";
import Link from "next/link";

import { ProductForm } from "@/components/admin/domain-forms";
import { AdminPagination } from "@/components/admin/server-pagination";
import { TaxonomyManager } from "@/components/admin/taxonomy-manager";
import { requireUser } from "@/lib/auth/permissions";
import { prisma } from "@/lib/db/prisma";
import { archiveProductCategoryAction, saveProductAction, saveProductCategoryAction } from "./actions";

const PAGE_SIZE = 25;

export default async function ProductsPage({ searchParams }: {
  searchParams: Promise<{ q?: string; status?: "DRAFT" | "PUBLISHED" | "ARCHIVED"; page?: string }>;
}) {
  await requireUser();
  const filters = await searchParams;
  const q = filters.q?.trim().slice(0, 100);
  const status = ["DRAFT", "PUBLISHED", "ARCHIVED"].includes(filters.status ?? "") ? filters.status : undefined;
  const page = Math.min(1_000, Math.max(1, Number.parseInt(filters.page ?? "1", 10) || 1));
  const where: Prisma.ProductWhereInput = {
    deletedAt: null,
    ...(status ? { status } : {}),
    ...(q ? {
      OR: [
        { slug: { contains: q, mode: "insensitive" } },
        { translations: { some: { title: { contains: q, mode: "insensitive" } } } },
      ],
    } : {}),
  };
  const [categories, total, products] = await Promise.all([
    prisma.productCategory.findMany({
      where: { deletedAt: null },
      include: { translations: { where: { locale: "en" }, take: 1 } },
      orderBy: { position: "asc" },
    }),
    prisma.product.count({ where }),
    prisma.product.findMany({
      where,
      include: {
        category: { include: { translations: { where: { locale: "en" }, take: 1 } } },
        translations: { where: { locale: "en" }, take: 1 },
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

  return <main>
    <Typography.Title level={1}>Products</Typography.Title>
    <ProductForm categories={categoryItems} save={saveProductAction} />
    <TaxonomyManager kind="category" title="Product categories" items={categoryItems} save={saveProductCategoryAction} archive={archiveProductCategoryAction} />
    <Card title="Product catalogue">
      <form><Space wrap>
        <Input name="q" defaultValue={q} placeholder="Search products" aria-label="Search products" />
        <select name="status" defaultValue={status ?? ""} aria-label="Product status"><option value="">All statuses</option>{["DRAFT", "PUBLISHED", "ARCHIVED"].map((value) => <option key={value} value={value}>{value}</option>)}</select>
        <Button htmlType="submit">Filter</Button>
      </Space></form>
      <List dataSource={products} renderItem={(item) => <List.Item><List.Item.Meta
        title={<Link href={`/admin/products/${item.id}`}>{item.translations[0]?.title ?? item.slug}</Link>}
        description={`${item.category.translations[0]?.title ?? item.category.slug} · ${item.status}${item.scheduledAt ? ` · scheduled ${item.scheduledAt.toISOString()}` : ""}`}
      /></List.Item>} />
      <AdminPagination pathname="/admin/products" currentPage={page} totalItems={total} pageSize={PAGE_SIZE} query={{ q, status }} />
    </Card>
  </main>;
}
