import { Card, Input, List, Space, Button, Typography } from "antd";
import Link from "next/link";

import { ServiceEditorForm } from "@/components/admin/content-management-forms";
import { AdminPagination } from "@/components/admin/server-pagination";
import { requireUser } from "@/lib/auth/permissions";
import { prisma } from "@/lib/db/prisma";
import { saveServiceAction } from "./actions";

const PAGE_SIZE = 25;

export default async function ServicesAdminPage({ searchParams }: {
  searchParams: Promise<{ q?: string; status?: "DRAFT" | "PUBLISHED" | "ARCHIVED"; page?: string }>;
}) {
  const user = await requireUser();
  const filters = await searchParams;
  const q = filters.q?.trim().slice(0, 100);
  const status = ["DRAFT", "PUBLISHED", "ARCHIVED"].includes(filters.status ?? "") ? filters.status : undefined;
  const page = Math.max(1, Number.parseInt(filters.page ?? "1", 10) || 1);
  const where = {
    deletedAt: null,
    ...(status ? { status } : {}),
    ...(q ? { OR: [{ slug: { contains: q, mode: "insensitive" as const } }, { translations: { some: { title: { contains: q, mode: "insensitive" as const } } } }] } : {}),
  };
  const [total, services] = await Promise.all([
    prisma.service.count({ where }),
    prisma.service.findMany({ where, include: { translations: { where: { locale: "en" }, take: 1 } }, orderBy: [{ updatedAt: "desc" }, { id: "asc" }], skip: (page - 1) * PAGE_SIZE, take: PAGE_SIZE }),
  ]);
  return <main>
    <Typography.Title level={1}>Services</Typography.Title>
    <ServiceEditorForm save={saveServiceAction} allowArchive={user.role === "ADMIN"} initial={{ slug: "", position: 0, status: "DRAFT", translations: [] }} />
    <Card title="Service catalogue" style={{ marginTop: 16 }}>
      <form><Space wrap><Input name="q" defaultValue={q} aria-label="Search services" placeholder="Search services" /><select name="status" defaultValue={status ?? ""} aria-label="Service status"><option value="">All statuses</option>{["DRAFT", "PUBLISHED", "ARCHIVED"].map((value) => <option key={value}>{value}</option>)}</select><Button htmlType="submit">Filter</Button></Space></form>
      <List dataSource={services} renderItem={(item) => <List.Item><List.Item.Meta title={<Link href={`/admin/services/${item.id}`}>{item.translations[0]?.title ?? item.slug}</Link>} description={`${item.slug} · ${item.status}`} /></List.Item>} />
      <AdminPagination pathname="/admin/services" currentPage={page} totalItems={total} pageSize={PAGE_SIZE} query={{ q, status }} />
    </Card>
  </main>;
}
