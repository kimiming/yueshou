"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { saveConsentPreferences } from "@/features/consent/actions";
import type { ConsentPreferences, ConsentSelection } from "@/features/consent/preferences";

import { CookiePreferencesDialog, type ConsentLabels } from "./cookie-preferences-dialog";

function ConsentIcon({ type }: { type: "cookie" | "shield" | "chart" | "settings" }) {
  const paths = {
    cookie: "M12 2a10 10 0 1 0 10 10c-4 0-7-3-7-7-1.8 0-3-1.2-3-3ZM8 9h.01M8 15h.01M14 14h.01",
    shield: "M12 3 5 6v5c0 4.6 2.9 8.1 7 10 4.1-1.9 7-5.4 7-10V6l-7-3Zm-3 9 2 2 4-5",
    chart: "M4 20V10m6 10V4m6 16v-7m4 7H2",
    settings: "M12 9a3 3 0 1 0 0 6 3 3 0 0 0 0-6Zm8 3 2-1-2-4-2 .4-1.5-1L16 4h-4l-.5 2.4-1.5 1L8 7 6 11l2 1v2l-2 1 2 4 2-.4 1.5 1L12 22h4l.5-2.4 1.5-1 2 .4 2-4-2-1v-2Z",
  };
  return <svg viewBox="0 0 24 24" aria-hidden="true"><path d={paths[type]} fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" /></svg>;
}

type CookieConsentBannerProps = {
  labels: ConsentLabels;
  initialPreferences: ConsentPreferences | null;
  persistPreferences?: (selection: ConsentSelection) => Promise<void>;
  onPreferencesChange?: (selection: ConsentSelection) => void;
};

export function CookieConsentBanner({
  labels,
  initialPreferences,
  persistPreferences = saveConsentPreferences,
  onPreferencesChange,
}: CookieConsentBannerProps) {
  const [hasChoice, setHasChoice] = useState(initialPreferences !== null);
  const [analytics, setAnalytics] = useState(initialPreferences?.analytics ?? false);
  const [analyticsDraft, setAnalyticsDraft] = useState(initialPreferences?.analytics ?? false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const returnFocusRef = useRef<HTMLElement | null>(null);

  const openDialog = useCallback((trigger?: HTMLElement | null) => {
    returnFocusRef.current = trigger ?? document.activeElement as HTMLElement | null;
    setAnalyticsDraft(analytics);
    setDialogOpen(true);
  }, [analytics]);

  const closeDialog = useCallback(() => {
    setDialogOpen(false);
    queueMicrotask(() => returnFocusRef.current?.focus());
  }, []);

  useEffect(() => {
    function handleOpen(event: Event) {
      const trigger = event instanceof CustomEvent && event.detail instanceof HTMLElement ? event.detail : null;
      openDialog(trigger);
    }
    window.addEventListener("open-cookie-settings", handleOpen);
    return () => window.removeEventListener("open-cookie-settings", handleOpen);
  }, [openDialog]);

  async function persist(enabled: boolean) {
    setSaving(true);
    try {
      await persistPreferences({ necessary: true, analytics: enabled });
      onPreferencesChange?.({ necessary: true, analytics: enabled });
      setAnalytics(enabled);
      setHasChoice(true);
      closeDialog();
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      {!hasChoice ? (
        <section className="cookie-banner" role="region" aria-label={labels.title}>
          <div className="cookie-banner__icon" aria-hidden="true"><ConsentIcon type="cookie" /></div>
          <div className="cookie-banner__content">
            <p className="cookie-banner__eyebrow"><ConsentIcon type="shield" /> Privacy & Cookies</p>
            <h2>{labels.title}</h2>
            <p className="cookie-banner__description">{labels.description}</p>
            <div className="cookie-banner__categories">
              <span><ConsentIcon type="shield" /><strong>{labels.necessary}</strong> · {labels.necessaryDescription}</span>
              <span><ConsentIcon type="chart" /><strong>{labels.analytics}</strong> · {labels.analyticsDescription}</span>
            </div>
          </div>
          <div className="cookie-banner__actions">
            <button className="cookie-button cookie-button--secondary" type="button" disabled={saving} onClick={() => void persist(false)}>{labels.rejectAll}</button>
            <button className="cookie-button cookie-button--ghost" type="button" disabled={saving} onClick={(event) => openDialog(event.currentTarget)}><ConsentIcon type="settings" />{labels.manage}</button>
            <button className="cookie-button cookie-button--primary" type="button" disabled={saving} onClick={() => void persist(true)}>{labels.acceptAll}</button>
          </div>
        </section>
      ) : null}
      <CookiePreferencesDialog
        labels={labels}
        open={dialogOpen}
        analytics={analyticsDraft}
        onAnalyticsChange={setAnalyticsDraft}
        onClose={closeDialog}
        onSave={() => void persist(analyticsDraft)}
      />
    </>
  );
}
