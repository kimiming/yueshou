import { describe, expect, it, vi } from "vitest";

import {
  InquiryAttachmentAuthorizationError,
  completeInquiryAttachmentUpload,
  createInquiryAttachmentUpload,
  getInquiryAttachmentDownload,
  type InquiryAttachmentRepository,
} from "@/features/inquiries/attachments";
import { createSubmitInquiry, type InquiryRepository } from "@/features/inquiries/service";
import {
  MAX_INQUIRY_ATTACHMENT_BYTES,
  createInquiryAttachmentKey,
  inquirySchema,
} from "@/features/inquiries/schemas";
import {
  DeterministicRateLimitAdapter,
  applyInquiryRateLimits,
  hashRateLimitIdentity,
} from "@/features/inquiries/rate-limit";
import type { ObjectStorage } from "@/lib/storage";

const validFields = {
  company: "Research Institute",
  contact: "Ada Lovelace",
  email: "ada@research.example",
  country: "GB",
  details: "Please quote a custom peptide synthesis project.",
  gdprConsent: "on",
};

function formData(fields: Record<string, string> = validFields) {
  const data = new FormData();
  for (const [key, value] of Object.entries(fields)) data.set(key, value);
  return data;
}

describe("inquiry validation", () => {
  it.each([
    ["company", ""],
    ["contact", ""],
    ["email", "person@localhost"],
    ["country", ""],
    ["details", ""],
    ["gdprConsent", ""],
  ])("rejects an invalid %s field", (field, value) => {
    expect(inquirySchema.safeParse({ ...validFields, [field]: value }).success).toBe(false);
  });

  it("accepts a syntactically valid email without a free-provider blacklist", () => {
    expect(inquirySchema.safeParse({ ...validFields, email: "scientist@gmail.com" }).success).toBe(true);
  });
});

describe("inquiry submission", () => {
  it("creates the inquiry and explicit consent in one repository transaction", async () => {
    const repository: InquiryRepository = {
      createInquiryWithConsent: vi.fn(async () => ({ id: "inquiry-1" })),
    };
    const submit = createSubmitInquiry({
      repository,
      rateLimit: new DeterministicRateLimitAdapter(),
      requestContext: async () => ({ ip: "203.0.113.10", userAgent: "test browser" }),
      secret: "a sufficiently long private keyed hashing secret",
      now: () => new Date("2026-08-08T02:00:00.000Z"),
    });

    await expect(submit(undefined, formData())).resolves.toEqual({ status: "success", inquiryId: "inquiry-1", fields: {} });
    expect(repository.createInquiryWithConsent).toHaveBeenCalledWith(expect.objectContaining({
      inquiry: expect.objectContaining({ companyName: "Research Institute", email: "ada@research.example" }),
      consent: expect.objectContaining({ policyVersion: expect.any(String), categories: { inquiry: true } }),
    }));
    const write = vi.mocked(repository.createInquiryWithConsent).mock.calls[0][0];
    expect(JSON.stringify(write.consent.evidence)).not.toContain("203.0.113.10");
    expect(JSON.stringify(write.consent.evidence)).not.toContain("custom peptide synthesis");
  });

  it("preserves only safe fields when validation fails", async () => {
    const submit = createSubmitInquiry({
      repository: { createInquiryWithConsent: vi.fn() },
      rateLimit: new DeterministicRateLimitAdapter(),
      requestContext: async () => ({ ip: "203.0.113.10", userAgent: "test" }),
      secret: "a sufficiently long private keyed hashing secret",
    });
    const data = formData({ ...validFields, company: "", gdprConsent: "" });
    data.set("attachmentIntent", "private-token");

    const result = await submit(undefined, data);
    expect(result.status).toBe("validation_error");
    expect(result.fields).toMatchObject({ contact: "Ada Lovelace", email: "ada@research.example" });
    expect(JSON.stringify(result)).not.toContain("private-token");
  });
});

