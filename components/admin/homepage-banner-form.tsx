"use client";

import { Button, Card, Form, Input, Typography } from "antd";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { MediaPicker } from "./media-picker";

type MediaOption = { id: string; filename: string; alt: string };

export function HomepageBannerForm({
  initialImageId,
  mediaOptions,
  save,
}: {
  initialImageId?: string;
  mediaOptions: MediaOption[];
  save(input: { imageId?: string }): Promise<unknown>;
}) {
  const [form] = Form.useForm();
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<string>();
  const router = useRouter();

  return <Card title="首页 Banner 图" style={{ marginTop: 16 }}>
    <Typography.Paragraph>可以选择已发布图片，也可以直接上传新图片。保存时系统会自动发布新图片并立即更新官网 Banner。</Typography.Paragraph>
    <Form form={form} initialValues={{ imageId: initialImageId }} onFinish={(values) => startTransition(async () => {
      setMessage(undefined);
      try {
        await save({ imageId: values.imageId || undefined });
        setMessage("首页 Banner 已更新。");
        router.refresh();
      } catch {
        setMessage("无法更新首页 Banner。请确认图片上传完成后重试；如果仍失败，请刷新页面。");
      }
    })}>
      <Form.Item name="imageId" hidden><Input /></Form.Item>
      <Form.Item shouldUpdate noStyle>{() => <MediaPicker
        available={mediaOptions}
        value={form.getFieldValue("imageId") as string | undefined}
        onChange={(value) => form.setFieldValue("imageId", value)}
      />}</Form.Item>
      {message ? <Typography.Paragraph role="status">{message}</Typography.Paragraph> : null}
      <Button type="primary" htmlType="submit" loading={pending}>保存首页 Banner</Button>
    </Form>
  </Card>;
}
