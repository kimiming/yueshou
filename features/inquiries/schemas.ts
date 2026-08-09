import { randomUUID } from "node:crypto";

import { z } from "zod";

export const INQUIRY_POLICY_VERSION = "2026-08-08";
export const MAX_INQUIRY_ATTACHMENT_BYTES = 15 * 1024 * 1024;

const institutionalEmailSchema = z.string().trim().toLowerCase().email().max(254).refine((value) => {
  const domain = value.slice(value.lastIndexOf("@") + 1);
  return domain.includes(".") && !domain.startsWith(".") && !domain.endsWith(".");
}, "Enter an email with a fully qualified domain");

export const inquirySchema = z.object({
  company: z.string().trim().min(2).max(200),
  contact: z.string().trim().min(2).max(200),
  email: institutionalEmailSchema,
  country: z.string().trim().min(2).max(100),
  details: z.string().trim().min(10).max(10_000),
  gdprConsent: z.literal("on", { error: "Consent is required" }),
});

export type InquiryInput = z.infer<typeof inquirySchema>;

const extensionsByContentType = {
  "application/pdf": ["pdf"],
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": ["docx"],
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": ["xlsx"],
  "text/csv": ["csv"],
  "text/plain": ["txt"],
} as const;

export const inquiryAttachmentSchema = z.object({
  name: z.string().trim().min(1).max(255),
  type: z.enum([
    "application/pdf",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    "text/csv",
    "text/plain",
  ]),
  size: z.number().int().positive().max(MAX_INQUIRY_ATTACHMENT_BYTES),
}).superRefine((value, context) => {
  const extension = getInquiryAttachmentExtension(value.name);
  if (!(extensionsByContentType[value.type] as readonly string[]).includes(extension)) {
    context.addIssue({ code: "custom", path: ["name"], message: "File extension does not match content type" });
  }
});

export type InquiryAttachmentInput = z.infer<typeof inquiryAttachmentSchema>;

export function getInquiryAttachmentExtension(filenameOrKey: string): string {
  return filenameOrKey.split(".").pop()?.toLowerCase() ?? "";
}

export const inquiryAttachmentKeySchema = z.string().regex(
  /^inquiry\/(?:tmp\/)?\d{4}\/(?:0[1-9]|1[0-2])\/[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\.(?:pdf|docx|xlsx|csv|txt)$/i,
  "Invalid private inquiry attachment key",
);

export function createInquiryAttachmentKey(
  input: InquiryAttachmentInput,
  now = new Date(),
  uuid: () => string = randomUUID,
): string {
  const upload = inquiryAttachmentSchema.parse(input);
  const year = now.getUTCFullYear();
  const month = String(now.getUTCMonth() + 1).padStart(2, "0");
  return `inquiry/tmp/${year}/${month}/${uuid()}.${getInquiryAttachmentExtension(upload.name)}`;
}
