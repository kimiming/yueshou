import type { Prisma } from "@prisma/client";
import { AdminPageTitle, Button, Card, Input, Space } from "@/components/admin/antd-server-bridge";
import { ManagementTable } from "@/components/admin/management-table";
import { requireUser } from "@/lib/auth/permissions";
import { prisma } from "@/lib/db/prisma";

export default async function MediaPage({ searchParams }: { searchParams: Promise<{ q?: string; status?: "DRAFT" | "PUBLISHED" | "ARCHIVED" }> }) {
  await requireUser();
  const filters = await searchParams;
  const q = filters.q?.trim().slice(0, 100);
  const status = ["DRAFT", "PUBLISHED", "ARCHIVED"].includes(filters.status ?? "") ? filters.status : undefined;
  const where: Prisma.MediaAssetWhereInput = { deletedAt: null, ...(status ? { status } : {}), ...(q ? { OR: [{ filename: { contains: q, mode: "insensitive" } }, { translations: { some: { OR: [{ title: { contains: q, mode: "insensitive" } }, { alt: { contains: q, mode: "insensitive" } }] } } }] } : {}) };
  const assets = await prisma.mediaAsset.findMany({ where, include: { translations: { where: { locale: "en" }, take: 1 } }, orderBy: [{ updatedAt: "desc" }, { id: "asc" }] });
  const rows = assets.map((asset) => ({ id: asset.id, title: asset.translations[0]?.title || asset.filename, detail: asset.filename, imageUrl: `/api/admin/media/${encodeURIComponent(asset.id)}`, status: asset.status, updatedAt: asset.updatedAt.toLocaleString("zh-CN"), version: asset.updatedAt.toISOString(), editHref: `/admin/media/${asset.id}` }));
  return <main><Space style={{ width: "100%", justifyContent: "space-between" }}><AdminPageTitle level={1}>媒体库</AdminPageTitle><Button type="primary" href="/admin/media/new">上传图片</Button></Space><Card><form><Space wrap><Input name="q" defaultValue={q} placeholder="搜索图片" aria-label="搜索图片" /><select name="status" defaultValue={status ?? ""} aria-label="媒体状态"><option value="">全部状态</option><option value="PUBLISHED">已发布</option><option value="DRAFT">草稿</option></select><Button htmlType="submit">筛选</Button></Space></form><ManagementTable rows={rows} /></Card></main>;
}
