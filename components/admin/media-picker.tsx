"use client";

import { Button, Card, Space, Typography, Upload } from "antd";
import type { UploadProps } from "antd";
import { useState } from "react";

export function MediaPicker({ value, onChange, upload, available = [] }: { value?: { id: string; alt?: string }; onChange?(id: string | undefined): void; upload?: UploadProps; available?: Array<{ id: string; filename: string; alt: string }> }) {
  const [selected, setSelected] = useState(value?.id);
  const select = (id: string | undefined) => { setSelected(id); onChange?.(id); };
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
      select(asset.id);
      request.onProgress?.({ percent: 100 });
      request.onSuccess?.(asset);
    } catch (error) {
      request.onError?.(error instanceof Error ? error : new Error("Media upload failed"));
    }
  };
  return <Card size="small" title="Media asset">
    <Space direction="vertical"><Typography.Text>{selected ? `Selected asset: ${selected}` : "No media selected"}</Typography.Text>{available.map((asset) => <Button key={asset.id} type={selected === asset.id ? "primary" : "default"} onClick={() => select(asset.id)} title={asset.alt}>{asset.filename}{asset.alt ? ` — ${asset.alt}` : ""}</Button>)}<Upload {...upload} customRequest={upload?.customRequest ?? customRequest} accept="image/jpeg,image/png,image/webp,image/avif" showUploadList><Button>Upload image</Button></Upload><Button onClick={() => select(undefined)} disabled={!selected}>Clear selection</Button></Space>
  </Card>;
}
