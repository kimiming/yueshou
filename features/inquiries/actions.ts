"use server";

import { headers } from "next/headers";

import { PrismaInquiryRateLimitAdapter, prismaInquiryRepository } from "./repository";
import { createSubmitInquiry, type InquiryActionState } from "./service";

export type { InquiryActionState } from "./service";

async function getRequestContext() {
  const requestHeaders = await headers();
  const forwarded = requestHeaders.get("x-forwarded-for")?.split(",").at(-1)?.trim();
  return {
    ip: forwarded || requestHeaders.get("x-real-ip") || "unavailable",
    userAgent: requestHeaders.get("user-agent") || "unavailable",
  };
}

export async function submitInquiry(
  previousState: InquiryActionState,
  formData: FormData,
): Promise<Exclude<InquiryActionState, undefined>> {
  return createSubmitInquiry({
    repository: prismaInquiryRepository,
    rateLimit: new PrismaInquiryRateLimitAdapter(),
    requestContext: getRequestContext,
    secret: process.env.AUTH_SECRET ?? "",
  })(previousState, formData);
}
