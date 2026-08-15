import { AdminPageTitle, Card } from "@/components/admin/antd-server-bridge";
import { CustomerMessageTable } from "@/components/admin/customer-message-table";
import { requireRole } from "@/lib/auth/permissions";
import { prisma } from "@/lib/db/prisma";

import { deleteCustomerMessageAction } from "./actions";

export default async function CustomerMessagesPage() {
  await requireRole("ADMIN");
  const messages = await prisma.inquiry.findMany({ where: { source: "CONTACT_MESSAGE" }, orderBy: { createdAt: "desc" }, take: 500 });
  return <main><AdminPageTitle level={1}>客户信息管理</AdminPageTitle><Card><CustomerMessageTable initialMessages={messages.map((item) => ({ id: item.id, name: item.contactName, email: item.email, whatsapp: item.whatsapp ?? "", message: item.message, createdAt: item.createdAt.toLocaleString("zh-CN"), version: item.updatedAt.toISOString() }))} remove={deleteCustomerMessageAction} /></Card></main>;
}
