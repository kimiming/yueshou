"use client";

import { Alert, Button, Form, Input, Modal, Popconfirm, Select, Space, Table, Tag, Typography } from "antd";
import { useState, useTransition } from "react";

type SocialLink = { label: string; href: string };
type Mutation =
  | { operation: "create"; version: string; item: SocialLink }
  | { operation: "update"; version: string; index: number; item: SocialLink }
  | { operation: "delete"; version: string; index: number };

const platformOptions = ["Facebook", "Instagram", "X", "TikTok", "WhatsApp", "LinkedIn", "YouTube"].map((value) => ({ value, label: value }));

export function SocialMediaManager({ initialItems, initialVersion, mutate }: {
  initialItems: SocialLink[];
  initialVersion: string;
  mutate(input: Mutation): Promise<{ version: string; items: SocialLink[] }>;
}) {
  const [form] = Form.useForm<SocialLink>();
  const [items, setItems] = useState(initialItems);
  const [version, setVersion] = useState(initialVersion);
  const [editingIndex, setEditingIndex] = useState<number>();
  const [modalOpen, setModalOpen] = useState(false);
  const [error, setError] = useState<string>();
  const [success, setSuccess] = useState<string>();
  const [pending, startTransition] = useTransition();

  const apply = (input: Mutation, message: string) => startTransition(async () => {
    try {
      setError(undefined);
      const result = await mutate(input);
      setItems(result.items);
      setVersion(result.version);
      setSuccess(message);
      setModalOpen(false);
      form.resetFields();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "操作失败，请稍后重试");
    }
  });
  const openCreate = () => {
    setEditingIndex(undefined);
    form.resetFields();
    setModalOpen(true);
  };
  const openEdit = (item: SocialLink, index: number) => {
    setEditingIndex(index);
    form.setFieldsValue(item);
    setModalOpen(true);
  };
  const submit = (item: SocialLink) => apply(
    editingIndex === undefined
      ? { operation: "create", version, item }
      : { operation: "update", version, index: editingIndex, item },
    editingIndex === undefined ? "社交媒体账号已新增并发布。" : "社交媒体账号已更新并发布。",
  );

  return (
    <Space orientation="vertical" size="middle" style={{ width: "100%" }}>
      <Space style={{ width: "100%", justifyContent: "space-between" }}>
        <Typography.Text type="secondary">管理官网页脚图标及 WhatsApp 浮动按钮，保存后立即发布。</Typography.Text>
        <Button type="primary" onClick={openCreate} disabled={items.length >= 12}>新增社交媒体</Button>
      </Space>
      {error ? <Alert type="error" showIcon message={error} closable onClose={() => setError(undefined)} /> : null}
      {success ? <Alert type="success" showIcon message={success} closable onClose={() => setSuccess(undefined)} /> : null}
      <Table
        rowKey="key"
        dataSource={items.map((item, index) => ({ ...item, key: String(index) }))}
        pagination={false}
        locale={{ emptyText: "暂无社交媒体账号" }}
        columns={[
          { title: "平台", dataIndex: "label", width: 180, render: (label: string) => <Tag color="blue">{label}</Tag> },
          { title: "主页链接", dataIndex: "href", ellipsis: true, render: (href: string) => <a href={href} target="_blank" rel="noopener noreferrer">{href}</a> },
          {
            title: "操作",
            key: "actions",
            width: 180,
            render: (_value, record: SocialLink, index: number) => <Space>
              <Button size="small" onClick={() => openEdit(record, index)}>编辑</Button>
              <Popconfirm title="确认删除这个社交媒体账号？" description="删除后官网对应图标会立即消失。" okText="删除" cancelText="取消" onConfirm={() => apply({ operation: "delete", version, index }, "社交媒体账号已删除并发布。") }>
                <Button size="small" danger loading={pending}>删除</Button>
              </Popconfirm>
            </Space>,
          },
        ]}
      />
      <Modal title={editingIndex === undefined ? "新增社交媒体" : "编辑社交媒体"} open={modalOpen} onCancel={() => setModalOpen(false)} onOk={() => form.submit()} confirmLoading={pending} okText="保存并发布" cancelText="取消" destroyOnHidden>
        <Form form={form} layout="vertical" onFinish={submit} preserve={false}>
          <Form.Item name="label" label="平台名称" rules={[{ required: true, message: "请选择或输入平台名称" }, { max: 80 }]}>
            <Select showSearch allowClear options={platformOptions} placeholder="例如 Facebook、Instagram、WhatsApp" />
          </Form.Item>
          <Form.Item name="href" label="主页链接" rules={[{ required: true, message: "请输入主页链接" }, { type: "url", message: "请输入完整的 HTTPS 链接" }, { pattern: /^https:\/\//i, message: "链接必须使用 HTTPS" }]}>
            <Input placeholder="https://www.facebook.com/your-page" />
          </Form.Item>
        </Form>
      </Modal>
    </Space>
  );
}
