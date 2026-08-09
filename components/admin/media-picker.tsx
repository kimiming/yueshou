"use client";

import { Button, Card, Space, Typography, Upload } from "antd";
import type { UploadProps } from "antd";
import { useEffect, useState } from "react";

type Asset = { id: string; filename: string; alt: string };
type MediaValue = string | string[] | null | undefined;

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
      const uploadInput = { name: file.name, type: file.type, size: file.size };
      request.onProgress?.({ percent: 10 });
      const presign = await fetch("/api/media/presign", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(uploadInput) });
      if (!presign.ok) throw new Error("Could not create a secure upload URL");
      const signed = await presign.json() as { key: string; url: string; method: "PUT"; headers: Record<string, string> };
      const stored = await fetch(signed.url, { method: signed.method, headers: signed.headers, body: file });
      if (!stored.ok) throw new Error("Could not upload the media file");
      request.onProgress?.({ percent: 80 });
      const complete = await fetch("/api/media/complete", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ ...uploadInput, key: signed.key }) });
      if (!complete.ok) throw new Error("Could not confirm the media upload");
      const asset = await complete.json() as { id: string };
      setUploadNotice("Upload completed. Add alt text and publish it in Media library before selecting it.");
      request.onProgress?.({ percent: 100 });
      request.onSuccess?.(asset);
    } catch (error) {
      request.onError?.(error instanceof Error ? error : new Error("Media upload failed"));
    }
  };

  return <Card size="small" title="Published media">
    <Space direction="vertical">
      <Typography.Text>{selectedIds.length ? `Selected assets: ${selectedIds.length}` : "No media selected"}</Typography.Text>
      {catalogue.map((asset) => <Button key={asset.id} aria-pressed={selectedIds.includes(asset.id)} type={selectedIds.includes(asset.id) ? "primary" : "default"} onClick={() => select(asset.id)} title={asset.alt}>{asset.filename}{asset.alt ? ` — ${asset.alt}` : ""}</Button>)}
      <Upload {...upload} customRequest={upload?.customRequest ?? customRequest} accept="image/jpeg,image/png,image/webp,image/avif" showUploadList><Button>Upload image</Button></Upload>
      {uploadNotice ? <Typography.Text type="secondary" role="status">{uploadNotice}</Typography.Text> : null}
      <Button onClick={clear} disabled={!selectedIds.length}>Clear selection</Button>
    </Space>
  </Card>;
}
