import { z } from "zod";

export const CONSENT_POLICY_VERSION = "2026-08-08";
export const CONSENT_COOKIE_NAME = "ys_consent_v1";

const consentPreferencesSchema = z.object({
  version: z.literal(CONSENT_POLICY_VERSION),
  timestamp: z.string().datetime({ offset: true }),
  necessary: z.literal(true),
  analytics: z.boolean(),
}).strict();

export type ConsentPreferences = z.infer<typeof consentPreferencesSchema>;
export type ConsentSelection = Pick<ConsentPreferences, "necessary" | "analytics">;

export function serializeConsentPreferences(
  selection: Pick<ConsentPreferences, "analytics">,
  now = new Date(),
): string {
  return JSON.stringify({
    version: CONSENT_POLICY_VERSION,
    timestamp: now.toISOString(),
    necessary: true,
    analytics: selection.analytics,
  } satisfies ConsentPreferences);
}

export function parseConsentCookie(value: string | undefined): ConsentPreferences | null {
  if (!value) return null;
  try {
    const result = consentPreferencesSchema.safeParse(JSON.parse(value));
    return result.success ? result.data : null;
  } catch {
    return null;
  }
}

export function hasAnalyticsConsent(value: string | undefined): boolean {
  return parseConsentCookie(value)?.analytics === true;
}
