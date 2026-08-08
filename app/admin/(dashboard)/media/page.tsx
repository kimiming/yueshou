import { Button, Card, List, Typography } from "antd";

import { MediaPicker } from "@/components/admin/media-picker";
import { TranslationTabs } from "@/components/admin/translation-tabs";
import { requireUser } from "@/lib/auth/permissions";
import { prisma } from "@/lib/db/prisma";

import { archiveMediaAction, saveMediaMetadataAction } from "./actions";

export default async function MediaPage() {
  await requireUser();
  const assets = await prisma.mediaAsset.findMany({ where: { deletedAt: null }, orderBy: { createdAt: "desc" }, take: 50, include: { translations: true } });
  return <main><Typography.Title level={1}>Media library</Typography.Title><Card><MediaPicker /><p>Uploads are sent directly to a short-lived storage URL. Browser code never receives storage credentials.</p><List dataSource={assets} locale={{ emptyText: "No media assets yet." }} renderItem={(asset) => { const translations = Object.fromEntries(asset.translations.map((item) => [item.locale === "zh_CN" ? "zh-CN" : item.locale, { title: item.title, body: item.body }])); const metadata = { id: asset.id, version: asset.updatedAt.toISOString(), translations: asset.translations.map((item) => ({ locale: item.locale === "zh_CN" ? "zh-CN" : item.locale, title: item.title, body: item.body, alt: item.alt })) }; return <List.Item><Card title={asset.filename} style={{ width: "100%" }}><p>{asset.mimeType} · {asset.sizeBytes} bytes · {asset.status}</p><form action={saveMediaMetadataAction}><textarea aria-label={`Media metadata for ${asset.filename}`} name="payload" defaultValue={JSON.stringify(metadata, null, 2)} rows={8} style={{ display: "block", width: "100%" }} /><TranslationTabs completeLocales={Object.keys(translations) as never} values={translations} /><Button htmlType="submit">Save metadata</Button></form><form action={archiveMediaAction}><input type="hidden" name="payload" value={JSON.stringify({ mediaAssetId: asset.id })} /><Button danger htmlType="submit">Archive safely</Button></form></Card></List.Item>; }} /></Card></main>;
}
