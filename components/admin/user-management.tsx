"use client";

import { Button, Form, Input, Modal, Popconfirm, Select, Space, Table, Tag } from "antd";
import { useState, useTransition } from "react";

type Action = (input: unknown) => Promise<unknown>;
type UserRow = { id: string; email: string; role: "ADMIN" | "EDITOR"; isActive: boolean; createdAt: string; protected: boolean };

export function UserManagement({ users, create, update, remove }: { users: UserRow[]; create: Action; update: Action; remove: Action }) {
  const [createOpen, setCreateOpen] = useState(false); const [editing, setEditing] = useState<UserRow>(); const [pending, start] = useTransition();
  const submit = (action: Action, values: object, close: () => void) => start(async () => { await action(values); close(); });
  const columns = [
    { title: "邮箱", dataIndex: "email" },
    { title: "角色", dataIndex: "role", width: 120, render: (role: string) => <Tag color={role === "ADMIN" ? "blue" : "default"}>{role === "ADMIN" ? "管理员" : "编辑员"}</Tag> },
    { title: "状态", dataIndex: "isActive", width: 110, render: (active: boolean) => <Tag color={active ? "green" : "red"}>{active ? "已启用" : "已停用"}</Tag> },
    { title: "创建时间", dataIndex: "createdAt", width: 190 },
    { title: "操作", width: 170, render: (_: unknown, row: UserRow) => <Space><Button type="link" onClick={() => setEditing(row)}>编辑</Button><Popconfirm disabled={row.protected} title="确认删除该用户？" onConfirm={() => start(async () => { await remove({ id: row.id }); })}><Button danger type="link" disabled={row.protected}>删除</Button></Popconfirm></Space> },
  ];
  return <><div className="admin-list-toolbar"><Button type="primary" onClick={() => setCreateOpen(true)}>新增用户</Button></div><Table rowKey="id" columns={columns} dataSource={users} pagination={{ pageSize: 20 }} />
    <Modal title="新增用户" open={createOpen} footer={null} onCancel={() => setCreateOpen(false)} destroyOnHidden><Form layout="vertical" initialValues={{ role: "EDITOR" }} onFinish={(values) => submit(create, values, () => setCreateOpen(false))}><Form.Item name="email" label="邮箱" rules={[{ required: true, type: "email" }]}><Input /></Form.Item><Form.Item name="password" label="初始密码" rules={[{ required: true, min: 12 }]}><Input.Password /></Form.Item><Form.Item name="role" label="角色"><Select options={[{ value: "ADMIN", label: "管理员" }, { value: "EDITOR", label: "编辑员" }]} /></Form.Item><Button type="primary" htmlType="submit" loading={pending}>创建用户</Button></Form></Modal>
    <Modal title="编辑用户" open={Boolean(editing)} footer={null} onCancel={() => setEditing(undefined)} destroyOnHidden>{editing ? <Form layout="vertical" initialValues={{ role: editing.role, isActive: editing.isActive }} onFinish={(values) => submit(update, { id: editing.id, ...values }, () => setEditing(undefined))}><Form.Item name="role" label="角色"><Select disabled={editing.protected} options={[{ value: "ADMIN", label: "管理员" }, { value: "EDITOR", label: "编辑员" }]} /></Form.Item><Form.Item name="isActive" label="状态"><Select disabled={editing.protected} options={[{ value: true, label: "启用" }, { value: false, label: "停用" }]} /></Form.Item><Form.Item name="password" label="重置密码"><Input.Password placeholder="留空保持不变" /></Form.Item><Button type="primary" htmlType="submit" loading={pending}>保存修改</Button></Form> : null}</Modal>
  </>;
}
