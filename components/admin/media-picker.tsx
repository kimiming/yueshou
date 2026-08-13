"use client";

import { Button, Card, Modal, Space, Typography, Upload } from "antd";
import type { UploadProps } from "antd";
import { useEffect, useState } from "react";

type Asset = { id: string; filename: string; alt: string; mimeType?: string };
type MediaValue = string | string[] | null | undefined;
const MAX_UPLOAD_BYTES = 25 * 1024 * 1024;
const MIME_BY_EXTENSION: Record<string, string> = {
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
  avif: "image/avif",
};

async function uploadError(response: Response, fallback: string): Promise<Error> {
  try {
    const payload = await response.json() as { error?: string | { message?: string } };
    const message = typeof payload.error === "string" ? payload.error : payload.error?.message;
    return new Error(message || fallback);
  } catch {
    return new Error(fallback);
  }
}

export function MediaPicker({
  value,
  onChange,
  upload,
  available = [],
  multiple = false,
  showCatalogue = true,
}: {
  value?: MediaValue;
  onChange?(value: string | string[] | undefined): void;
  upload?: UploadProps;
  available?: Asset[];
  multiple?: boolean;
  showCatalogue?: boolean;
}) {
  const [fetchedCatalogue, setFetchedCatalogue] = useState<Asset[]>([]);
  const [uploadedAssets, setUploadedAssets] = useState<Asset[]>([]);
  const [uploadNotice, setUploadNotice] = useState<string>();
  const [libraryOpen, setLibraryOpen] = useState(false);
  const selectedIds = Array.isArray(value) ? value : value ? [value] : [];

  useEffect(() => {
    if (!showCatalogue || available.length) return;
    void fetch("/api/admin/media/available", { cache: "no-store" })
      .then(async (response) => response.ok ? response.json() as Promise<Asset[]> : [])
      .then(setFetchedCatalogue)
      .catch(() => undefined);
  }, [available.length, showCatalogue]);
  const catalogue = [...uploadedAssets, ...(available.length ? available : fetchedCatalogue)].filter((asset, index, assets) => assets.findIndex((item) => item.id === asset.id) === index);

  const select = (id: string) => {
    if (multiple) {
      onChange?.(selectedIds.includes(id) ? selectedIds.filter((item) => item !== id) : [...selectedIds, id]);
      return;
    }
    onChange?.(id);
  };
  const clear = () => onChange?.(multiple ? [] : undefined);
  const customRequest: NonNullable<UploadProps["customRequest"]> = async (request) => {
    try {
      const file = request.file as File;
      const extension = file.name.split(".").pop()?.toLowerCase() ?? "";
      const normalizedType = MIME_BY_EXTENSION[extension];
      if (!normalizedType) throw new Error("仅支持 JPG、PNG、WebP 和 AVIF 图片");
      if (file.size > MAX_UPLOAD_BYTES) throw new Error("图片不能超过 25MB，请压缩后重试");
      const uploadInput = { name: file.name, type: normalizedType, size: file.size };
      request.onProgress?.({ percent: 10 });
      const presign = await fetch("/api/media/presign", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(uploadInput) });
      if (!presign.ok) throw await uploadError(presign, "无法创建安全上传地址");
      const signed = await presign.json() as { key: string; url: string; method: "PUT"; headers: Record<string, string> };
      const stored = await fetch(signed.url, { method: signed.method, headers: signed.headers, body: file });
      if (!stored.ok) throw new Error(`无法上传媒体文件（${stored.status}）`);
      request.onProgress?.({ percent: 80 });
      const complete = await fetch("/api/media/complete", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ ...uploadInput, key: signed.key }) });
      if (!complete.ok) throw await uploadError(complete, "无法确认媒体上传");
      const asset = await complete.json() as { id: string };
      setUploadedAssets((current) => [{ id: asset.id, filename: file.name, alt: "", mimeType: normalizedType }, ...current]);
      onChange?.(multiple ? [...selectedIds, asset.id] : asset.id);
      setUploadNotice("上传完成并已自动选中。保存当前表单后，系统会发布并应用这张图片。");
      request.onProgress?.({ percent: 100 });
      request.onSuccess?.(asset);
    } catch (error) {
      const failure = error instanceof Error ? error : new Error("媒体上传失败");
      setUploadNotice(failure.message);
      request.onError?.(failure);
    }
  };

  const preview = (asset: Asset) => asset.mimeType?.startsWith("video/") ? <video src={`/api/admin/media/${encodeURIComponent(asset.id)}`} muted preload="metadata" /> : <img src={`/api/admin/media/${encodeURIComponent(asset.id)}`} alt={asset.alt || asset.filename} loading="lazy" />;
  return <Card size="small" title="产品媒体">
    <Space orientation="vertical" style={{ width: "100%" }}>
      <Typography.Text>{selectedIds.length ? `已选择 ${selectedIds.length} 个媒体` : "尚未选择媒体"}</Typography.Text>
      {selectedIds.length ? <div className="admin-selected-media">{selectedIds.map((id) => { const asset = catalogue.find((item) => item.id === id) ?? { id, filename: id, alt: "" }; return <div className="admin-selected-media__item" key={id}>{preview(asset)}<div className="admin-selected-media__footer"><span title={asset.filename}>{asset.filename}</span><Button size="small" danger onClick={() => select(id)}>移除</Button></div></div>; })}</div> : null}
      <div className="admin-media-actions"><Upload {...upload} customRequest={upload?.customRequest ?? customRequest} accept=".jpg,.jpeg,.png,.webp,.avif,image/jpeg,image/png,image/webp,image/avif" showUploadList={false}><Button>上传照片</Button></Upload>{showCatalogue ? <Button onClick={() => setLibraryOpen(true)}>从媒体库选择</Button> : null}<Button onClick={clear} disabled={!selectedIds.length}>清除选择</Button></div>
      {uploadNotice ? <Typography.Text type="secondary" role="status">{uploadNotice}</Typography.Text> : null}
      <Modal title="从媒体库选择图片或视频" open={libraryOpen} onCancel={() => setLibraryOpen(false)} footer={<Button type="primary" onClick={() => setLibraryOpen(false)}>完成</Button>} width={900}><div className="admin-media-library-picker">{catalogue.map((asset) => <button type="button" aria-pressed={selectedIds.includes(asset.id)} aria-label={`${asset.filename}${selectedIds.includes(asset.id) ? "（已选择）" : ""}`} className={selectedIds.includes(asset.id) ? "is-selected" : ""} onClick={() => select(asset.id)} key={asset.id}>{preview(asset)}<span>{asset.filename}</span></button>)}</div></Modal>
    </Space>
  </Card>;
}
