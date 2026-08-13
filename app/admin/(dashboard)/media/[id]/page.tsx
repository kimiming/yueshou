/* eslint-disable @next/next/no-img-element */
import { notFound } from "next/navigation";
import { AdminPageTitle, Card } from "@/components/admin/antd-server-bridge";
import { MediaMetadataForm } from "@/components/admin/editor-forms";
import { requireUser } from "@/lib/auth/permissions";
import { prisma } from "@/lib/db/prisma";
import { archiveMediaAction, publishMediaAction, saveMediaMetadataAction } from "../actions";

export default async function MediaEditPage({ params }: { params: Promise<{ id: string }> }) { const user = await requireUser(); const { id } = await params; const asset = await prisma.mediaAsset.findFirst({ where: { id, deletedAt: null }, include: { translations: true } }); if (!asset) notFound(); const initial = { id: asset.id, version: asset.updatedAt.toISOString(), translations: asset.translations.map((item) => ({ locale: (item.locale === "zh_CN" ? "zh-CN" : item.locale) as "en" | "zh-CN" | "de" | "fr" | "es", title: item.title, body: item.body, alt: item.alt })) }; return <main><AdminPageTitle level={1}>编辑媒体</AdminPageTitle><Card><div className="admin-media-edit-preview"><img src={`/api/admin/media/${encodeURIComponent(asset.id)}`} alt={asset.filename} /></div><MediaMetadataForm initial={initial} save={saveMediaMetadataAction} publish={publishMediaAction} archive={archiveMediaAction} allowArchive={user.role === "ADMIN"} /></Card></main>; }
