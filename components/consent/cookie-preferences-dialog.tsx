"use client";

import { useEffect, useRef, type KeyboardEvent } from "react";

export type ConsentLabels = {
  title: string;
  description: string;
  necessary: string;
  necessaryDescription: string;
  analytics: string;
  analyticsDescription: string;
  rejectAll: string;
  acceptAll: string;
  manage: string;
  save: string;
  close: string;
};

type CookiePreferencesDialogProps = {
  labels: ConsentLabels;
  open: boolean;
  analytics: boolean;
  onAnalyticsChange: (enabled: boolean) => void;
  onClose: () => void;
  onSave: () => void;
};

export function CookiePreferencesDialog({
  labels,
  open,
  analytics,
  onAnalyticsChange,
  onClose,
  onSave,
}: CookiePreferencesDialogProps) {
  const dialogRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    dialogRef.current?.querySelector<HTMLElement>("button, input")?.focus();
  }, [open]);

  if (!open) return null;

  function handleKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key === "Escape") {
      event.preventDefault();
      onClose();
      return;
    }
    if (event.key !== "Tab") return;
    const focusable = Array.from(
      dialogRef.current?.querySelectorAll<HTMLElement>("button:not([disabled]), input:not([disabled])") ?? [],
    );
    if (focusable.length === 0) return;
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  }

  return (
    <div className="cookie-dialog-backdrop">
      <div
        ref={dialogRef}
        className="cookie-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="cookie-dialog-title"
        aria-describedby="cookie-dialog-description"
        onKeyDown={handleKeyDown}
      >
        <button type="button" className="cookie-dialog__close" aria-label={labels.close} onClick={onClose}>×</button>
        <h2 id="cookie-dialog-title">{labels.title}</h2>
        <p id="cookie-dialog-description">{labels.description}</p>
        <label className="cookie-dialog__option">
          <input type="checkbox" aria-label={labels.necessary} checked disabled />
          <span><strong>{labels.necessary}</strong><small>{labels.necessaryDescription}</small></span>
        </label>
        <label className="cookie-dialog__option">
          <input
            type="checkbox"
            aria-label={labels.analytics}
            checked={analytics}
            onChange={(event) => onAnalyticsChange(event.currentTarget.checked)}
          />
          <span><strong>{labels.analytics}</strong><small>{labels.analyticsDescription}</small></span>
        </label>
        <button type="button" onClick={onSave}>{labels.save}</button>
      </div>
    </div>
  );
}
