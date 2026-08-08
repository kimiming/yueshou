import { exportInquiriesCsv, inquiryExportFiltersSchema } from "@/features/inquiries/export";
import { prismaInquiryExportRepository } from "@/features/admin/domain-repository";
import { requireRole } from "@/lib/auth/permissions";

export const runtime = "nodejs";
export async function GET(request: Request) {
  const actor = await requireRole("ADMIN", "EDITOR");
  const url = new URL(request.url); const status = url.searchParams.get("status"); const from = url.searchParams.get("from") ?? url.searchParams.get("start"); const to = url.searchParams.get("to") ?? url.searchParams.get("end");
  const filters = inquiryExportFiltersSchema.safeParse({ ...(status ? { status } : {}), ...(from ? { from } : {}), ...(to ? { to } : {}) });
  if (!filters.success) return Response.json({ error: "Invalid export filters" }, { status: 400, headers: { "cache-control": "no-store" } });
  const stream = await exportInquiriesCsv(filters.data, actor, prismaInquiryExportRepository);
  return new Response(stream, { headers: { "content-type": "text/csv; charset=utf-8", "content-disposition": 'attachment; filename="yueshou-inquiries.csv"', "cache-control": "no-store", "x-content-type-options": "nosniff" } });
}
