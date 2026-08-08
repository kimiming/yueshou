import { describe, expect, it } from "vitest";

import { escapeCsvCell } from "@/features/inquiries/export";
import { createInquiryAdminService } from "@/features/admin/inquiries";
import { createUserAdminService } from "@/features/admin/users";

describe("inquiry administration", () => {
  it("allows only defined forward inquiry status transitions", async () => {
    const service = createInquiryAdminService({
      repository: { getStatus: async () => "NEW", updateStatus: async () => undefined },
    });

    await expect(service.changeStatus({ actor: { id: "editor-1", role: "EDITOR" }, inquiryId: "inq-1", status: "RESOLVED" }))
      .rejects.toThrow("transition");
  });

  it("prefixes CSV formula cells without changing ordinary values", () => {
    expect(escapeCsvCell("=SUM(A1:A2)")).toBe("'=SUM(A1:A2)");
    expect(escapeCsvCell("Peptide inquiry")).toBe("Peptide inquiry");
  });

  it("allows only administrators to manage users", async () => {
    const service = createUserAdminService({
      repository: { createUser: async () => ({ id: "user-1" }) },
    });

    await expect(service.create({ actor: { id: "editor-1", role: "EDITOR" }, email: "new@example.com", password: "a strong password", role: "EDITOR" }))
      .rejects.toThrow("Administrator");
  });
});
