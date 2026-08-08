import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@/features/inquiries/actions", () => ({
  submitInquiry: vi.fn(async () => ({ status: "service_error", messageCode: "inquiry_error_service", fields: {} })),
  beginInquiryAttachmentUpload: vi.fn(),
  finalizeInquiryAttachmentUpload: vi.fn(),
  prepareInquirySubmission: vi.fn(),
}));

import { QuoteForm } from "@/components/marketing/quote-form";
import { prepareInquirySubmission } from "@/features/inquiries/actions";

afterEach(cleanup);

describe("QuoteForm attachments", () => {
  const labels = {
    company: "Company", contact: "Contact", email: "Email", country: "Country", details: "Details", consent: "Consent", submit: "Submit", submitting: "Submitting", success: "Success", required: "Required", attachments: "Attachments", attachmentHelp: "Allowed files", uploading: "Securing attachments",
    errors: { inquiry_error_required: "Required", inquiry_error_service: "Service", inquiry_error_attachment: "Attachment", inquiry_error_attachment_count: "Choose no more than five files." },
  };

  it("offers an accessible private attachment input and localized progress text", () => {
    render(<QuoteForm labels={labels} />);
    const input = screen.getByLabelText("Attachments");
    expect(input).toHaveAttribute("multiple");
    expect(input).toHaveAttribute("accept", ".pdf,.docx,.xlsx,.csv,.txt");
    expect(screen.getByText("Allowed files")).toBeInTheDocument();
  });

  it("shows a localized attachment quota error returned by admission", async () => {
    vi.mocked(prepareInquirySubmission).mockResolvedValue({ ok: false, code: "inquiry_error_attachment_count" });
    render(<QuoteForm labels={labels} />);
    fireEvent.submit(screen.getByRole("button", { name: "Submit" }).closest("form")!);
    await waitFor(() => expect(screen.getByRole("alert")).toHaveTextContent("Choose no more than five files."));
  });
});
