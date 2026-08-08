"use server";

import { headers } from "next/headers";

import { createObjectStorage } from "@/lib/storage";
import { parseEnv } from "@/lib/env";
import { completeInquiryAttachmentUpload, createInquiryAttachmentUpload, type InquiryAttachmentBinding } from "./attachments";
import { PrismaInquiryRateLimitAdapter, prismaInquiryAttachmentRepository, prismaInquiryRepository } from "./repository";
import { createSubmitInquiry, type InquiryActionState } from "./service";
import { resolveClientIp } from "./request-context";
import type { InquiryAttachmentInput } from "./schemas";

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

export async function beginInquiryAttachmentUpload(binding: InquiryAttachmentBinding, upload: InquiryAttachmentInput) {
  try {
    const { env, storage } = runtime();
    return { ok: true as const, value: await createInquiryAttachmentUpload({ repository: prismaInquiryAttachmentRepository, storage, secret: env.INQUIRY_HASH_SECRET }, { binding, upload }) };
  } catch { return { ok: false as const, code: "inquiry_error_attachment" }; }
}

export async function finalizeInquiryAttachmentUpload(binding: InquiryAttachmentBinding, key: string, upload: InquiryAttachmentInput) {
  try {
    const { env, storage } = runtime();
    const result = await completeInquiryAttachmentUpload({ repository: prismaInquiryAttachmentRepository, storage, secret: env.INQUIRY_HASH_SECRET }, { binding, key, upload });
    return { ok: true as const, value: { token: result.token } };
  } catch (error) {
    const code = error && typeof error === "object" && "code" in error ? String(error.code) : "inquiry_error_attachment";
    return { ok: false as const, code };
  }
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
  })(previousState, formData);
}
