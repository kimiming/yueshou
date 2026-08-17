const supportedLocales = new Set(["en", "zh-CN", "de", "fr", "es"]);

export function parseUserAgent(userAgent: string) {
  const deviceType = /bot|crawler|spider|headless/i.test(userAgent)
    ? "Bot"
    : /ipad|tablet|playbook|silk/i.test(userAgent)
      ? "Tablet"
      : /mobile|iphone|ipod|android/i.test(userAgent)
        ? "Mobile"
        : "Desktop";
  const browser = /edg\//i.test(userAgent) ? "Edge"
    : /opr\/|opera/i.test(userAgent) ? "Opera"
      : /chrome\//i.test(userAgent) ? "Chrome"
        : /firefox\//i.test(userAgent) ? "Firefox"
          : /safari\//i.test(userAgent) ? "Safari"
            : "Other";
  return { deviceType, browser };
}

export function normalizeAnalyticsPath(input: unknown) {
  if (typeof input !== "string" || !input.startsWith("/") || input.startsWith("/admin") || input.length > 500) return null;
  try {
    const path = new URL(input, "https://analytics.invalid").pathname.replace(/\/{2,}/g, "/");
    return path.length <= 300 ? path : null;
  } catch {
    return null;
  }
}

export function localeFromPath(path: string) {
  const locale = path.split("/")[1];
  return supportedLocales.has(locale) ? locale : null;
}

export function countryFromHeaders(headers: Headers) {
  const value = headers.get("cf-ipcountry") ?? headers.get("x-vercel-ip-country") ?? headers.get("x-country-code");
  return value && /^[A-Z]{2}$/i.test(value) && value.toUpperCase() !== "XX" ? value.toUpperCase() : null;
}
