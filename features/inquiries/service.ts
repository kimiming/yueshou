import { createHmac } from "node:crypto";

import { inquirySchema, INQUIRY_POLICY_VERSION } from "./schemas";
import { applyInquiryRateLimits, InquiryRateLimitError, type RateLimitAdapter } from "./rate-limit";

export type InquiryWrite = {
  inquiry: { companyName: string; contactName: string; email: string; country: string; message: string };
  consent: {
    subject: string;
    categories: { inquiry: true };
    policyVersion: string;
    evidence: { explicit: true; requestKey: string; userAgentKey: string; submittedAt: string };
  };
};

export interface InquiryRepository {
  createInquiryWithConsent(input: InquiryWrite): Promise<{ id: string }>;
}

type SafeFields = Partial<Record<"company" | "contact" | "email" | "country" | "details", string>>;

export type InquiryActionState =
  | undefined
  | { status: "success"; inquiryId: string; fields: Record<string, never> }
  | { status: "validation_error"; fieldErrors: Record<string, string[]>; fields: SafeFields }
  | { status: "rate_limited" | "service_error"; message: string; fields: SafeFields };

type SubmitDependencies = {
  repository: InquiryRepository;
  rateLimit: RateLimitAdapter;
  requestContext: () => Promise<{ ip: string; userAgent: string }>;
  secret: string;
  now?: () => Date;
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

function evidenceKey(secret: string, namespace: string, value: string): string {
  return createHmac("sha256", secret).update(`${namespace}:${value}`).digest("hex");
}

export function createSubmitInquiry(dependencies: SubmitDependencies) {
  return async function submitInquiryWithDependencies(
    _previousState: InquiryActionState,
    formData: FormData,
  ): Promise<Exclude<InquiryActionState, undefined>> {
    const fields = safeFields(formData);
    const result = inquirySchema.safeParse({ ...fields, gdprConsent: readString(formData, "gdprConsent") });
    if (!result.success) {
      return { status: "validation_error", fieldErrors: result.error.flatten().fieldErrors, fields };
    }

    const now = dependencies.now?.() ?? new Date();
    try {
      const request = await dependencies.requestContext();
      await applyInquiryRateLimits(dependencies.rateLimit, { ip: request.ip, email: result.data.email, now, secret: dependencies.secret });
      const record = await dependencies.repository.createInquiryWithConsent({
        inquiry: {
          companyName: result.data.company,
          contactName: result.data.contact,
          email: result.data.email,
          country: result.data.country,
          message: result.data.details,
        },
        consent: {
          subject: result.data.email,
          categories: { inquiry: true },
          policyVersion: INQUIRY_POLICY_VERSION,
          evidence: {
            explicit: true,
            requestKey: evidenceKey(dependencies.secret, "request", request.ip),
            userAgentKey: evidenceKey(dependencies.secret, "user-agent", request.userAgent),
            submittedAt: now.toISOString(),
          },
        },
      });
      return { status: "success", inquiryId: record.id, fields: {} };
    } catch (error) {
      if (error instanceof InquiryRateLimitError) return { status: "rate_limited", message: error.message, fields };
      return { status: "service_error", message: "Your inquiry could not be submitted. Please try again.", fields };
    }
  };
}
