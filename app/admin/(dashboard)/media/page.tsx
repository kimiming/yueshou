import { Card, List, Typography } from "antd";

import { MediaMetadataForm } from "@/components/admin/editor-forms";
import { MediaPicker } from "@/components/admin/media-picker";
import { requireUser } from "@/lib/auth/permissions";
import { prisma } from "@/lib/db/prisma";
import { prismaMediaRepository } from "@/features/media/repository";

import { archiveMediaAction, publishMediaAction, saveMediaMetadataAction } from "./actions";

export default async function MediaPage() {
  const user = await requireUser();
  const assets = await prisma.mediaAsset.findMany({ orderBy: { createdAt: "desc" }, take: 50, include: { translations: true, deletionJob: true } });
  const rows = await Promise.all(assets.map(async (asset) => ({ asset, references: await prismaMediaRepository.countReferences(asset.id) })));
  return <main><Typography.Title level={1}>Media library</Typography.Title><Card><MediaPicker /><p>Uploads are sent directly to a short-lived storage URL. Browser code never receives storage credentials.</p><List dataSource={rows} locale={{ emptyText: "No media assets yet." }} renderItem={({ asset, references }) => { const metadata = { id: asset.id, version: asset.updatedAt.toISOString(), translations: asset.translations.map((item) => ({ locale: (item.locale === "zh_CN" ? "zh-CN" : item.locale) as "en" | "zh-CN" | "de" | "fr" | "es", title: item.title, body: item.body, alt: item.alt })) }; const referenceCount = Object.values(references).reduce((total, count) => total + count, 0); const deletion = asset.deletionJob ? `Deletion ${asset.deletionJob.status.toLowerCase()} after ${asset.deletionJob.deleteAfter.toISOString()}` : asset.status === "ARCHIVED" ? "Retained because it is still referenced." : "Not queued for deletion."; return <List.Item><Card title={asset.filename} style={{ width: "100%" }}><p>{asset.mimeType} · {asset.sizeBytes} bytes · {asset.status} · {referenceCount} active references</p><p>{deletion}</p><MediaMetadataForm initial={metadata} save={saveMediaMetadataAction} publish={publishMediaAction} archive={archiveMediaAction} allowArchive={user.role === "ADMIN"} /></Card></List.Item>; }} /></Card></main>;
}
