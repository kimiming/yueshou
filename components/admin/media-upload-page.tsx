"use client";

import { Button, Space } from "antd";
import { useState } from "react";
import { MediaPicker } from "./media-picker";

export function MediaUploadPage() {
  const [id, setId] = useState<string>();
  return <Space direction="vertical" style={{ width: "100%" }}><MediaPicker showCatalogue={false} value={id} onChange={(value) => setId(typeof value === "string" ? value : undefined)} />{id ? <Button type="primary" href={`/admin/media/${id}`}>继续填写图片信息并发布</Button> : null}</Space>;
}
