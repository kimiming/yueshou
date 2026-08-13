"use client";

import { Button, Image, Popconfirm, Space, Table, Tag } from "antd";
import type { ColumnsType } from "antd/es/table";
import Link from "next/link";
import { useTransition } from "react";

type Row = { id: string; title: string; imageUrl: string; category?: string; status: string; updatedAt: string; version: string; editHref: string; detail?: string };

export function ManagementTable({ rows, deleteAction }: { rows: Row[]; deleteAction?: (data: FormData) => Promise<void> }) {
  const [pending, startTransition] = useTransition();
  const columns: ColumnsType<Row> = [
    { title: "缩略图", dataIndex: "imageUrl", width: 112, render: (url: string, row) => <Image src={url} alt={row.title} width={80} height={60} style={{ objectFit: "cover", borderRadius: 6 }} fallback="data:image/gif;base64,R0lGODlhAQABAAD/ACwAAAAAAQABAAACADs=" /> },
    { title: "名称", dataIndex: "title", render: (title: string, row) => <><Link href={row.editHref}><strong>{title}</strong></Link>{row.detail ? <div className="admin-table-detail">{row.detail}</div> : null}</> },
    ...(rows.some((row) => row.category) ? [{ title: "分类", dataIndex: "category", width: 160 }] : []),
    { title: "状态", dataIndex: "status", width: 110, render: (status: string) => <Tag color={status === "PUBLISHED" ? "green" : status === "DRAFT" ? "gold" : "default"}>{status === "PUBLISHED" ? "已发布" : status === "DRAFT" ? "草稿" : "已归档"}</Tag> },
    { title: "更新时间", dataIndex: "updatedAt", width: 190 },
    { title: "操作", key: "actions", fixed: "right", width: deleteAction ? 150 : 90, render: (_, row) => <Space><Link href={row.editHref}>编辑</Link>{deleteAction ? <Popconfirm title="确认删除？" description="删除后网站将立即停止展示。" okText="删除" cancelText="取消" onConfirm={() => startTransition(async () => { const data = new FormData(); data.set("id", row.id); data.set("version", row.version); await deleteAction(data); })}><Button danger type="link" loading={pending}>删除</Button></Popconfirm> : null}</Space> },
  ];
  return <Table<Row> rowKey="id" columns={columns} dataSource={rows} pagination={{ pageSize: 20, showSizeChanger: true, showTotal: (total) => `共 ${total} 条` }} scroll={{ x: 900 }} />;
}
