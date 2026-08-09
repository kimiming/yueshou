import { describe, expect, it, vi } from "vitest";

import { escapeCsvCell } from "@/features/inquiries/export";
import { inquiryExportFiltersSchema } from "@/features/inquiries/export";
import { inquiryWhere } from "@/features/inquiries/filters";
import { createInquiryAdminService } from "@/features/admin/inquiries";
import { createPrismaInquiryAdminRepository } from "@/features/admin/domain-repository";
import { EditorConflictError } from "@/features/admin/editors";
import { createUserAdminService } from "@/features/admin/users";

describe("inquiry administration", () => {
  it("allows only defined forward inquiry status transitions", async () => {
    const service = createInquiryAdminService({
      repository: { getStatus: async () => ({ status: "NEW", version: "2026-08-08T00:00:00.000Z" }), updateStatus: async () => ({ version: "2026-08-08T00:00:01.000Z" }) },
    });

    await expect(service.changeStatus({ actor: { id: "editor-1", role: "EDITOR" }, inquiryId: "inq-1", version: "2026-08-08T00:00:00.000Z", status: "RESOLVED" }))
      .rejects.toThrow("transition");
  });

  it("uses the displayed inquiry version for note and status compare-and-swap", async () => {
    const updateStatus = vi.fn(async () => ({ version: "2026-08-08T00:00:01.000Z" }));
    const saveNotes = vi.fn(async () => ({ version: "2026-08-08T00:00:02.000Z" }));
    const service = createInquiryAdminService({
      repository: {
        getStatus: async () => ({ status: "NEW", version: "2026-08-08T00:00:00.000Z" }),
        updateStatus,
        saveNotes,
      },
    });
    const actor = { id: "editor-1", role: "EDITOR" as const };

    await expect(service.changeStatus({ actor, inquiryId: "inq-1", version: "2026-08-08T00:00:00.000Z", status: "IN_PROGRESS" }))
      .resolves.toEqual({ version: "2026-08-08T00:00:01.000Z" });
    await expect(service.saveNotes({ actor, inquiryId: "inq-1", version: "2026-08-08T00:00:01.000Z", internalNotes: "Reviewed" }))
      .resolves.toEqual({ version: "2026-08-08T00:00:02.000Z" });

    expect(updateStatus).toHaveBeenCalledWith(expect.objectContaining({ version: "2026-08-08T00:00:00.000Z" }));
    expect(saveNotes).toHaveBeenCalledWith(expect.objectContaining({ version: "2026-08-08T00:00:01.000Z" }));
  });

  it("reports a note compare-and-swap miss as an editor conflict", async () => {
    const service = createInquiryAdminService({
      repository: {
        getStatus: async () => ({ status: "NEW", version: "2026-08-08T00:00:00.000Z" }),
        updateStatus: async () => ({ version: "2026-08-08T00:00:01.000Z" }),
        saveNotes: async () => null,
      },
    });

    await expect(service.saveNotes({
      actor: { id: "editor-1", role: "EDITOR" },
      inquiryId: "inq-1",
      version: "2026-08-08T00:00:00.000Z",
      internalNotes: "Stale overwrite",
    })).rejects.toBeInstanceOf(EditorConflictError);
  });

  it("persists inquiry note CAS and its audit in one transaction", async () => {
    const tx = {
      inquiry: {
        updateMany: vi.fn(async () => ({ count: 1 })),
        findUniqueOrThrow: vi.fn(async () => ({ updatedAt: new Date("2026-08-08T00:00:01.000Z") })),
      },
      auditLog: { create: vi.fn(async () => ({ id: "audit-1" })) },
    };
    const database = { $transaction: vi.fn(async (callback: (client: typeof tx) => Promise<unknown>) => callback(tx)) };
    const repository = createPrismaInquiryAdminRepository(database as never);

    await expect(repository.saveNotes!({
      inquiryId: "inq-1",
      internalNotes: "Reviewed",
      version: "2026-08-08T00:00:00.000Z",
      actorId: "editor-1",
    })).resolves.toEqual({ version: "2026-08-08T00:00:01.000Z" });

    expect(tx.inquiry.updateMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: "inq-1", updatedAt: new Date("2026-08-08T00:00:00.000Z") },
    }));
    expect(tx.auditLog.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ action: "INQUIRY_NOTES_UPDATED" }) }));
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
