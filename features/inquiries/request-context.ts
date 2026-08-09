import { isIP } from "node:net";

export type InquiryProxyMode = "vercel" | "nginx" | "direct";

function canonicalIp(value: string | undefined): string | undefined {
  const candidate = value?.trim();
  if (!candidate || isIP(candidate) === 0) return undefined;
  if (isIP(candidate) === 4) return candidate;
  return new URL(`http://[${candidate}]/`).hostname.slice(1, -1);
}

export function resolveClientIp(mode: InquiryProxyMode, headers: Record<string, string | undefined>): string | undefined {
  if (mode === "direct") return undefined;
  // Deployment contract: Vercel supplies x-vercel-forwarded-for; Nginx must overwrite
  // (never append/pass through) X-Real-IP from the socket peer.
  const value = mode === "vercel" ? headers["x-vercel-forwarded-for"] : headers["x-real-ip"];
  return canonicalIp(value?.split(",")[0]);
}
