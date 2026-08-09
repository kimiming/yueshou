"use client";

import type { ReactNode } from "react";
import { useState } from "react";

import { CookieConsentBanner } from "@/components/consent/cookie-consent-banner";
import type { ConsentLabels } from "@/components/consent/cookie-preferences-dialog";
import { saveConsentPreferences } from "@/features/consent/actions";
import {
  CONSENT_POLICY_VERSION,
  type ConsentPreferences,
  type ConsentSelection,
} from "@/features/consent/preferences";

export function AnalyticsConsentBoundary({ preferences, children }: { preferences: ConsentPreferences | null; children: ReactNode }) {
  return preferences?.analytics === true ? children : null;
}

export function ConsentRuntime({
  labels,
  initialPreferences,
  persistPreferences = saveConsentPreferences,
  children,
}: {
  labels: ConsentLabels;
  initialPreferences: ConsentPreferences | null;
  persistPreferences?: (selection: ConsentSelection) => Promise<void>;
  children: ReactNode;
}) {
  const [preferences, setPreferences] = useState(initialPreferences);
  const updatePreferences = (selection: ConsentSelection) => setPreferences({
    version: CONSENT_POLICY_VERSION,
    timestamp: new Date().toISOString(),
    necessary: true,
    analytics: selection.analytics,
  });

  return (
    <>
      <CookieConsentBanner
        labels={labels}
        initialPreferences={initialPreferences}
        persistPreferences={persistPreferences}
        onPreferencesChange={updatePreferences}
      />
      <AnalyticsConsentBoundary preferences={preferences}>{children}</AnalyticsConsentBoundary>
    </>
  );
}
