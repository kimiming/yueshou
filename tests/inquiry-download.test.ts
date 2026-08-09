import { describe, expect, it, vi } from "vitest";

import {
  InquiryAttachmentAuthorizationError,
  InquiryAttachmentError,
  getInquiryAttachmentDownload,
  type InquiryAttachmentDownloadRecord,
  type InquiryAttachmentDownloadRepository,
} from "@/features/inquiries/attachments";
import type { PrivateDownloadStorage } from "@/lib/storage";
import { createInquiryAttachmentDownloadHandler } from "@/features/inquiries/download-route";

const attachment = {
  id: "attachment-1",
  inquiryId: "inquiry-1",
  storageKey: "inquiry/final/abc123.pdf",
  filename: "synthesis brief.pdf",
  mimeType: "application/pdf",
  sizeBytes: 1024,
  inquiryStatus: "NEW" as const,
};

function dependencies(record: InquiryAttachmentDownloadRecord | null = attachment) {
  const repository: InquiryAttachmentDownloadRepository = {
    findAttachmentForDownload: vi.fn(async () => record),
    auditAttachmentDownload: vi.fn(async () => undefined),
  };
  const storage: PrivateDownloadStorage = {
    headObject: vi.fn(async () => ({ contentType: attachment.mimeType, contentLength: attachment.sizeBytes, etag: '"etag"' })),
    presignDownload: vi.fn(async () => ({
      url: "https://objects.example.test/signed-download",
      expiresAt: new Date("2026-08-08T10:05:00.000Z"),
    })),
  };
  return { repository, storage, now: () => new Date("2026-08-08T10:00:00.000Z") };
}

describe("private inquiry attachment downloads", () => {
  it.each(["ADMIN", "EDITOR"] as const)("allows an authenticated %s and audits signed access", async (role) => {
    const deps = dependencies();

    await expect(getInquiryAttachmentDownload(deps, {
      actor: { id: "staff-1", role },
      attachmentId: attachment.id,
    })).resolves.toEqual({
      url: "https://objects.example.test/signed-download",
      expiresAt: new Date("2026-08-08T10:05:00.000Z"),
    });
    expect(deps.storage.presignDownload).toHaveBeenCalledWith({
      key: attachment.storageKey,
      filename: attachment.filename,
      expiresIn: 300,
    });
    expect(deps.repository.auditAttachmentDownload).toHaveBeenCalledWith({
      actorId: "staff-1",
      attachmentId: attachment.id,
      inquiryId: attachment.inquiryId,
      accessedAt: new Date("2026-08-08T10:00:00.000Z"),
    });
  });

  it("rejects unauthenticated access before looking up private metadata", async () => {
    const deps = dependencies();

    await expect(getInquiryAttachmentDownload(deps, {
      actor: null,
      attachmentId: attachment.id,
    })).rejects.toBeInstanceOf(InquiryAttachmentAuthorizationError);
    expect(deps.repository.findAttachmentForDownload).not.toHaveBeenCalled();
  });

  it.each([null, { ...attachment, inquiryStatus: "ARCHIVED" as const }])(
    "fails closed for a missing, deleted, or archived record",
    async (record) => {
      const deps = dependencies(record);
      await expect(getInquiryAttachmentDownload(deps, {
        actor: { id: "staff-1", role: "EDITOR" },
        attachmentId: attachment.id,
      })).rejects.toMatchObject({ code: "inquiry_attachment_unavailable" });
      expect(deps.storage.presignDownload).not.toHaveBeenCalled();
    },
  );

  it("fails closed and does not audit when the private object is missing", async () => {
    const deps = dependencies();
    vi.mocked(deps.storage.headObject).mockRejectedValueOnce(new Error("NoSuchKey"));

    await expect(getInquiryAttachmentDownload(deps, {
      actor: { id: "staff-1", role: "ADMIN" },
      attachmentId: attachment.id,
    })).rejects.toBeInstanceOf(InquiryAttachmentError);
    expect(deps.storage.presignDownload).not.toHaveBeenCalled();
    expect(deps.repository.auditAttachmentDownload).not.toHaveBeenCalled();
  });
});

describe("private download route", () => {
  it("returns 401 without a freshly authorized staff session", async () => {
    const handler = createInquiryAttachmentDownloadHandler({
      authorize: async () => null,
      getDownload: vi.fn(),
    });

    const response = await handler(new Request("https://cms.example.test/api/admin/inquiries/attachments/attachment-1/download"), {
      params: Promise.resolve({ id: "attachment-1" }),
    });
    expect(response.status).toBe(401);
  });

  it("redirects staff only to the time-limited signed URL", async () => {
    const handler = createInquiryAttachmentDownloadHandler({
      authorize: async () => ({ id: "editor-1", role: "EDITOR" }),
      getDownload: async () => ({ url: "https://objects.example.test/signed-download", expiresAt: new Date("2026-08-08T10:05:00.000Z") }),
    });

    const response = await handler(new Request("https://cms.example.test/api/admin/inquiries/attachments/attachment-1/download"), {
      params: Promise.resolve({ id: "attachment-1" }),
    });
    expect(response.status).toBe(302);
    expect(response.headers.get("location")).toBe("https://objects.example.test/signed-download");
    expect(response.headers.get("cache-control")).toBe("no-store");
  });
});
