import { describe, expect, it, vi } from "vitest";

import {
  InquiryAttachmentAuthorizationError,
  completeInquiryAttachmentUpload,
  createInquiryAttachmentUpload,
  getInquiryAttachmentDownload,
  type InquiryAttachmentRepository,
} from "@/features/inquiries/attachments";
import { createSubmitInquiry, validateInquiryFormData, type InquiryRepository } from "@/features/inquiries/service";
import {
  MAX_INQUIRY_ATTACHMENT_BYTES,
  createInquiryAttachmentKey,
  inquiryAttachmentKeySchema,
  inquirySchema,
} from "@/features/inquiries/schemas";
import {
  DeterministicRateLimitAdapter,
  applyInquiryRateLimits,
  hashRateLimitIdentity,
} from "@/features/inquiries/rate-limit";
import {
  createUploadSession,
  DeterministicUploadSessionRepository,
} from "@/features/inquiries/upload-session";
import type { ObjectStorage, PrivateFinalizationStorage } from "@/lib/storage";

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

  it("returns the same structured safe validation state used by preflight and final submission", () => {
    const data = formData({ ...validFields, email: "invalid", details: "short", gdprConsent: "" });
    data.set("attachmentTokens", "private-token");

    expect(validateInquiryFormData(data)).toEqual({
      success: false,
      state: {
        status: "validation_error",
        fieldErrors: {
          email: ["inquiry_error_email"],
          details: ["inquiry_error_required"],
          gdprConsent: ["inquiry_error_required"],
        },
        fields: {
          company: "Research Institute",
          contact: "Ada Lovelace",
          email: "invalid",
          country: "GB",
          details: "short",
        },
      },
    });
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

  it("submits a prepared zero-file session without charging the admission limiter again", async () => {
    const repository: InquiryRepository = { createInquiryWithConsent: vi.fn(async () => ({ id: "inquiry-1" })) };
    const rateLimit = new DeterministicRateLimitAdapter();
    const consume = vi.spyOn(rateLimit, "consume");
    const submit = createSubmitInquiry({
      repository,
      rateLimit,
      requestContext: async () => ({ ip: "203.0.113.10", userAgent: "test" }),
      secret: "a sufficiently long private keyed hashing secret",
      now: () => new Date("2026-08-08T02:00:00.000Z"),
      requirePreparedSession: true,
    });
    const data = formData();
    data.set("uploadSessionId", "session-1");
    data.set("uploadSessionSecret", "server-secret");
    data.set("attachmentTokens", "[]");

    await expect(submit(undefined, data)).resolves.toMatchObject({ status: "success" });
    expect(consume).not.toHaveBeenCalled();
    expect(repository.createInquiryWithConsent).toHaveBeenCalledWith(expect.objectContaining({
      attachmentClaim: expect.objectContaining({ sessionId: "session-1", intentIds: [] }),
    }));
  });

  it("returns a stable attachment error when the prepared session was consumed", async () => {
    const submit = createSubmitInquiry({
      repository: { createInquiryWithConsent: vi.fn(async () => { throw new Error("inquiry_upload_session_invalid"); }) },
      rateLimit: new DeterministicRateLimitAdapter(),
      requestContext: async () => ({ userAgent: "test" }),
      secret: "a sufficiently long private keyed hashing secret",
      requirePreparedSession: true,
    });
    const data = formData();
    data.set("uploadSessionId", "session-1");
    data.set("uploadSessionSecret", "already-consumed");
    data.set("attachmentTokens", "[]");
    await expect(submit(undefined, data)).resolves.toMatchObject({
      status: "validation_error",
      fieldErrors: { attachments: ["inquiry_upload_session_invalid"] },
    });
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
  const upload = { name: "requirements.pdf", type: "application/pdf" as const, size: 8 };
  const key = "inquiry/tmp/2026/08/123e4567-e89b-42d3-a456-426614174000.pdf";

  it("accepts the allowlist and 15 MB boundary and creates a private dated key", () => {
    expect(createInquiryAttachmentKey(upload, new Date("2026-08-08T00:00:00Z"), () => "123e4567-e89b-42d3-a456-426614174000")).toBe(key);
    expect(inquiryAttachmentKeySchema.parse("inquiry/2026/08/123e4567-e89b-42d3-a456-426614174000.pdf"))
      .toBe("inquiry/2026/08/123e4567-e89b-42d3-a456-426614174000.pdf");
    expect(() => createInquiryAttachmentKey({ ...upload, size: MAX_INQUIRY_ATTACHMENT_BYTES + 1 })).toThrow();
    expect(() => createInquiryAttachmentKey({ name: "payload.exe", type: "application/octet-stream", size: 1 } as never)).toThrow();
  });

  it("binds upload intent to a server-issued session, metadata and expiry, then consumes once", async () => {
    const intent = {
      id: "intent-1", storageKey: key, uploadSessionId: "session-1",
      filename: upload.name, mimeType: upload.type, extension: "pdf", sizeBytes: upload.size,
      expiresAt: new Date("2026-08-08T00:15:00Z"), finalStorageKey: null, sha256: null, finalizedAt: null, consumedAt: null,
    };
    let storedIntent = intent;
    const finalizationOrder: string[] = [];
    const repository: InquiryAttachmentRepository = {
      createUploadIntent: vi.fn(async (input) => {
        storedIntent = { ...intent, ...input };
        return storedIntent;
      }),
      findUploadIntent: vi.fn(async () => storedIntent),
      reserveFinalStorageKey: vi.fn(async (input) => {
        finalizationOrder.push("reserve");
        storedIntent = { ...storedIntent, finalStorageKey: input.finalStorageKey, sha256: input.sha256 };
        return { id: "intent-1", finalStorageKey: input.finalStorageKey };
      }),
      finalizeUploadIntent: vi.fn(async (input) => {
        finalizationOrder.push("finalize");
        storedIntent = { ...storedIntent, finalStorageKey: input.finalStorageKey, sha256: input.sha256, finalizedAt: input.completedAt };
        return { id: "intent-1", finalStorageKey: input.finalStorageKey };
      }),
      queueTempObjectDeletion: vi.fn(async () => undefined),
      queueFinalObjectDeletion: vi.fn(async () => undefined),
    };
    const storage: ObjectStorage & PrivateFinalizationStorage = {
      presignUpload: vi.fn(async () => ({ url: "https://upload.example/signed", method: "PUT" as const, headers: { "content-type": upload.type } })),
      headObject: vi.fn(async () => ({ contentType: upload.type, contentLength: upload.size, etag: "etag" })),
      deleteObject: vi.fn(async () => { throw new Error("temporary delete failed"); }),
      readPrivateObject: vi.fn(async () => new TextEncoder().encode("%PDF-1.7")),
      putImmutableObject: vi.fn(async () => { finalizationOrder.push("put"); }),
    };
    const secret = "a sufficiently long private keyed hashing secret";
    const sessions = new DeterministicUploadSessionRepository();
    const capability = await createUploadSession(
      { repository: sessions, secret, now: () => new Date("2026-08-08T00:00:00Z"), randomSecret: () => "server-secret" },
      { email: "ada@research.example" },
    );
    const dependencies = { repository, sessions, storage, secret, now: () => new Date("2026-08-08T00:00:00Z"), uuid: () => "123e4567-e89b-42d3-a456-426614174000" };
    const binding = { ...capability, email: "ada@research.example" };

    await expect(createInquiryAttachmentUpload(dependencies, { binding, upload })).resolves.toEqual({ key, url: "https://upload.example/signed", method: "PUT", headers: { "content-type": upload.type } });
    storedIntent = { ...storedIntent, expiresAt: new Date("2026-08-08T00:00:30Z") };
    await expect(completeInquiryAttachmentUpload({ ...dependencies, now: () => new Date("2026-08-08T00:01:00Z") }, { binding, key, upload })).rejects.toMatchObject({ code: "inquiry_upload_intent_expired" });
    storedIntent = { ...storedIntent, expiresAt: new Date("2026-08-08T00:15:00Z") };
    await expect(completeInquiryAttachmentUpload({ ...dependencies, now: () => new Date("2026-08-08T00:01:00Z") }, { binding, key, upload })).resolves.toMatchObject({ token: "intent-1", storageKey: expect.stringMatching(/^inquiry\/final\/[a-f0-9]{64}\.pdf$/) });
    expect(finalizationOrder).toEqual(["reserve", "put", "finalize"]);
    expect(repository.queueTempObjectDeletion).toHaveBeenCalledWith(key);
    const immutableWrite = vi.mocked(storage.putImmutableObject).mock.calls[0][0];
    vi.mocked(storage.readPrivateObject).mockResolvedValue(new TextEncoder().encode("overwritten temp"));
    expect(new TextDecoder().decode(immutableWrite.body)).toBe("%PDF-1.7");
    await expect(completeInquiryAttachmentUpload({ ...dependencies, now: () => new Date("2026-08-08T00:02:00Z") }, { binding, key, upload })).rejects.toMatchObject({ code: "inquiry_upload_intent_consumed" });
    expect(repository.finalizeUploadIntent).toHaveBeenCalledTimes(1);

    storedIntent = { ...storedIntent, finalStorageKey: null, sha256: null, finalizedAt: null, consumedAt: null };
    vi.mocked(storage.readPrivateObject).mockResolvedValue(new TextEncoder().encode("%PDF-1.7"));
    vi.mocked(storage.putImmutableObject).mockRejectedValueOnce(new Error("final write failed"));
    await expect(completeInquiryAttachmentUpload({ ...dependencies, now: () => new Date("2026-08-08T00:03:00Z") }, { binding, key, upload }))
      .rejects.toThrow("final write failed");
    expect(repository.queueFinalObjectDeletion).toHaveBeenCalledWith(expect.stringMatching(/^inquiry\/final\/[a-f0-9]{64}\.pdf$/));
  });

  it("fails closed for attachment downloads until staff authorization wiring exists", async () => {
    await expect(getInquiryAttachmentDownload({ actor: null, attachmentId: "attachment-1" })).rejects.toBeInstanceOf(InquiryAttachmentAuthorizationError);
  });
});
