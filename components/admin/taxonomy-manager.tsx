"use client";

import { Button, Card, Form, Input, List, Select, Space } from "antd";
import { useState, useTransition } from "react";

type Action = (input: unknown) => Promise<unknown>;
type CategoryItem = { id: string; slug: string; label: string; body: string; status: "DRAFT" | "PUBLISHED" | "ARCHIVED"; version: string };
type TagItem = { id: string; slug: string; label: string; version: string };
type Props = { title: string; save: Action; archive?: Action } & ({ kind: "category"; items: CategoryItem[] } | { kind: "tag"; items: TagItem[] });

export function TaxonomyManager({ title, items, save, archive, kind }: Props) {
  const [form] = Form.useForm(); const [pending, start] = useTransition(); const [error, setError] = useState<string>(); const category = kind === "category";
  const submit = (value: Record<string, unknown>) => start(async () => { try { setError(undefined); const payload = category ? value : { id: value.id, version: value.version, slug: value.slug, title: value.title }; await save(payload); form.resetFields(); } catch (reason) { setError(reason instanceof Error ? reason.message : "Could not save taxonomy item"); } });
  return <Card title={title}><Form form={form} layout="inline" initialValues={category ? { status: "DRAFT" } : {}} onFinish={submit}>
    <Form.Item name="id" hidden><Input /></Form.Item><Form.Item name="version" hidden><Input /></Form.Item><Form.Item name="slug" rules={[{ required: true }]}><Input placeholder="slug" /></Form.Item><Form.Item name="title" rules={[{ required: true }]}><Input placeholder="English name" /></Form.Item>
    {category ? <><Form.Item name="body" rules={[{ required: true }]}><Input.TextArea placeholder="English description" /></Form.Item><Form.Item name="status"><Select style={{ minWidth: 110 }} options={["DRAFT", "PUBLISHED"].map((value) => ({ value }))} /></Form.Item></> : null}
    <Button htmlType="submit" loading={pending}>Save</Button><Button onClick={() => form.resetFields()} disabled={pending}>New</Button>
  </Form>{error ? <p role="alert">{error}</p> : null}<List size="small" dataSource={items} renderItem={(item) => <List.Item actions={[<Button key="edit" size="small" onClick={() => form.setFieldsValue(category ? { id: item.id, version: item.version, slug: item.slug, title: item.label, body: (item as CategoryItem).body, status: (item as CategoryItem).status } : { id: item.id, version: item.version, slug: item.slug, title: item.label })}>Edit</Button>, ...(archive ? [<Button key="archive" danger size="small" onClick={() => start(async () => { try { await archive(category ? { categoryId: item.id, version: item.version } : { tagId: item.id, version: item.version }); } catch (reason) { setError(reason instanceof Error ? reason.message : "Cannot archive referenced item"); } })}>Archive</Button>] : [])]}><Space><strong>{item.label}</strong><span>{item.slug}</span>{category ? <span>{(item as CategoryItem).status}</span> : null}</Space></List.Item>} /></Card>;
}
