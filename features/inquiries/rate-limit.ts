import { createHmac } from "node:crypto";

export type RateLimitInput = {
  key: string;
  limit: number;
  windowSeconds: number;
  now: Date;
};

export interface RateLimitAdapter {
  consume(input: RateLimitInput): Promise<boolean>;
}

export class InquiryRateLimitError extends Error {
  readonly code = "inquiry_rate_limited";

  constructor() {
    super("Too many inquiry requests. Please try again later.");
    this.name = "InquiryRateLimitError";
  }
}

export function hashRateLimitIdentity(namespace: "ip" | "email", value: string, secret: string): string {
  if (secret.length < 32) throw new Error("A private keyed hashing secret of at least 32 characters is required");
  const normalized = namespace === "email" ? value.trim().toLowerCase() : value.trim();
  return createHmac("sha256", secret).update(`${namespace}:${normalized}`).digest("hex");
}

export async function applyInquiryRateLimits(
  adapter: RateLimitAdapter,
  input: { ip: string; email: string; now: Date; secret: string },
): Promise<void> {
  const requests = [
    { key: hashRateLimitIdentity("ip", input.ip, input.secret), limit: 3 },
    { key: hashRateLimitIdentity("email", input.email, input.secret), limit: 3 },
  ];
  for (const request of requests) {
    if (!await adapter.consume({ ...request, windowSeconds: 60 * 60, now: input.now })) {
      throw new InquiryRateLimitError();
    }
  }
}

export class DeterministicRateLimitAdapter implements RateLimitAdapter {
  readonly #entries = new Map<string, { count: number; expiresAt: number }>();

  async consume(input: RateLimitInput): Promise<boolean> {
    const existing = this.#entries.get(input.key);
    const timestamp = input.now.getTime();
    const entry = !existing || existing.expiresAt <= timestamp
      ? { count: 0, expiresAt: timestamp + input.windowSeconds * 1000 }
      : existing;
    if (entry.count >= input.limit) return false;
    entry.count += 1;
    this.#entries.set(input.key, entry);
    return true;
  }
}
