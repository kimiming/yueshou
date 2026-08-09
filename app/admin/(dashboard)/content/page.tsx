import { Button, Card, Input, List, Space, Typography } from "antd";
import Link from "next/link";

import { CreatePageForm } from "@/components/admin/content-management-forms";
import { AdminPagination } from "@/components/admin/server-pagination";
import { requireUser } from "@/lib/auth/permissions";
import { prisma } from "@/lib/db/prisma";
import { createPageAction } from "./actions";

const PAGE_SIZE = 25;

export default async function ContentPage({ searchParams }: {
  searchParams: Promise<{ q?: string; status?: "DRAFT" | "PUBLISHED" | "ARCHIVED"; page?: string }>;
}) {
  await requireUser();
  const filters = await searchParams;
  const q = filters.q?.trim().slice(0, 100);
  const status = ["DRAFT", "PUBLISHED", "ARCHIVED"].includes(filters.status ?? "") ? filters.status : undefined;
  const page = Math.max(1, Number.parseInt(filters.page ?? "1", 10) || 1);
  const where = {
    deletedAt: null,
    ...(status ? { status } : {}),
    ...(q ? { OR: [{ slug: { contains: q, mode: "insensitive" as const } }, { translations: { some: { title: { contains: q, mode: "insensitive" as const } } } }] } : {}),
  };
  const [total, pages] = await Promise.all([
    prisma.page.count({ where }),
    prisma.page.findMany({
      where,
      include: { translations: { where: { locale: "en" }, take: 1 } },
      orderBy: [{ updatedAt: "desc" }, { id: "asc" }],
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
    }),
  ]);
  return <main>
    <Typography.Title level={1}>Content</Typography.Title>
    <Space wrap style={{ marginBottom: 16 }}><Button><Link href="/admin/services">Manage services</Link></Button></Space>
    <CreatePageForm create={createPageAction} />
    <Card title="Pages" style={{ marginTop: 16 }}>
      <form><Space wrap>
        <Input name="q" defaultValue={q} aria-label="Search pages" placeholder="Search pages" />
        <select name="status" defaultValue={status ?? ""} aria-label="Page status"><option value="">All statuses</option>{["DRAFT", "PUBLISHED", "ARCHIVED"].map((value) => <option key={value}>{value}</option>)}</select>
        <Button htmlType="submit">Filter</Button>
      </Space></form>
      <List dataSource={pages} renderItem={(item) => <List.Item><List.Item.Meta
        title={<Link href={`/admin/pages/${item.id}`}>{item.translations[0]?.title ?? item.slug}</Link>}
        description={`${item.slug} · ${item.status} · revision ${item.contentRevision}`}
      /></List.Item>} />
      <AdminPagination pathname="/admin/content" currentPage={page} totalItems={total} pageSize={PAGE_SIZE} query={{ q, status }} />
    </Card>
  </main>;
}
