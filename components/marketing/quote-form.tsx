"use client";

import { useActionState } from "react";

import { submitInquiry, type InquiryActionState } from "@/features/inquiries/actions";

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
};

function FieldError({ state, name }: { state: InquiryActionState; name: string }) {
  if (state?.status !== "validation_error") return null;
  const errors = state.fieldErrors[name];
  return errors?.length ? <span id={`${name}-error`} className="quote-form__error">{errors[0]}</span> : null;
}

export function QuoteForm({ labels }: { labels: QuoteFormLabels }) {
  const [state, action, pending] = useActionState(submitInquiry, undefined);
  if (state?.status === "success") return <p className="quote-form__success" role="status">{labels.success}</p>;

  const describedBy = (name: string) => state?.status === "validation_error" && state.fieldErrors[name]?.length
    ? `${name}-error`
    : undefined;

  return (
    <form className="quote-form" action={action} noValidate>
      {state?.status === "rate_limited" || state?.status === "service_error" ? <p className="quote-form__error" role="alert">{state.message}</p> : null}
      <p className="quote-form__required">{labels.required}</p>
      <label><span>{labels.company}</span><input name="company" required defaultValue={state?.fields.company} aria-describedby={describedBy("company")} /><FieldError state={state} name="company" /></label>
      <label><span>{labels.contact}</span><input name="contact" autoComplete="name" required defaultValue={state?.fields.contact} aria-describedby={describedBy("contact")} /><FieldError state={state} name="contact" /></label>
      <label><span>{labels.email}</span><input name="email" type="email" autoComplete="email" required defaultValue={state?.fields.email} aria-describedby={describedBy("email")} /><FieldError state={state} name="email" /></label>
      <label><span>{labels.country}</span><input name="country" autoComplete="country-name" required defaultValue={state?.fields.country} aria-describedby={describedBy("country")} /><FieldError state={state} name="country" /></label>
      <label><span>{labels.details}</span><textarea name="details" required rows={8} defaultValue={state?.fields.details} aria-describedby={describedBy("details")} /><FieldError state={state} name="details" /></label>
      <label className="quote-form__consent"><input name="gdprConsent" type="checkbox" required aria-describedby={describedBy("gdprConsent")} /><span>{labels.consent}</span><FieldError state={state} name="gdprConsent" /></label>
      <button type="submit" disabled={pending}>{pending ? labels.submitting : labels.submit}</button>
    </form>
  );
}
