"use client";

import { Alert, Button, Space } from "antd";

export function PublishControls({ errors = [], onDraft, onPublish, onArchive }: { errors?: readonly string[]; onDraft?(): void; onPublish?(): void; onArchive?(): void }) {
  return <Space direction="vertical" style={{ width: "100%" }}>
    {errors.map((error) => <Alert key={error} type="error" showIcon message={error} />)}
    <Space wrap><Button onClick={onDraft}>Save draft</Button><Button type="primary" onClick={onPublish}>Publish</Button><Button danger onClick={onArchive}>Archive</Button></Space>
  </Space>;
}
