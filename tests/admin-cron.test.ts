import { createHmac } from "node:crypto";
import { describe, expect, it } from "vitest";
import { verifyCronRequest, verifyVercelCronRequest } from "@/features/admin/cron-auth";

describe("scheduled publication cron authentication", () => {
  it("requires a sufficiently long secret and a valid HMAC", () => {
    const secret = "a".repeat(32); const timestamp = "1720000000"; const signature = createHmac("sha256", secret).update(`${timestamp}.`).digest("hex");
    expect(verifyCronRequest({ secret, timestamp, signature, nowSeconds: 1720000000 })).toBe(true);
    expect(verifyCronRequest({ secret: "short", timestamp, signature, nowSeconds: 1720000000 })).toBe(false);
    expect(verifyCronRequest({ secret, timestamp, signature: "bad", nowSeconds: 1720000000 })).toBe(false);
  });

  it("accepts only Vercel's exact bearer secret for GET cron invocations", () => {
    const secret = "a".repeat(32);
    expect(verifyVercelCronRequest({ secret, authorization: `Bearer ${secret}` })).toBe(true);
    expect(verifyVercelCronRequest({ secret, authorization: "Bearer wrong" })).toBe(false);
    expect(verifyVercelCronRequest({ secret: "short", authorization: `Bearer ${secret}` })).toBe(false);
  });
});
