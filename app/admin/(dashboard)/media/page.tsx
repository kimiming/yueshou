import type { Prisma } from "@prisma/client";
import { Button, Card, Input, List, Space, Typography } from "antd";

import { MediaMetadataForm } from "@/components/admin/editor-forms";
import { MediaPicker } from "@/components/admin/media-picker";
import { AdminPagination } from "@/components/admin/server-pagination";
import { prismaMediaRepository } from "@/features/media/repository";
import { requireUser } from "@/lib/auth/permissions";
import { prisma } from "@/lib/db/prisma";
import { archiveMediaAction, publishMediaAction, saveMediaMetadataAction } from "./actions";

const PAGE_SIZE = 25;

export default async function MediaPage({ searchParams }: {
  searchParams: Promise<{ q?: string; status?: "DRAFT" | "PUBLISHED" | "ARCHIVED"; page?: string }>;
}) {
  const user = await requireUser();
  const filters = await searchParams;
  const q = filters.q?.trim().slice(0, 100);
  const status = ["DRAFT", "PUBLISHED", "ARCHIVED"].includes(filters.status ?? "") ? filters.status : undefined;
  const page = Math.min(1_000, Math.max(1, Number.parseInt(filters.page ?? "1", 10) || 1));
  const where: Prisma.MediaAssetWhereInput = {
    deletedAt: null,
    ...(status ? { status } : {}),
    ...(q ? {
      OR: [
        { filename: { contains: q, mode: "insensitive" } },
        { translations: { some: { OR: [
          { title: { contains: q, mode: "insensitive" } },
          { alt: { contains: q, mode: "insensitive" } },
        ] } } },
      ],
    } : {}),
  };
  const [total, assets] = await Promise.all([
    prisma.mediaAsset.count({ where }),
    prisma.mediaAsset.findMany({
      where,
      orderBy: [{ createdAt: "desc" }, { id: "asc" }],
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
      include: { translations: true, deletionJob: true },
    }),
  ]);
  const rows = await Promise.all(assets.map(async (asset) => ({ asset, references: await prismaMediaRepository.countReferences(asset.id) })));

  return <main>
    <Typography.Title level={1}>Media library</Typography.Title>
    <Card>
      <MediaPicker />
      <p>Uploads are sent directly to a short-lived storage URL. Browser code never receives storage credentials.</p>
      <form><Space wrap>
        <Input name="q" defaultValue={q} placeholder="Search media" aria-label="Search media" />
        <select name="status" defaultValue={status ?? ""} aria-label="Media status"><option value="">All statuses</option>{["DRAFT", "PUBLISHED", "ARCHIVED"].map((value) => <option key={value} value={value}>{value}</option>)}</select>
        <Button htmlType="submit">Filter</Button>
      </Space></form>
      <List dataSource={rows} locale={{ emptyText: "No media assets yet." }} renderItem={({ asset, references }) => {
        const metadata = {
          id: asset.id,
          version: asset.updatedAt.toISOString(),
          translations: asset.translations.map((item) => ({
            locale: (item.locale === "zh_CN" ? "zh-CN" : item.locale) as "en" | "zh-CN" | "de" | "fr" | "es",
            title: item.title,
            body: item.body,
            alt: item.alt,
          })),
        };
        const referenceCount = Object.values(references).reduce((sum, count) => sum + count, 0);
        const deletion = asset.deletionJob
          ? `Deletion ${asset.deletionJob.status.toLowerCase()} after ${asset.deletionJob.deleteAfter.toISOString()}`
          : asset.status === "ARCHIVED" ? "Retained because it is still referenced." : "Not queued for deletion.";
        return <List.Item><Card title={asset.filename} style={{ width: "100%" }}>
          <p>{asset.mimeType} · {asset.sizeBytes} bytes · {asset.status} · {referenceCount} active references</p>
          <p>{deletion}</p>
          <MediaMetadataForm initial={metadata} save={saveMediaMetadataAction} publish={publishMediaAction} archive={archiveMediaAction} allowArchive={user.role === "ADMIN"} />
        </Card></List.Item>;
      }} />
      <AdminPagination pathname="/admin/media" currentPage={page} totalItems={total} pageSize={PAGE_SIZE} query={{ q, status }} />
    </Card>
  </main>;
}
