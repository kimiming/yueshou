import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@/features/inquiries/actions", () => ({
  submitInquiry: vi.fn(async () => ({ status: "service_error", messageCode: "inquiry_error_service", fields: {} })),
  beginInquiryAttachmentUpload: vi.fn(),
  finalizeInquiryAttachmentUpload: vi.fn(),
}));

import { QuoteForm } from "@/components/marketing/quote-form";

afterEach(cleanup);

describe("QuoteForm attachments", () => {
  it("offers an accessible private attachment input and localized progress text", () => {
    render(<QuoteForm binding={{ submissionToken: "s", sessionToken: "session", actorToken: "actor" }} labels={{
      company: "Company", contact: "Contact", email: "Email", country: "Country", details: "Details", consent: "Consent", submit: "Submit", submitting: "Submitting", success: "Success", required: "Required", attachments: "Attachments", attachmentHelp: "Allowed files", uploading: "Securing attachments", errors: { inquiry_error_required: "Required", inquiry_error_service: "Service", inquiry_error_attachment: "Attachment" },
    }} />);
    const input = screen.getByLabelText("Attachments");
    expect(input).toHaveAttribute("multiple");
    expect(input).toHaveAttribute("accept", ".pdf,.docx,.xlsx,.csv,.txt");
    expect(screen.getByText("Allowed files")).toBeInTheDocument();
  });
});
