import { Button, Card, List, Space, Typography } from "antd";
import Link from "next/link";
import { InquiryStatusForm } from "@/components/admin/domain-forms";
import { requireUser } from "@/lib/auth/permissions";
import { prisma } from "@/lib/db/prisma";
import { changeInquiryStatusAction } from "./actions";
export default async function InquiriesPage() { await requireUser(); const inquiries = await prisma.inquiry.findMany({ include: { attachments: true }, orderBy: { createdAt: "desc" }, take: 100 }); return <main><Typography.Title level={1}>Inquiries</Typography.Title><Space><Button href="/api/admin/inquiries/export" target="_blank">Export CSV</Button></Space><List dataSource={inquiries} locale={{ emptyText: "No inquiries yet." }} renderItem={(item) => <List.Item><Card style={{ width: "100%" }} title={`${item.companyName} — ${item.contactName}`}><p><a href={`mailto:${item.email}`}>{item.email}</a>{item.country ? ` · ${item.country}` : ""}</p><p>{item.message}</p>{item.attachments.length ? <p>Private attachments: {item.attachments.map((attachment) => <Link key={attachment.id} href={`/api/admin/inquiries/attachments/${attachment.id}/download`}>{attachment.filename} </Link>)}</p> : null}<InquiryStatusForm inquiryId={item.id} status={item.status} notes={item.internalNotes} update={changeInquiryStatusAction} /></Card></List.Item>} /></main>; }
