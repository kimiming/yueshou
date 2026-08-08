import { zipSync, strToU8 } from "fflate";
import { describe, expect, it, vi } from "vitest";

import { validateAttachmentBytes } from "@/features/inquiries/attachment-signatures";
import { uploadInquiryFiles } from "@/features/inquiries/client-upload";
import { resolveClientIp } from "@/features/inquiries/request-context";
import { applyInquiryRateLimits, type RateLimitAdapter } from "@/features/inquiries/rate-limit";

describe("deployment-specific client IP", () => {
  it.each([
    ["vercel", { "x-vercel-forwarded-for": "2001:0db8:0:0:0:0:0:1", "x-real-ip": "198.51.100.7" }, "2001:db8::1"],
    ["nginx", { "x-real-ip": "203.0.113.8", "x-vercel-forwarded-for": "198.51.100.7" }, "203.0.113.8"],
    ["direct", { "x-real-ip": "203.0.113.8", "x-forwarded-for": "198.51.100.7" }, undefined],
    ["nginx", { "x-real-ip": "spoofed" }, undefined],
  ] as const)("uses only the %s trust contract", (mode, headers, expected) => {
    expect(resolveClientIp(mode, headers)).toBe(expected);
  });
});

it("omits the IP key when no trusted address exists but still limits email", async () => {
  const adapter: RateLimitAdapter = { consume: vi.fn(async () => true) };
  await applyInquiryRateLimits(adapter, { email: "Ada@Example.test", now: new Date("2026-08-08T00:00:00Z"), secret: "12345678901234567890123456789012" });
  expect(adapter.consume).toHaveBeenCalledTimes(1);
});

describe("attachment byte signatures", () => {
  it("accepts real PDF and UTF-8 text signatures", () => {
    expect(() => validateAttachmentBytes({ name: "x.pdf", type: "application/pdf", size: 8 }, new TextEncoder().encode("%PDF-1.7"))).not.toThrow();
    expect(() => validateAttachmentBytes({ name: "x.txt", type: "text/plain", size: 5 }, new TextEncoder().encode("hello"))).not.toThrow();
  });

  it("rejects metadata-only PDF and NUL text polyglots", () => {
    expect(() => validateAttachmentBytes({ name: "x.pdf", type: "application/pdf", size: 4 }, new Uint8Array([1, 2, 3, 4]))).toThrow("inquiry_attachment_signature");
    expect(() => validateAttachmentBytes({ name: "x.csv", type: "text/csv", size: 3 }, new Uint8Array([65, 0, 66]))).toThrow("inquiry_attachment_signature");
  });

  it("requires the correct OOXML structure", () => {
    const docx = zipSync({ "[Content_Types].xml": strToU8("<Types/>"), "word/document.xml": strToU8("<w:document/>") });
    const fake = zipSync({ "[Content_Types].xml": strToU8("<Types/>"), "xl/workbook.xml": strToU8("<workbook/>") });
    expect(() => validateAttachmentBytes({ name: "x.docx", type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document", size: docx.length }, docx)).not.toThrow();
    expect(() => validateAttachmentBytes({ name: "x.docx", type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document", size: fake.length }, fake)).toThrow("inquiry_attachment_signature");
  });
});

describe("quote attachment journey", () => {
  it("presigns, uploads, finalizes and returns only finalized tokens", async () => {
    const begin = vi.fn(async () => ({ key: "inquiry/temp.pdf", url: "https://upload.test", method: "PUT" as const, headers: { "content-type": "application/pdf" } }));
    const finalize = vi.fn(async () => ({ token: "final-token" }));
    const put = vi.fn(async () => new Response(null, { status: 200 }));
    const file = new File(["%PDF-1.7"], "request.pdf", { type: "application/pdf" });
    await expect(uploadInquiryFiles([file], { submissionToken: "s", sessionToken: "session", actorToken: "actor" }, { begin, finalize, fetch: put })).resolves.toEqual(["final-token"]);
    expect(put).toHaveBeenCalledWith("https://upload.test", expect.objectContaining({ method: "PUT", body: file }));
  });
});
