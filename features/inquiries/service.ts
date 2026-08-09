import { createHmac } from "node:crypto";

import { inquirySchema, INQUIRY_POLICY_VERSION, type InquiryInput } from "./schemas";
import { applyInquiryRateLimits, InquiryRateLimitError, type RateLimitAdapter } from "./rate-limit";
import { uploadDigest } from "./upload-session";

export type InquiryWrite = {
  inquiry: { companyName: string; contactName: string; email: string; country: string; message: string };
  consent: {
    subject: string;
    categories: { inquiry: true };
    policyVersion: string;
    evidence: { explicit: true; requestKey?: string; userAgentKey: string; submittedAt: string };
  };
  attachmentClaim?: { intentIds: string[]; sessionId: string; secretDigest: string; emailDigest: string; claimedAt: Date };
};

export interface InquiryRepository {
  createInquiryWithConsent(input: InquiryWrite): Promise<{ id: string }>;
}

export type SafeFields = Partial<Record<"company" | "contact" | "email" | "country" | "details", string>>;

export type InquiryValidationState = {
  status: "validation_error";
  fieldErrors: Record<string, string[]>;
  fields: SafeFields;
};

export type InquiryActionState =
  | undefined
  | { status: "success"; inquiryId: string; fields: Record<string, never> }
  | InquiryValidationState
  | { status: "rate_limited" | "service_error"; messageCode: string; fields: SafeFields };

type SubmitDependencies = {
  repository: InquiryRepository;
  rateLimit: RateLimitAdapter;
  requestContext: () => Promise<{ ip?: string; userAgent: string }>;
  secret: string;
  now?: () => Date;
  requirePreparedSession?: boolean;
};

function readString(formData: FormData, name: string): string {
  const value = formData.get(name);
  return typeof value === "string" ? value : "";
}

function safeFields(formData: FormData): SafeFields {
  return {
    company: readString(formData, "company").slice(0, 200),
    contact: readString(formData, "contact").slice(0, 200),
    email: readString(formData, "email").slice(0, 254),
    country: readString(formData, "country").slice(0, 100),
    details: readString(formData, "details").slice(0, 10_000),
  };
}

export function validateInquiryFormData(formData: FormData):
  | { success: true; data: InquiryInput; fields: SafeFields }
  | { success: false; state: InquiryValidationState } {
  const fields = safeFields(formData);
  const result = inquirySchema.safeParse({ ...fields, gdprConsent: readString(formData, "gdprConsent") });
  if (result.success) return { success: true, data: result.data, fields };
  const fieldErrors = Object.fromEntries(
    Object.keys(result.error.flatten().fieldErrors).map((key) => [
      key,
      [`inquiry_error_${key === "email" ? "email" : "required"}`],
    ]),
  );
  return { success: false, state: { status: "validation_error", fieldErrors, fields } };
}

function evidenceKey(secret: string, namespace: string, value: string): string {
  return createHmac("sha256", secret).update(`${namespace}:${value}`).digest("hex");
}

export function createSubmitInquiry(dependencies: SubmitDependencies) {
  return async function submitInquiryWithDependencies(
    _previousState: InquiryActionState,
    formData: FormData,
  ): Promise<Exclude<InquiryActionState, undefined>> {
    const validation = validateInquiryFormData(formData);
    if (!validation.success) return validation.state;
    const { data: parsedInquiry, fields } = validation;

    const now = dependencies.now?.() ?? new Date();
    try {
      const request = await dependencies.requestContext();
      let attachmentClaim: InquiryWrite["attachmentClaim"];
      const attachmentTokensValue = readString(formData, "attachmentTokens");
      const sessionId = readString(formData, "uploadSessionId"); const sessionSecret = readString(formData, "uploadSessionSecret");
      if (sessionId && sessionSecret) {
        let intentIds: string[];
        try { intentIds = JSON.parse(attachmentTokensValue || "[]"); } catch { return { status: "validation_error", fieldErrors: { attachments: ["inquiry_error_attachment"] }, fields }; }
        if (!Array.isArray(intentIds) || intentIds.length > 5 || intentIds.some((token) => typeof token !== "string" || !token)) return { status: "validation_error", fieldErrors: { attachments: ["inquiry_error_attachment"] }, fields };
        attachmentClaim = { intentIds, sessionId, secretDigest: uploadDigest(dependencies.secret, "capability", sessionSecret), emailDigest: uploadDigest(dependencies.secret, "email", parsedInquiry.email), claimedAt: now };
      } else if (dependencies.requirePreparedSession) {
        return { status: "validation_error", fieldErrors: { attachments: ["inquiry_upload_session_invalid"] }, fields };
      } else {
        await applyInquiryRateLimits(dependencies.rateLimit, { ip: request.ip, email: parsedInquiry.email, now, secret: dependencies.secret });
      }
      const record = await dependencies.repository.createInquiryWithConsent({
        inquiry: {
          companyName: parsedInquiry.company,
          contactName: parsedInquiry.contact,
          email: parsedInquiry.email,
          country: parsedInquiry.country,
          message: parsedInquiry.details,
        },
        consent: {
          subject: parsedInquiry.email,
          categories: { inquiry: true },
          policyVersion: INQUIRY_POLICY_VERSION,
          evidence: {
            explicit: true,
            ...(request.ip ? { requestKey: evidenceKey(dependencies.secret, "request", request.ip) } : {}),
            userAgentKey: evidenceKey(dependencies.secret, "user-agent", request.userAgent),
            submittedAt: now.toISOString(),
          },
        },
        attachmentClaim,
      });
      return { status: "success", inquiryId: record.id, fields: {} };
    } catch (error) {
      if (error instanceof InquiryRateLimitError) return { status: "rate_limited", messageCode: "inquiry_error_rate_limited", fields };
      if (error instanceof Error && error.message === "inquiry_upload_session_invalid") return { status: "validation_error", fieldErrors: { attachments: [error.message] }, fields };
      if (error instanceof Error && ["inquiry_attachment_claim_invalid", "inquiry_attachment_claim_conflict"].includes(error.message)) return { status: "validation_error", fieldErrors: { attachments: ["inquiry_error_attachment"] }, fields };
      return { status: "service_error", messageCode: "inquiry_error_service", fields };
    }
  };
}
