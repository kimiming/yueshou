import { describe, expect, it } from "vitest";

import { escapeCsvCell } from "@/features/inquiries/export";
import { inquiryExportFiltersSchema } from "@/features/inquiries/export";
import { inquiryWhere } from "@/features/inquiries/filters";
import { createInquiryAdminService } from "@/features/admin/inquiries";
import { createUserAdminService } from "@/features/admin/users";

describe("inquiry administration", () => {
  it("allows only defined forward inquiry status transitions", async () => {
    const service = createInquiryAdminService({
      repository: { getStatus: async () => "NEW", updateStatus: async () => true },
    });

    await expect(service.changeStatus({ actor: { id: "editor-1", role: "EDITOR" }, inquiryId: "inq-1", status: "RESOLVED" }))
      .rejects.toThrow("transition");
  });

  it("prefixes CSV formula cells without changing ordinary values", () => {
    expect(escapeCsvCell("=SUM(A1:A2)")).toBe("'=SUM(A1:A2)");
    expect(escapeCsvCell("Peptide inquiry")).toBe("Peptide inquiry");
  });

  it("rejects invalid inquiry export filters", () => {
    expect(inquiryExportFiltersSchema.safeParse({ status: "INVALID" }).success).toBe(false);
    expect(inquiryExportFiltersSchema.safeParse({ start: "not-a-date" }).success).toBe(false);
  });

  it("shares inclusive date-only filters by using the next UTC day as the exclusive end", () => {
    const where = inquiryWhere({ q: "YueShou", status: "NEW", start: "2026-08-08", end: "2026-08-08" });
    expect(where.status).toBe("NEW");
    expect(where.createdAt).toEqual({ gte: new Date("2026-08-08T00:00:00.000Z"), lt: new Date("2026-08-09T00:00:00.000Z") });
    expect(where.OR).toContainEqual({ companyName: { contains: "YueShou", mode: "insensitive" } });
  });

  it("allows only administrators to manage users", async () => {
    const service = createUserAdminService({
      repository: { createUser: async () => ({ id: "user-1" }) },
    });

    await expect(service.create({ actor: { id: "editor-1", role: "EDITOR" }, email: "new@example.com", password: "a strong password", role: "EDITOR" }))
      .rejects.toThrow("Administrator");
  });
});
