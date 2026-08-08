"use client";

import { Button, Card, Form, Input, List, Select, Space } from "antd";
import { useState, useTransition } from "react";

type Action = (input: unknown) => Promise<unknown>;
type Item = { id: string; slug: string; label: string; body?: string; status?: "DRAFT" | "PUBLISHED" | "ARCHIVED"; version?: string };

export function TaxonomyManager({ title, items, save, archive }: { title: string; items: Item[]; save: Action; archive?: Action }) {
  const [form] = Form.useForm(); const [pending, start] = useTransition(); const [error, setError] = useState<string>();
  const submit = (value: Record<string, unknown>) => start(async () => { try { setError(undefined); await save(value); form.resetFields(); } catch (reason) { setError(reason instanceof Error ? reason.message : "Could not save taxonomy item"); } });
  return <Card title={title}><Form form={form} layout="inline" initialValues={{ status: "DRAFT" }} onFinish={submit}>
    <Form.Item name="id" hidden><Input /></Form.Item><Form.Item name="version" hidden><Input /></Form.Item>
    <Form.Item name="slug" rules={[{ required: true }]}><Input placeholder="slug" /></Form.Item><Form.Item name="title" rules={[{ required: true }]}><Input placeholder="English name" /></Form.Item><Form.Item name="body" rules={[{ required: true }]}><Input.TextArea placeholder="English description" /></Form.Item>
    <Form.Item name="status"><Select style={{ minWidth: 110 }} options={["DRAFT", "PUBLISHED"].map((value) => ({ value }))} /></Form.Item>
    <Button htmlType="submit" loading={pending}>Save</Button><Button onClick={() => form.resetFields()} disabled={pending}>New</Button>
  </Form>{error ? <p role="alert">{error}</p> : null}<List size="small" dataSource={items} renderItem={(item) => <List.Item actions={[
    <Button key="edit" size="small" onClick={() => form.setFieldsValue({ id: item.id, version: item.version, slug: item.slug, title: item.label, body: item.body, status: item.status ?? "DRAFT" })}>Edit</Button>,
    ...(archive ? [<Button key="archive" danger size="small" onClick={() => start(async () => { try { await archive({ categoryId: item.id, tagId: item.id, version: item.version }); } catch (reason) { setError(reason instanceof Error ? reason.message : "Cannot archive referenced item"); } })}>Archive</Button>] : []),
  ]}><Space><strong>{item.label}</strong><span>{item.slug}</span><span>{item.status ?? "ACTIVE"}</span></Space></List.Item>} /></Card>;
}
