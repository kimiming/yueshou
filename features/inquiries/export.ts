import type { InquiryStatus } from "@prisma/client";

export type InquiryExportRow = { id: string; companyName: string; contactName: string; email: string; country: string | null; message: string; status: InquiryStatus; createdAt: Date };
export type InquiryExportFilters = { status?: InquiryStatus; from?: Date; to?: Date };
export type InquiryExportRepository = { streamRows(filters: InquiryExportFilters): AsyncIterable<InquiryExportRow> };

export function escapeCsvCell(value: string): string { const formulaSafe = /^[=+\-@]/.test(value) ? `'${value}` : value; return /[",\r\n]/.test(formulaSafe) ? `"${formulaSafe.replaceAll('"', '""')}"` : formulaSafe; }
export async function exportInquiriesCsv(filters: InquiryExportFilters, actor: { id: string; role: "ADMIN" | "EDITOR" }, repository?: InquiryExportRepository): Promise<ReadableStream<Uint8Array>> { if (!actor?.id || !repository) throw new Error("Authorized inquiry export repository is required"); const encoder = new TextEncoder(); const rows = repository.streamRows(filters); return new ReadableStream({ async start(controller) { controller.enqueue(encoder.encode("ID,Company,Contact,Email,Country,Message,Status,Created at\r\n")); for await (const row of rows) controller.enqueue(encoder.encode([row.id, row.companyName, row.contactName, row.email, row.country ?? "", row.message, row.status, row.createdAt.toISOString()].map(escapeCsvCell).join(",") + "\r\n")); controller.close(); } }); }
