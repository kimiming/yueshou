import { Button, Card, Input, List, Space, Typography } from "antd";
import Link from "next/link";
import { ProductForm } from "@/components/admin/domain-forms";
import { TaxonomyManager } from "@/components/admin/taxonomy-manager";
import { requireUser } from "@/lib/auth/permissions";
import { prisma } from "@/lib/db/prisma";
import { archiveProductCategoryAction, saveProductAction, saveProductCategoryAction } from "./actions";

export default async function ProductsPage({ searchParams }: { searchParams: Promise<{ q?: string; status?: "DRAFT" | "PUBLISHED" | "ARCHIVED" }> }) {
  await requireUser(); const filters = await searchParams; const q = filters.q?.trim().slice(0, 100); const status = ["DRAFT", "PUBLISHED", "ARCHIVED"].includes(filters.status ?? "") ? filters.status : undefined;
  const [categories, products] = await Promise.all([prisma.productCategory.findMany({ where: { deletedAt: null }, include: { translations: { where: { locale: "en" }, take: 1 } }, orderBy: { position: "asc" } }), prisma.product.findMany({ where: { deletedAt: null, ...(status ? { status } : {}), ...(q ? { OR: [{ slug: { contains: q, mode: "insensitive" } }, { translations: { some: { title: { contains: q, mode: "insensitive" } } } }] } : {}) }, include: { category: { include: { translations: { where: { locale: "en" }, take: 1 } } }, translations: { where: { locale: "en" }, take: 1 } }, orderBy: { updatedAt: "desc" }, take: 100 })]);
  const categoryItems = categories.map((item) => ({ id: item.id, slug: item.slug, label: item.translations[0]?.title ?? item.slug, body: item.translations[0]?.body ?? "", status: item.status, version: item.updatedAt.toISOString() }));
  return <main><Typography.Title level={1}>Products</Typography.Title><ProductForm categories={categoryItems} save={saveProductAction} /><TaxonomyManager title="Product categories" items={categoryItems} save={saveProductCategoryAction} archive={archiveProductCategoryAction} /><Card title="Product catalogue"><form><Space><Input name="q" defaultValue={q} placeholder="Search products" aria-label="Search products" /><select name="status" defaultValue={status ?? ""} aria-label="Product status"><option value="">All statuses</option>{["DRAFT", "PUBLISHED", "ARCHIVED"].map((value) => <option key={value} value={value}>{value}</option>)}</select><Button htmlType="submit">Filter</Button></Space></form><List dataSource={products} renderItem={(item) => <List.Item><List.Item.Meta title={<Link href={`/admin/products/${item.id}`}>{item.translations[0]?.title ?? item.slug}</Link>} description={`${item.category.translations[0]?.title ?? item.category.slug} · ${item.status}${item.scheduledAt ? ` · scheduled ${item.scheduledAt.toISOString()}` : ""}`} /></List.Item>} /></Card></main>;
}
