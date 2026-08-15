"use client";

import { Alert, Button, Card, Space, Typography } from "antd";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { MediaPicker } from "@/components/admin/media-picker";

type Asset = { id: string; filename: string; alt: string; mimeType?: string; status?: string };

export function FactoryGalleryManager({
  initialImageIds,
  initialVersion,
  available,
  publish,
}: {
  initialImageIds: string[];
  initialVersion: string;
  available: Asset[];
  publish(input: { imageIds: string[]; version: string }): Promise<{ version: string; count: number }>;
}) {
  const router = useRouter();
  const [imageIds, setImageIds] = useState(initialImageIds);
  const [publishedImageIds, setPublishedImageIds] = useState(initialImageIds);
  const [version, setVersion] = useState(initialVersion);
  const [error, setError] = useState<string>();
  const [success, setSuccess] = useState<string>();
  const [pending, startTransition] = useTransition();
  const changed = imageIds.join("|") !== publishedImageIds.join("|");

  const submit = () => startTransition(async () => {
    try {
      setError(undefined);
      setSuccess(undefined);
      const result = await publish({ imageIds, version });
      setVersion(result.version);
      setPublishedImageIds(imageIds);
      setSuccess(`发布成功，官网画廊现在展示 ${result.count} 张图片。`);
      router.refresh();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "发布失败，请稍后重试");
    }
  });

  return (
    <Space orientation="vertical" size="large" style={{ width: "100%" }}>
      <Alert type="info" showIcon message="画廊管理说明" description="上传或从媒体库选择图片，移除不再展示的图片，然后点击发布。新上传的图片会在发布画廊时自动发布到媒体库。最多可展示 12 张。" />
      <MediaPicker
        multiple
        title="Our Factory 画廊图片"
        value={imageIds}
        available={available}
        onChange={(value) => {
          setImageIds(Array.isArray(value) ? value : value ? [value] : []);
          setSuccess(undefined);
        }}
      />
      <Card size="small" title="图片维护">
        <Space wrap>
          {imageIds.map((id) => {
            const asset = available.find((item) => item.id === id);
            return <Button key={id}><Link href={`/admin/media/${encodeURIComponent(id)}`}>编辑 {asset?.filename ?? id}</Link></Button>;
          })}
          <Button><Link href="/admin/media">查看完整媒体库</Link></Button>
        </Space>
      </Card>
      {error ? <Alert type="error" showIcon message={error} /> : null}
      {success ? <Alert type="success" showIcon message={success} /> : null}
      <Space>
        <Button type="primary" size="large" loading={pending} onClick={submit} disabled={imageIds.length > 12}>
          发布画廊
        </Button>
        <Typography.Text type="secondary">当前选择 {imageIds.length} 张{changed ? "，有未发布更改" : ""}</Typography.Text>
      </Space>
    </Space>
  );
}
