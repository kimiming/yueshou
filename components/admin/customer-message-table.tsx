"use client";

import { Button, Descriptions, Modal, Popconfirm, Space, Table, Tag, Typography } from "antd";
import { useState, useTransition } from "react";

type Message = { id: string; name: string; email: string; whatsapp: string; message: string; createdAt: string; version: string };

export function CustomerMessageTable({ initialMessages, remove }: { initialMessages: Message[]; remove(input: { id: string; version: string }): Promise<void> }) {
  const [messages, setMessages] = useState(initialMessages);
  const [selected, setSelected] = useState<Message>();
  const [pending, startTransition] = useTransition();
  const deleteMessage = (item: Message) => startTransition(async () => {
    await remove({ id: item.id, version: item.version });
    setMessages((current) => current.filter((message) => message.id !== item.id));
    if (selected?.id === item.id) setSelected(undefined);
  });
  return <>
    <Table rowKey="id" dataSource={messages} pagination={{ pageSize: 20 }} locale={{ emptyText: "暂无客户留言" }} columns={[
      { title: "客户姓名", dataIndex: "name", width: 150 },
      { title: "邮箱", dataIndex: "email", render: (email: string) => <a href={`mailto:${email}`}>{email}</a> },
      { title: "WhatsApp", dataIndex: "whatsapp", render: (phone: string) => <Tag color="green">{phone}</Tag> },
      { title: "留言", dataIndex: "message", ellipsis: true },
      { title: "提交时间", dataIndex: "createdAt", width: 190 },
      { title: "操作", key: "actions", width: 150, render: (_value, item: Message) => <Space><Button size="small" onClick={() => setSelected(item)}>查看</Button><Popconfirm title="确认删除这条客户留言？" okText="删除" cancelText="取消" onConfirm={() => deleteMessage(item)}><Button size="small" danger loading={pending}>删除</Button></Popconfirm></Space> },
    ]} />
    <Modal title="客户留言详情" open={Boolean(selected)} onCancel={() => setSelected(undefined)} footer={<Button onClick={() => setSelected(undefined)}>关闭</Button>} width={720}>
      {selected ? <Descriptions bordered column={1}><Descriptions.Item label="姓名">{selected.name}</Descriptions.Item><Descriptions.Item label="邮箱"><a href={`mailto:${selected.email}`}>{selected.email}</a></Descriptions.Item><Descriptions.Item label="WhatsApp">{selected.whatsapp}</Descriptions.Item><Descriptions.Item label="提交时间">{selected.createdAt}</Descriptions.Item><Descriptions.Item label="留言"><Typography.Paragraph style={{ whiteSpace: "pre-wrap", margin: 0 }}>{selected.message}</Typography.Paragraph></Descriptions.Item></Descriptions> : null}
    </Modal>
  </>;
}