describe("persistent rate limit contract", () => {
  it("uses keyed hashes and deterministically blocks both IP and normalized email keys", async () => {
    const adapter = new DeterministicRateLimitAdapter();
    const now = new Date("2026-08-08T02:00:00.000Z");
    const secret = "a sufficiently long private keyed hashing secret";
    expect(hashRateLimitIdentity("ip", "203.0.113.10", secret)).not.toContain("203.0.113.10");

    for (let index = 0; index < 3; index += 1) {
      await expect(applyInquiryRateLimits(adapter, { ip: "203.0.113.10", email: "ADA@Research.Example", now, secret })).resolves.toBeUndefined();
    }
    await expect(applyInquiryRateLimits(adapter, { ip: "203.0.113.10", email: "ada@research.example", now, secret })).rejects.toMatchObject({ code: "inquiry_rate_limited" });
  });
});

describe("private inquiry attachments", () => {
  const upload = { name: "requirements.pdf", type: "application/pdf" as const, size: 1_024 };
  const key = "inquiry/2026/08/123e4567-e89b-42d3-a456-426614174000.pdf";

  it("accepts the allowlist and 15 MB boundary and creates a private dated key", () => {
    expect(createInquiryAttachmentKey(upload, new Date("2026-08-08T00:00:00Z"), () => "123e4567-e89b-42d3-a456-426614174000")).toBe(key);
    expect(() => createInquiryAttachmentKey({ ...upload, size: MAX_INQUIRY_ATTACHMENT_BYTES + 1 })).toThrow();
    expect(() => createInquiryAttachmentKey({ name: "payload.exe", type: "application/octet-stream", size: 1 } as never)).toThrow();
  });

  it("binds upload intent to inquiry, session, actor, metadata and expiry, then consumes once", async () => {
    const intent = {
      id: "intent-1", inquiryId: "inquiry-token", storageKey: key, inquiryTokenHash: "inquiry-hash", sessionHash: "session-hash", actorHash: "actor-hash",
      filename: upload.name, mimeType: upload.type, extension: "pdf", sizeBytes: upload.size,
      expiresAt: new Date("2026-08-08T00:15:00Z"), consumedAt: null,
    };
    let storedIntent = intent;
    const repository: InquiryAttachmentRepository = {
      createUploadIntent: vi.fn(async (input) => {
        storedIntent = { ...intent, ...input };
        return storedIntent;
      }),
      findUploadIntent: vi.fn(async () => storedIntent),
      consumeUploadIntent: vi.fn(async () => ({ id: "attachment-1", storageKey: key })),
    };
    const storage: ObjectStorage = {
      presignUpload: vi.fn(async () => ({ url: "https://upload.example/signed", method: "PUT" as const, headers: { "content-type": upload.type } })),
      headObject: vi.fn(async () => ({ contentType: upload.type, contentLength: upload.size, etag: "etag" })),
      deleteObject: vi.fn(),
    };
    const dependencies = { repository, storage, secret: "a sufficiently long private keyed hashing secret", now: () => new Date("2026-08-08T00:00:00Z"), uuid: () => "123e4567-e89b-42d3-a456-426614174000" };
    const binding = { inquiryId: "inquiry-token", inquiryToken: "inquiry-capability", sessionToken: "session-token", actorToken: "actor-token" };

    await expect(createInquiryAttachmentUpload(dependencies, { binding, upload })).resolves.toEqual({ key, url: "https://upload.example/signed", method: "PUT", headers: { "content-type": upload.type } });
    await expect(completeInquiryAttachmentUpload({ ...dependencies, now: () => new Date("2026-08-08T00:01:00Z") }, { binding, key, upload })).resolves.toEqual({ id: "attachment-1", storageKey: key });
    expect(repository.consumeUploadIntent).toHaveBeenCalledTimes(1);
  });

  it("fails closed for attachment downloads until staff authorization wiring exists", async () => {
    await expect(getInquiryAttachmentDownload({ actor: null, attachmentId: "attachment-1" })).rejects.toBeInstanceOf(InquiryAttachmentAuthorizationError);
  });
});
