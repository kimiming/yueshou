import { Button, Card, Input, List, Space, Typography } from "antd";
import Link from "next/link";

import { InquiryStatusForm } from "@/components/admin/domain-forms";
import { requireUser } from "@/lib/auth/permissions";
import { prisma } from "@/lib/db/prisma";

import { changeInquiryStatusAction, saveInquiryNotesAction } from "./actions";

export default async function InquiriesPage({ searchParams }: { searchParams: Promise<{ q?: string; status?: "NEW" | "IN_PROGRESS" | "RESOLVED" | "ARCHIVED"; page?: string }> }) {
  await requireUser(); const query = await searchParams; const page = Math.min(1000, Math.max(1, Number(query.page ?? 1) || 1)); const q = query.q?.trim().slice(0, 100); const status = ["NEW", "IN_PROGRESS", "RESOLVED", "ARCHIVED"].includes(query.status ?? "") ? query.status : undefined;
  const inquiries = await prisma.inquiry.findMany({ where: { ...(status ? { status } : {}), ...(q ? { OR: [{ companyName: { contains: q, mode: "insensitive" } }, { contactName: { contains: q, mode: "insensitive" } }, { email: { contains: q, mode: "insensitive" } }] } : {}) }, include: { attachments: true }, orderBy: { createdAt: "desc" }, skip: (page - 1) * 50, take: 50 });
  return <main><Typography.Title level={1}>Inquiries</Typography.Title><Space><Button href="/api/admin/inquiries/export" target="_blank">Export CSV</Button></Space><Card><form><Space><Input name="q" defaultValue={q} placeholder="Search company, contact or email" aria-label="Search inquiries" /><select name="status" defaultValue={status ?? ""} aria-label="Inquiry status"><option value="">All statuses</option>{["NEW", "IN_PROGRESS", "RESOLVED", "ARCHIVED"].map((value) => <option key={value} value={value}>{value}</option>)}</select><Button htmlType="submit">Filter</Button></Space></form><p>Page {page}</p><List dataSource={inquiries} locale={{ emptyText: "No inquiries yet." }} renderItem={(item) => <List.Item><Card style={{ width: "100%" }} title={`${item.companyName} — ${item.contactName}`}><p><a href={`mailto:${item.email}`}>{item.email}</a>{item.country ? ` · ${item.country}` : ""}</p><p>{item.message}</p>{item.attachments.length ? <p>Private attachments: {item.attachments.map((attachment) => <Link key={attachment.id} href={`/api/admin/inquiries/attachments/${attachment.id}/download`}>{attachment.filename} </Link>)}</p> : null}<InquiryStatusForm inquiryId={item.id} status={item.status} notes={item.internalNotes} update={changeInquiryStatusAction} saveNotes={saveInquiryNotesAction} /></Card></List.Item>} /></Card></main>;
}
