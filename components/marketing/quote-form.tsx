"use client";

import { startTransition, useActionState, useState, type FormEvent } from "react";

import { beginInquiryAttachmentUpload, finalizeInquiryAttachmentUpload, prepareInquirySubmission, submitInquiry, type InquiryActionState } from "@/features/inquiries/actions";
import { prepareAndUploadInquiry } from "@/features/inquiries/client-upload";

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

class InquiryPreflightValidationError extends Error {}

function FieldError({ state, name, errors: messages }: { state: InquiryActionState; name: string; errors: Record<string, string> }) {
  if (state?.status !== "validation_error") return null;
  const errors = state.fieldErrors[name];
  return errors?.length ? <span id={`${name}-error`} className="quote-form__error">{messages[errors[0]] ?? messages.inquiry_error_required}</span> : null;
}

export function QuoteForm({ labels }: { labels: QuoteFormLabels }) {
  const [state, action, pending] = useActionState(submitInquiry, undefined);
  const [uploading, setUploading] = useState(false);
  const [attachmentError, setAttachmentError] = useState<string>();
  const [preflightState, setPreflightState] = useState<InquiryActionState>();
  const effectiveState = preflightState ?? state;
  if (state?.status === "success") return <p className="quote-form__success" role="status">{labels.success}</p>;

  const describedBy = (name: string) => effectiveState?.status === "validation_error" && effectiveState.fieldErrors[name]?.length
    ? `${name}-error`
    : undefined;

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setAttachmentError(undefined); setPreflightState(undefined); setUploading(true);
    const data = new FormData(event.currentTarget);
    const files = data.getAll("attachments").filter((value): value is File => value instanceof File && value.size > 0);
    data.delete("attachments");
    try {
      const prepared = await prepareAndUploadInquiry(files, data, {
        prepare: async (fields) => {
          const result = await prepareInquirySubmission(fields);
          if (!result.ok && "state" in result) {
            setPreflightState(result.state);
            throw new InquiryPreflightValidationError();
          }
          if (!result.ok) throw new Error(result.code);
          return result.value;
        },
        begin: async (b, upload) => { const result = await beginInquiryAttachmentUpload(b, upload); if (!result.ok) throw new Error(result.code); return result.value; },
        finalize: async (b, key, upload) => { const result = await finalizeInquiryAttachmentUpload(b, key, upload); if (!result.ok) throw new Error(result.code); return result.value; },
      });
      data.set("attachmentTokens", JSON.stringify(prepared.tokens)); data.set("uploadSessionId", prepared.binding.id); data.set("uploadSessionSecret", prepared.binding.secret);
      startTransition(() => action(data));
    } catch (error) { if (!(error instanceof InquiryPreflightValidationError)) setAttachmentError(error instanceof Error ? error.message : "inquiry_error_attachment"); }
    finally { setUploading(false); }
  }

  return (
    <form className="quote-form" onSubmit={(event) => void handleSubmit(event)} noValidate>
      {effectiveState?.status === "rate_limited" || effectiveState?.status === "service_error" ? <p className="quote-form__error" role="alert">{labels.errors[effectiveState.messageCode] ?? labels.errors.inquiry_error_service}</p> : null}
      <p className="quote-form__required">{labels.required}</p>
      <label><span>{labels.company}</span><input aria-label={labels.company} name="company" required defaultValue={effectiveState?.fields.company} aria-describedby={describedBy("company")} /><FieldError state={effectiveState} name="company" errors={labels.errors} /></label>
      <label><span>{labels.contact}</span><input aria-label={labels.contact} name="contact" autoComplete="name" required defaultValue={effectiveState?.fields.contact} aria-describedby={describedBy("contact")} /><FieldError state={effectiveState} name="contact" errors={labels.errors} /></label>
      <label><span>{labels.email}</span><input aria-label={labels.email} name="email" type="email" autoComplete="email" required defaultValue={effectiveState?.fields.email} aria-describedby={describedBy("email")} /><FieldError state={effectiveState} name="email" errors={labels.errors} /></label>
      <label><span>{labels.country}</span><input aria-label={labels.country} name="country" autoComplete="country-name" required defaultValue={effectiveState?.fields.country} aria-describedby={describedBy("country")} /><FieldError state={effectiveState} name="country" errors={labels.errors} /></label>
      <label><span>{labels.details}</span><textarea aria-label={labels.details} name="details" required rows={8} defaultValue={effectiveState?.fields.details} aria-describedby={describedBy("details")} /><FieldError state={effectiveState} name="details" errors={labels.errors} /></label>
      <label><span>{labels.attachments}</span><input aria-label={labels.attachments} name="attachments" type="file" multiple accept=".pdf,.docx,.xlsx,.csv,.txt" /><small>{labels.attachmentHelp}</small></label>
      <FieldError state={effectiveState} name="attachments" errors={labels.errors} />
      {attachmentError ? <p className="quote-form__error" role="alert">{labels.errors[attachmentError] ?? labels.errors.inquiry_error_attachment}</p> : null}
      <label className="quote-form__consent"><input aria-label={labels.consent} name="gdprConsent" type="checkbox" required aria-describedby={describedBy("gdprConsent")} /><span>{labels.consent}</span><FieldError state={effectiveState} name="gdprConsent" errors={labels.errors} /></label>
      <button type="submit" disabled={pending || uploading}>{uploading ? labels.uploading : pending ? labels.submitting : labels.submit}</button>
    </form>
  );
}
