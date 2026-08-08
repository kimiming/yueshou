import { exportInquiriesCsv } from "@/features/inquiries/export";
import { prismaInquiryExportRepository } from "@/features/admin/domain-repository";
import { requireRole } from "@/lib/auth/permissions";

export const runtime = "nodejs";
export async function GET(request: Request) {
  const actor = await requireRole("ADMIN", "EDITOR");
  const url = new URL(request.url); const status = url.searchParams.get("status"); const from = url.searchParams.get("from"); const to = url.searchParams.get("to");
  const validStatus = status === "NEW" || status === "IN_PROGRESS" || status === "RESOLVED" || status === "ARCHIVED" ? status : undefined;
  const validDate = (value: string | null) => value && !Number.isNaN(Date.parse(value)) ? new Date(value) : undefined;
  const stream = await exportInquiriesCsv({ status: validStatus, from: validDate(from), to: validDate(to) }, actor, prismaInquiryExportRepository);
  return new Response(stream, { headers: { "content-type": "text/csv; charset=utf-8", "content-disposition": 'attachment; filename="yueshou-inquiries.csv"', "cache-control": "no-store", "x-content-type-options": "nosniff" } });
}
