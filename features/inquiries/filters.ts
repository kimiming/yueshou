import type { Prisma } from "@prisma/client";
import { z } from "zod";

export const inquiryFilterSchema = z.object({
  q: z.string().trim().max(100).optional(),
  status: z.enum(["NEW", "IN_PROGRESS", "RESOLVED", "ARCHIVED"]).optional(),
  start: z.string().date().optional(),
  end: z.string().date().optional(),
}).superRefine((value, context) => {
  if (value.start && value.end && value.start > value.end) context.addIssue({ code: "custom", message: "start must not be after end" });
});

export type InquiryFilters = z.infer<typeof inquiryFilterSchema>;

export function inquiryWhere(filters: InquiryFilters): Prisma.InquiryWhereInput {
  const start = filters.start ? new Date(`${filters.start}T00:00:00.000Z`) : undefined;
  const endExclusive = filters.end ? new Date(`${filters.end}T00:00:00.000Z`) : undefined;
  if (endExclusive) endExclusive.setUTCDate(endExclusive.getUTCDate() + 1);
  return {
    ...(filters.status ? { status: filters.status } : {}),
    ...(start || endExclusive ? { createdAt: { ...(start ? { gte: start } : {}), ...(endExclusive ? { lt: endExclusive } : {}) } } : {}),
    ...(filters.q ? { OR: [{ companyName: { contains: filters.q, mode: "insensitive" } }, { contactName: { contains: filters.q, mode: "insensitive" } }, { email: { contains: filters.q, mode: "insensitive" } }] } : {}),
  };
}
