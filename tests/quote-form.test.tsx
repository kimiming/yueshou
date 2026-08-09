import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@/features/inquiries/actions", () => ({
  submitInquiry: vi.fn(async () => ({ status: "service_error", messageCode: "inquiry_error_service", fields: {} })),
  beginInquiryAttachmentUpload: vi.fn(),
  finalizeInquiryAttachmentUpload: vi.fn(),
  prepareInquirySubmission: vi.fn(),
}));

import { QuoteForm } from "@/components/marketing/quote-form";
import { beginInquiryAttachmentUpload, finalizeInquiryAttachmentUpload, prepareInquirySubmission } from "@/features/inquiries/actions";

afterEach(cleanup);

describe("QuoteForm attachments", () => {
  const labels = {
    company: "Company", contact: "Contact", email: "Email", country: "Country", details: "Details", consent: "Consent", submit: "Submit", submitting: "Submitting", success: "Success", required: "Required", attachments: "Attachments", attachmentHelp: "Allowed files", uploading: "Securing attachments",
    errors: { inquiry_error_required: "Required", inquiry_error_email: "Enter a valid email address.", inquiry_error_service: "Service", inquiry_error_attachment: "Attachment", inquiry_error_attachment_count: "Choose no more than five files." },
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

  it("renders structured preflight field errors without starting attachment work", async () => {
    vi.mocked(prepareInquirySubmission).mockResolvedValue({
      ok: false,
      state: {
        status: "validation_error",
        fieldErrors: { email: ["inquiry_error_email"], details: ["inquiry_error_required"], gdprConsent: ["inquiry_error_required"] },
        fields: { company: "Research Lab", contact: "Ada", email: "invalid", country: "DE", details: "short" },
      },
    });
    render(<QuoteForm labels={labels} />);
    fireEvent.change(screen.getByRole("textbox", { name: "Company" }), { target: { value: "Research Lab" } });
    fireEvent.change(screen.getByRole("textbox", { name: "Contact" }), { target: { value: "Ada" } });
    fireEvent.change(screen.getByRole("textbox", { name: "Email" }), { target: { value: "invalid" } });
    fireEvent.change(screen.getByRole("textbox", { name: "Country" }), { target: { value: "DE" } });
    fireEvent.change(screen.getByRole("textbox", { name: "Details" }), { target: { value: "short" } });

    fireEvent.submit(screen.getByRole("button", { name: "Submit" }).closest("form")!);

    expect(await screen.findByText("Enter a valid email address.")).toHaveAttribute("id", "email-error");
    expect(screen.getByRole("textbox", { name: "Email" })).toHaveAttribute("aria-describedby", "email-error");
    expect(screen.getByRole("textbox", { name: "Email" })).toHaveValue("invalid");
    expect(beginInquiryAttachmentUpload).not.toHaveBeenCalled();
    expect(finalizeInquiryAttachmentUpload).not.toHaveBeenCalled();
  });
});
