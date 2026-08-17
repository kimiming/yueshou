"use server";

import { createHmac } from "node:crypto";
import { headers } from "next/headers";
import { z } from "zod";

import { PrismaInquiryRateLimitAdapter } from "@/features/inquiries/repository";
import { applyInquiryRateLimits, InquiryRateLimitError } from "@/features/inquiries/rate-limit";
import { resolveClientIp } from "@/features/inquiries/request-context";
import { INQUIRY_POLICY_VERSION } from "@/features/inquiries/schemas";
import { parseEnv } from "@/lib/env";
import { prisma } from "@/lib/db/prisma";

const messageSchema = z.object({
  name: z.string().trim().min(2, "请输入您的姓名").max(200),
  email: z.string().trim().toLowerCase().email("请输入有效邮箱").max(254),
  whatsapp: z.string().trim().max(60).optional().transform((value) => value || undefined),
  message: z.string().trim().max(10_000).optional().transform((value) => value || undefined),
});

function digest(secret: string, namespace: string, value: string) {
  return createHmac("sha256", secret).update(`${namespace}:${value}`).digest("hex");
}

export async function submitContactMessageAction(input: unknown) {
  const data = messageSchema.parse(input);
  const env = parseEnv(process.env);
  const requestHeaders = await headers();
  const ip = resolveClientIp(env.INQUIRY_PROXY_MODE, {
    "x-vercel-forwarded-for": requestHeaders.get("x-vercel-forwarded-for") ?? undefined,
    "x-real-ip": requestHeaders.get("x-real-ip") ?? undefined,
  });
  const now = new Date();
  try {
    await applyInquiryRateLimits(new PrismaInquiryRateLimitAdapter(), { ip, email: data.email, now, secret: env.INQUIRY_HASH_SECRET });
  } catch (error) {
    if (error instanceof InquiryRateLimitError) throw new Error("提交过于频繁，请稍后再试");
    throw error;
  }
  const inquiry = await prisma.inquiry.create({
    data: {
      companyName: "Website contact",
      contactName: data.name,
      email: data.email,
      whatsapp: data.whatsapp,
      message: data.message ?? "",
      source: "CONTACT_MESSAGE",
      consentRecords: { create: {
        subject: data.email,
        categories: { inquiry: true },
        policyVersion: INQUIRY_POLICY_VERSION,
        evidence: {
          explicit: true,
          ...(ip ? { requestKey: digest(env.INQUIRY_HASH_SECRET, "request", ip) } : {}),
          userAgentKey: digest(env.INQUIRY_HASH_SECRET, "user-agent", requestHeaders.get("user-agent") || "unavailable"),
          submittedAt: now.toISOString(),
        },
      } },
    },
    select: { id: true },
  });
  return { id: inquiry.id };
}
