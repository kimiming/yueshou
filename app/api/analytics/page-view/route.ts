import type { NextRequest } from "next/server";

import { countryFromHeaders, localeFromPath, normalizeAnalyticsPath, parseUserAgent } from "@/features/analytics/traffic";
import { CONSENT_COOKIE_NAME, hasAnalyticsConsent } from "@/features/consent/preferences";
import { prisma } from "@/lib/db/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  if (!hasAnalyticsConsent(request.cookies.get(CONSENT_COOKIE_NAME)?.value)) return new Response(null, { status: 204 });
  const body = await request.json().catch(() => null) as { path?: unknown } | null;
  const path = normalizeAnalyticsPath(body?.path);
  if (!path) return Response.json({ error: "Invalid path" }, { status: 400 });
  const { deviceType, browser } = parseUserAgent(request.headers.get("user-agent") ?? "");
  await prisma.pageView.create({ data: { path, locale: localeFromPath(path), countryCode: countryFromHeaders(request.headers), deviceType, browser } });
  return new Response(null, { status: 204, headers: { "cache-control": "no-store" } });
}
