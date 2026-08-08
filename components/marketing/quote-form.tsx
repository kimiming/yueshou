"use client";

import { startTransition, useActionState, useState, type FormEvent } from "react";

import { beginInquiryAttachmentUpload, finalizeInquiryAttachmentUpload, submitInquiry, type InquiryActionState } from "@/features/inquiries/actions";
import { uploadInquiryFiles, type PublicAttachmentBinding } from "@/features/inquiries/client-upload";

export type QuoteFormLabels = {
  company: string;
  contact: string;
  email: string;
  country: string;
  details: string;
  consent: string;
  submit: string;
  submitting: string;
  success: string;
  required: string;
  attachments: string;
  attachmentHelp: string;
  uploading: string;
  errors: Record<string, string>;
};

function FieldError({ state, name, errors: messages }: { state: InquiryActionState; name: string; errors: Record<string, string> }) {
  if (state?.status !== "validation_error") return null;
  const errors = state.fieldErrors[name];
  return errors?.length ? <span id={`${name}-error`} className="quote-form__error">{messages[errors[0]] ?? messages.inquiry_error_required}</span> : null;
}

export function QuoteForm({ labels, binding }: { labels: QuoteFormLabels; binding: PublicAttachmentBinding }) {
  const [state, action, pending] = useActionState(submitInquiry, undefined);
  const [uploading, setUploading] = useState(false);
  const [attachmentError, setAttachmentError] = useState<string>();
  if (state?.status === "success") return <p className="quote-form__success" role="status">{labels.success}</p>;

  const describedBy = (name: string) => state?.status === "validation_error" && state.fieldErrors[name]?.length
    ? `${name}-error`
    : undefined;

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setAttachmentError(undefined); setUploading(true);
    const data = new FormData(event.currentTarget);
    const files = data.getAll("attachments").filter((value): value is File => value instanceof File && value.size > 0);
    data.delete("attachments");
    try {
      const tokens = await uploadInquiryFiles(files, binding, {
        begin: async (b, upload) => { const result = await beginInquiryAttachmentUpload(b, upload); if (!result.ok) throw new Error(result.code); return result.value; },
        finalize: async (b, key, upload) => { const result = await finalizeInquiryAttachmentUpload(b, key, upload); if (!result.ok) throw new Error(result.code); return result.value; },
      });
      data.set("attachmentTokens", JSON.stringify(tokens)); data.set("submissionToken", binding.submissionToken); data.set("sessionToken", binding.sessionToken); data.set("actorToken", binding.actorToken);
      startTransition(() => action(data));
    } catch (error) { setAttachmentError(error instanceof Error ? error.message : "inquiry_error_attachment"); }
    finally { setUploading(false); }
  }

  return (
    <form className="quote-form" onSubmit={(event) => void handleSubmit(event)} noValidate>
      {state?.status === "rate_limited" || state?.status === "service_error" ? <p className="quote-form__error" role="alert">{labels.errors[state.messageCode] ?? labels.errors.inquiry_error_service}</p> : null}
      <p className="quote-form__required">{labels.required}</p>
      <label><span>{labels.company}</span><input name="company" required defaultValue={state?.fields.company} aria-describedby={describedBy("company")} /><FieldError state={state} name="company" errors={labels.errors} /></label>
      <label><span>{labels.contact}</span><input name="contact" autoComplete="name" required defaultValue={state?.fields.contact} aria-describedby={describedBy("contact")} /><FieldError state={state} name="contact" errors={labels.errors} /></label>
      <label><span>{labels.email}</span><input name="email" type="email" autoComplete="email" required defaultValue={state?.fields.email} aria-describedby={describedBy("email")} /><FieldError state={state} name="email" errors={labels.errors} /></label>
      <label><span>{labels.country}</span><input name="country" autoComplete="country-name" required defaultValue={state?.fields.country} aria-describedby={describedBy("country")} /><FieldError state={state} name="country" errors={labels.errors} /></label>
      <label><span>{labels.details}</span><textarea name="details" required rows={8} defaultValue={state?.fields.details} aria-describedby={describedBy("details")} /><FieldError state={state} name="details" errors={labels.errors} /></label>
      <label><span>{labels.attachments}</span><input aria-label={labels.attachments} name="attachments" type="file" multiple accept=".pdf,.docx,.xlsx,.csv,.txt" /><small>{labels.attachmentHelp}</small></label>
      {attachmentError ? <p className="quote-form__error" role="alert">{labels.errors[attachmentError] ?? labels.errors.inquiry_error_attachment}</p> : null}
      <label className="quote-form__consent"><input name="gdprConsent" type="checkbox" required aria-describedby={describedBy("gdprConsent")} /><span>{labels.consent}</span><FieldError state={state} name="gdprConsent" errors={labels.errors} /></label>
      <button type="submit" disabled={pending || uploading}>{uploading ? labels.uploading : pending ? labels.submitting : labels.submit}</button>
    </form>
  );
}
