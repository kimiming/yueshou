"use server";

import { cookies } from "next/headers";

import {
  CONSENT_COOKIE_NAME,
  serializeConsentPreferences,
  type ConsentSelection,
} from "./preferences";

export async function saveConsentPreferences(selection: ConsentSelection): Promise<void> {
  const value = serializeConsentPreferences({ analytics: selection.analytics });
  const cookieStore = await cookies();
  cookieStore.set(CONSENT_COOKIE_NAME, value, {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    path: "/",
    maxAge: 365 * 24 * 60 * 60,
    priority: "high",
  });
}
