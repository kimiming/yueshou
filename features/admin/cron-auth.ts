import { createHmac, timingSafeEqual } from "node:crypto";

export function verifyCronRequest(input: { secret?: string; timestamp?: string | null; signature?: string | null; nowSeconds?: number; maxAgeSeconds?: number }) {
  if (!input.secret || input.secret.length < 32 || !input.timestamp || !input.signature || !/^\d{10,}$/.test(input.timestamp) || !/^[a-f0-9]{64}$/i.test(input.signature)) return false;
  const now = input.nowSeconds ?? Math.floor(Date.now() / 1000); const timestamp = Number(input.timestamp); const maxAge = input.maxAgeSeconds ?? 300;
  if (!Number.isSafeInteger(timestamp) || Math.abs(now - timestamp) > maxAge) return false;
  const expected = createHmac("sha256", input.secret).update(`${input.timestamp}.`).digest();
  const supplied = Buffer.from(input.signature, "hex");
  return supplied.length === expected.length && timingSafeEqual(supplied, expected);
}
