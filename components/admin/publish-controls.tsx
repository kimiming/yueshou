"use client";

import { Alert, Button, Space } from "antd";

export function PublishControls({ errors = [], onDraft, onPublish, onArchive }: { errors?: readonly string[]; onDraft?(): void; onPublish?(): void; onArchive?(): void }) {
  return <Space direction="vertical" style={{ width: "100%" }}>
    {errors.map((error) => <Alert key={error} type="error" showIcon message={error} />)}
    <Space wrap><Button onClick={onDraft}>保存草稿</Button><Button type="primary" onClick={onPublish}>发布</Button><Button danger onClick={onArchive}>归档</Button></Space>
  </Space>;
}
