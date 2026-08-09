"use client";

import { Button, Card, Space, Typography, Upload } from "antd";
import type { UploadProps } from "antd";
import { useEffect, useState } from "react";

type Asset = { id: string; filename: string; alt: string };
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
}: {
  value?: MediaValue;
  onChange?(value: string | string[] | undefined): void;
  upload?: UploadProps;
  available?: Asset[];
  multiple?: boolean;
}) {
  const [fetchedCatalogue, setFetchedCatalogue] = useState<Asset[]>([]);
  const [uploadNotice, setUploadNotice] = useState<string>();
  const selectedIds = Array.isArray(value) ? value : value ? [value] : [];

  useEffect(() => {
    if (available.length) return;
    void fetch("/api/admin/media/available", { cache: "no-store" })
      .then(async (response) => response.ok ? response.json() as Promise<Asset[]> : [])
      .then(setFetchedCatalogue)
      .catch(() => undefined);
  }, [available.length]);
  const catalogue = available.length ? available : fetchedCatalogue;

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
      if (!multiple) onChange?.(asset.id);
      setUploadNotice("上传完成并已自动选中。保存当前表单后，系统会发布并应用这张图片。");
      request.onProgress?.({ percent: 100 });
      request.onSuccess?.(asset);
    } catch (error) {
      const failure = error instanceof Error ? error : new Error("媒体上传失败");
      setUploadNotice(failure.message);
      request.onError?.(failure);
    }
  };

  return <Card size="small" title="已发布媒体">
    <Space direction="vertical">
      <Typography.Text>{selectedIds.length ? `已选择 ${selectedIds.length} 个媒体` : "尚未选择媒体"}</Typography.Text>
      {catalogue.map((asset) => <Button key={asset.id} aria-pressed={selectedIds.includes(asset.id)} type={selectedIds.includes(asset.id) ? "primary" : "default"} onClick={() => select(asset.id)} title={asset.alt}>{asset.filename}{asset.alt ? ` — ${asset.alt}` : ""}</Button>)}
      <Upload {...upload} customRequest={upload?.customRequest ?? customRequest} accept=".jpg,.jpeg,.png,.webp,.avif,image/jpeg,image/png,image/webp,image/avif" showUploadList><Button>上传图片（最大 25MB）</Button></Upload>
      {uploadNotice ? <Typography.Text type="secondary" role="status">{uploadNotice}</Typography.Text> : null}
      {uploadNotice ? <Button href="/admin/media" target="_blank">打开媒体库编辑图片说明</Button> : null}
      <Button onClick={clear} disabled={!selectedIds.length}>清除选择</Button>
    </Space>
  </Card>;
}
