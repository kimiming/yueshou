import { AdminPageTitle, Button, Card, Input, Space } from "@/components/admin/antd-server-bridge";
import Link from "next/link";

import { CreatePageForm } from "@/components/admin/content-management-forms";
import { adminValueLabel } from "@/components/admin/admin-labels";
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
    <AdminPageTitle level={1}>内容管理</AdminPageTitle>
    <Space wrap style={{ marginBottom: 16 }}><Button><Link href="/admin/services">管理服务</Link></Button></Space>
    <CreatePageForm create={createPageAction} />
    <Card title="页面列表" style={{ marginTop: 16 }}>
      <form><Space wrap>
        <Input name="q" defaultValue={q} aria-label="搜索页面" placeholder="搜索页面" />
        <select name="status" defaultValue={status ?? ""} aria-label="页面状态"><option value="">全部状态</option>{["DRAFT", "PUBLISHED", "ARCHIVED"].map((value) => <option key={value}>{adminValueLabel(value)}</option>)}</select>
        <Button htmlType="submit">筛选</Button>
      </Space></form>
      <div className="admin-record-list">{pages.map((item) => <div key={item.id} className="admin-record-list__item">
        <Link href={`/admin/pages/${item.id}`}>{item.translations[0]?.title ?? item.slug}</Link>
        <p>{item.slug} · {adminValueLabel(item.status)} · 修订版 {item.contentRevision}</p>
      </div>)}</div>
      <AdminPagination pathname="/admin/content" currentPage={page} totalItems={total} pageSize={PAGE_SIZE} query={{ q, status }} />
    </Card>
  </main>;
}
