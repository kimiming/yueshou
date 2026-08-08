"use server";

import { headers } from "next/headers";

import { createObjectStorage } from "@/lib/storage";
import { parseEnv } from "@/lib/env";
import { completeInquiryAttachmentUpload, createInquiryAttachmentUpload, type InquiryAttachmentBinding } from "./attachments";
import { PrismaInquiryRateLimitAdapter, prismaInquiryAttachmentRepository, prismaInquiryRepository, prismaUploadSessionRepository } from "./repository";
import { createSubmitInquiry, type InquiryActionState } from "./service";
import { resolveClientIp } from "./request-context";
import { inquirySchema, type InquiryAttachmentInput } from "./schemas";
import { applyInquiryRateLimits } from "./rate-limit";
import { createUploadSession } from "./upload-session";

export type { InquiryActionState } from "./service";

async function getRequestContext(mode: "vercel" | "nginx" | "direct") {
  const requestHeaders = await headers();
  return {
    ip: resolveClientIp(mode, { "x-vercel-forwarded-for": requestHeaders.get("x-vercel-forwarded-for") ?? undefined, "x-real-ip": requestHeaders.get("x-real-ip") ?? undefined }),
    userAgent: requestHeaders.get("user-agent") || "unavailable",
  };
}

function runtime() {
  const env = parseEnv(process.env);
  return { env, storage: createObjectStorage(env, env.STORAGE_BACKEND) };
}

function attachmentErrorCode(error: unknown) {
  if (error && typeof error === "object" && "code" in error) return String(error.code);
  if (error instanceof Error && ["inquiry_error_attachment_count", "inquiry_error_attachment_bytes", "inquiry_upload_session_invalid"].includes(error.message)) return error.message;
  return "inquiry_error_attachment";
}

export async function beginInquiryAttachmentUpload(binding: InquiryAttachmentBinding, upload: InquiryAttachmentInput) {
  try {
    const { env, storage } = runtime();
    return { ok: true as const, value: await createInquiryAttachmentUpload({ repository: prismaInquiryAttachmentRepository, sessions: prismaUploadSessionRepository, storage, secret: env.INQUIRY_HASH_SECRET }, { binding, upload }) };
  } catch (error) { return { ok: false as const, code: attachmentErrorCode(error) }; }
}

export async function finalizeInquiryAttachmentUpload(binding: InquiryAttachmentBinding, key: string, upload: InquiryAttachmentInput) {
  try {
    const { env, storage } = runtime();
    const result = await completeInquiryAttachmentUpload({ repository: prismaInquiryAttachmentRepository, sessions: prismaUploadSessionRepository, storage, secret: env.INQUIRY_HASH_SECRET }, { binding, key, upload });
    return { ok: true as const, value: { token: result.token } };
  } catch (error) {
    return { ok: false as const, code: attachmentErrorCode(error) };
  }
}

export async function prepareInquirySubmission(formData: FormData) {
  const env = parseEnv(process.env); const request = await getRequestContext(env.INQUIRY_PROXY_MODE);
  const value = Object.fromEntries(["company", "contact", "email", "country", "details", "gdprConsent"].map((key) => [key, formData.get(key)]));
  const parsed = inquirySchema.safeParse(value);
  if (!parsed.success) return { ok: false as const, code: "inquiry_error_validation" };
  try {
    await applyInquiryRateLimits(new PrismaInquiryRateLimitAdapter(), { ip: request.ip, email: parsed.data.email, now: new Date(), secret: env.INQUIRY_HASH_SECRET });
    const capability = await createUploadSession({ repository: prismaUploadSessionRepository, secret: env.INQUIRY_HASH_SECRET }, { email: parsed.data.email, ip: request.ip });
    return { ok: true as const, value: { ...capability, email: parsed.data.email } };
  } catch { return { ok: false as const, code: "inquiry_error_rate_limited" }; }
}

export async function submitInquiry(
  previousState: InquiryActionState,
  formData: FormData,
): Promise<Exclude<InquiryActionState, undefined>> {
  const env = parseEnv(process.env);
  return createSubmitInquiry({
    repository: prismaInquiryRepository,
    rateLimit: new PrismaInquiryRateLimitAdapter(),
    requestContext: () => getRequestContext(env.INQUIRY_PROXY_MODE),
    secret: env.INQUIRY_HASH_SECRET,
    requirePreparedSession: true,
  })(previousState, formData);
}
