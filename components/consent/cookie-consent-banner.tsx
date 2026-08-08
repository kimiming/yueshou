"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { saveConsentPreferences } from "@/features/consent/actions";
import type { ConsentPreferences, ConsentSelection } from "@/features/consent/preferences";

import { CookiePreferencesDialog, type ConsentLabels } from "./cookie-preferences-dialog";

type CookieConsentBannerProps = {
  labels: ConsentLabels;
  initialPreferences: ConsentPreferences | null;
  persistPreferences?: (selection: ConsentSelection) => Promise<void>;
};

export function CookieConsentBanner({
  labels,
  initialPreferences,
  persistPreferences = saveConsentPreferences,
}: CookieConsentBannerProps) {
  const [hasChoice, setHasChoice] = useState(initialPreferences !== null);
  const [analytics, setAnalytics] = useState(initialPreferences?.analytics ?? false);
  const [analyticsDraft, setAnalyticsDraft] = useState(initialPreferences?.analytics ?? false);
  const [dialogOpen, setDialogOpen] = useState(false);
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
    await persistPreferences({ necessary: true, analytics: enabled });
    setAnalytics(enabled);
    setHasChoice(true);
    closeDialog();
  }

  return (
    <>
      {!hasChoice ? (
        <section className="cookie-banner" role="region" aria-label={labels.title}>
          <div>
            <h2>{labels.title}</h2>
            <p>{labels.description}</p>
          </div>
          <div className="cookie-banner__actions">
            <button type="button" onClick={() => void persist(false)}>{labels.rejectAll}</button>
            <button type="button" onClick={(event) => openDialog(event.currentTarget)}>{labels.manage}</button>
            <button type="button" onClick={() => void persist(true)}>{labels.acceptAll}</button>
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
