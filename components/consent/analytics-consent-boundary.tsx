import type { ReactNode } from "react";

import type { ConsentPreferences } from "@/features/consent/preferences";

export function AnalyticsConsentBoundary({ preferences, children }: { preferences: ConsentPreferences | null; children: ReactNode }) {
  return preferences?.analytics === true ? children : null;
}
