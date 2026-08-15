"use client";

import { UploadOutlined } from "@ant-design/icons";
import { Alert, Button, List, Progress, Space, Tag, Typography, Upload } from "antd";
import type { UploadProps } from "antd";
import { useMemo, useRef, useState } from "react";

import { uploadObjectWithProgress } from "./media-picker";

const MAX_UPLOAD_BYTES = 25 * 1024 * 1024;
const MIME_BY_EXTENSION: Record<string, string> = {
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
  avif: "image/avif",
};

type QueueStatus = "queued" | "uploading" | "success" | "error";
type QueueItem = {
  id: string;
  fileName: string;
  percent: number;
  phase: string;
  status: QueueStatus;
  assetId?: string;
};

async function responseError(response: Response, fallback: string): Promise<Error> {
  try {
    const payload = await response.json() as { error?: string | { message?: string } };
    const message = typeof payload.error === "string" ? payload.error : payload.error?.message;
    return new Error(message || fallback);
  } catch {
    return new Error(fallback);
  }
}

function statusTag(status: QueueStatus) {
  if (status === "success") return <Tag color="success">上传成功</Tag>;
  if (status === "error") return <Tag color="error">上传失败</Tag>;
  if (status === "uploading") return <Tag color="processing">正在上传</Tag>;
  return <Tag>等待上传</Tag>;
}

export function MediaUploadPage() {
  const [items, setItems] = useState<QueueItem[]>([]);
  const queue = useRef(Promise.resolve());

  const updateItem = (id: string, update: Partial<QueueItem>) => {
    setItems((current) => current.map((item) => item.id === id ? { ...item, ...update } : item));
  };

  const customRequest: NonNullable<UploadProps["customRequest"]> = (request) => {
    const file = request.file as File & { uid?: string };
    const id = file.uid ?? `${file.name}-${file.size}-${Date.now()}-${Math.random()}`;
    setItems((current) => [...current, { id, fileName: file.name, percent: 0, phase: "等待前面的图片上传", status: "queued" }]);

    const uploadCurrent = async () => {
      try {
        const extension = file.name.split(".").pop()?.toLowerCase() ?? "";
        const normalizedType = MIME_BY_EXTENSION[extension];
        if (!normalizedType) throw new Error("仅支持 JPG、PNG、WebP 和 AVIF 图片");
        if (file.size > MAX_UPLOAD_BYTES) throw new Error("图片不能超过 25MB，请压缩后重试");

        const uploadInput = { name: file.name, type: normalizedType, size: file.size };
        updateItem(id, { status: "uploading", phase: "正在创建安全上传地址", percent: 5 });
        const presign = await fetch("/api/media/presign", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(uploadInput),
        });
        if (!presign.ok) throw await responseError(presign, "无法创建安全上传地址");
        const signed = await presign.json() as { key: string; url: string; method: "PUT"; headers: Record<string, string> };

        updateItem(id, { phase: "正在上传到媒体库", percent: 10 });
        await uploadObjectWithProgress(signed, file, (percent) => {
          const normalized = Math.round(10 + percent * 0.7);
          updateItem(id, { phase: "正在上传到媒体库", percent: normalized });
          request.onProgress?.({ percent: normalized });
        });

        updateItem(id, { phase: "正在确认上传结果", percent: 88 });
        const complete = await fetch("/api/media/complete", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ ...uploadInput, key: signed.key }),
        });
        if (!complete.ok) throw await responseError(complete, "无法确认媒体上传");
        const asset = await complete.json() as { id: string };
        updateItem(id, { assetId: asset.id, status: "success", phase: "已加入媒体库", percent: 100 });
        request.onProgress?.({ percent: 100 });
        request.onSuccess?.(asset);
      } catch (reason) {
        const error = reason instanceof Error ? reason : new Error("媒体上传失败");
        updateItem(id, { status: "error", phase: error.message });
        request.onError?.(error);
      }
    };

    queue.current = queue.current.then(uploadCurrent, uploadCurrent);
  };

  const completed = items.filter((item) => item.status === "success" || item.status === "error").length;
  const successful = items.filter((item) => item.status === "success").length;
  const failed = items.filter((item) => item.status === "error").length;
  const uploading = items.some((item) => item.status === "queued" || item.status === "uploading");
  const overallPercent = useMemo(() => items.length
    ? Math.round(items.reduce((sum, item) => sum + item.percent, 0) / items.length)
    : 0, [items]);

  return <Space direction="vertical" size="large" style={{ width: "100%" }}>
    <Alert
      type="info"
      showIcon
      message="通用媒体库上传"
      description="这里上传的图片可供产品、新闻、页面、工厂画廊等所有模块调用。支持一次选择多张图片，系统会按顺序逐张上传；单张图片最大 25MB。"
    />
    <Space wrap>
      <Upload
        multiple
        accept=".jpg,.jpeg,.png,.webp,.avif,image/jpeg,image/png,image/webp,image/avif"
        showUploadList={false}
        customRequest={customRequest}
      >
        <Button type="primary" icon={<UploadOutlined />}>选择并批量上传图片</Button>
      </Upload>
      <Button href="/admin/media">返回媒体库</Button>
      {items.length && !uploading ? <Button onClick={() => setItems([])}>清除上传记录</Button> : null}
    </Space>

    {items.length ? <div className="admin-batch-upload" aria-live="polite">
      <div className="admin-batch-upload__summary">
        <Typography.Title level={4}>上传队列</Typography.Title>
        <Typography.Text type="secondary">共 {items.length} 张，已处理 {completed} 张，成功 {successful} 张{failed ? `，失败 ${failed} 张` : ""}</Typography.Text>
      </div>
      <Progress percent={overallPercent} status={failed && completed === items.length ? "exception" : uploading ? "active" : "success"} />
      <List
        bordered
        dataSource={items}
        renderItem={(item, index) => <List.Item
          actions={item.assetId ? [<Button key="edit" size="small" href={`/admin/media/${item.assetId}`}>编辑并发布</Button>] : undefined}
        >
          <List.Item.Meta
            title={<Space wrap><Typography.Text strong>{index + 1}. {item.fileName}</Typography.Text>{statusTag(item.status)}</Space>}
            description={<Space direction="vertical" size={2} style={{ width: "100%" }}><Typography.Text type={item.status === "error" ? "danger" : "secondary"}>{item.phase}</Typography.Text><Progress percent={item.percent} status={item.status === "error" ? "exception" : item.status === "success" ? "success" : "active"} size="small" /></Space>}
          />
        </List.Item>}
      />
    </div> : <Typography.Text type="secondary">尚未选择图片。</Typography.Text>}
  </Space>;
}
