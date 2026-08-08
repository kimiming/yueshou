import { describe, expect, it, vi } from "vitest";

import {
  applyAuthRateLimits,
  createCredentialAuthorizer,
  normalizeEmail,
  type AuthRateLimitAdapter,
} from "@/lib/auth/config";
import { hashPassword, verifyPassword } from "@/lib/auth/password";

describe("password verification", () => {
  it("accepts the matching password and rejects a wrong password", async () => {
    const hash = await hashPassword("correct horse battery staple");

    await expect(verifyPassword(hash, "correct horse battery staple")).resolves.toBe(true);
    await expect(verifyPassword(hash, "wrong-password")).resolves.toBe(false);
  });

  it("fails closed for a malformed stored hash", async () => {
    await expect(verifyPassword("not-an-argon2-hash", "password")).resolves.toBe(false);
  });
});

describe("credential authorization", () => {
  it("normalizes email before the active-user lookup", async () => {
    const findActiveUserByEmail = vi.fn(async () => ({
      id: "editor-1",
      email: "editor@example.test",
      name: "Editor",
      passwordHash: "stored-hash",
      role: "EDITOR" as const,
      updatedAt: new Date("2026-08-08T10:00:00.000Z"),
    }));
    const authorize = createCredentialAuthorizer({
      findActiveUserByEmail,
      verify: vi.fn(async () => true),
      consumeRateLimit: vi.fn(async () => true),
    });

    await expect(
      authorize({ email: "  Editor@EXAMPLE.test ", password: "password" }, { ip: "203.0.113.8" }),
    ).resolves.toMatchObject({ id: "editor-1", role: "EDITOR" });
    expect(findActiveUserByEmail).toHaveBeenCalledWith("editor@example.test");
  });

  it("uses one password verification on both unknown-user and wrong-password paths", async () => {
    const unknownVerify = vi.fn<(hash: string, password: string) => Promise<boolean>>(async () => false);
    const wrongVerify = vi.fn<(hash: string, password: string) => Promise<boolean>>(async () => false);
    const common = { consumeRateLimit: vi.fn(async () => true) };
    const unknown = createCredentialAuthorizer({
      ...common,
      findActiveUserByEmail: vi.fn(async () => null),
      verify: unknownVerify,
    });
    const wrong = createCredentialAuthorizer({
      ...common,
      findActiveUserByEmail: vi.fn(async () => ({
        id: "admin-1",
        email: "admin@example.test",
        name: "Admin",
        passwordHash: "real-hash",
        role: "ADMIN" as const,
        updatedAt: new Date("2026-08-08T10:00:00.000Z"),
      })),
      verify: wrongVerify,
    });

    await expect(unknown({ email: "missing@example.test", password: "guess" }, {})).resolves.toBeNull();
    await expect(wrong({ email: "admin@example.test", password: "guess" }, {})).resolves.toBeNull();
    expect(unknownVerify).toHaveBeenCalledTimes(1);
    expect(unknownVerify.mock.calls[0]?.[0]).not.toBe("real-hash");
    expect(wrongVerify).toHaveBeenCalledOnce();
    expect(wrongVerify).toHaveBeenCalledWith("real-hash", "guess");
  });

  it("returns the same public result when persistent throttling denies a valid password", async () => {
    const verify = vi.fn(async () => true);
    const authorize = createCredentialAuthorizer({
      findActiveUserByEmail: vi.fn(async () => ({
        id: "admin-1",
        email: "admin@example.test",
        name: "Admin",
        passwordHash: "real-hash",
        role: "ADMIN" as const,
        updatedAt: new Date("2026-08-08T10:00:00.000Z"),
      })),
      verify,
      consumeRateLimit: vi.fn(async () => false),
    });

    await expect(authorize({ email: "admin@example.test", password: "correct" }, {})).resolves.toBeNull();
    expect(verify).toHaveBeenCalledWith("real-hash", "correct");
  });
});

describe("persistent authentication rate limiting", () => {
  it("canonicalizes identity and consumes pair, email, and trusted-IP buckets", async () => {
    const adapter: AuthRateLimitAdapter = { consume: vi.fn(async () => true) };
    const now = new Date("2026-08-08T10:00:00.000Z");

    await expect(applyAuthRateLimits(adapter, {
      email: " Admin@Example.TEST ",
      ip: "2001:db8::1",
      now,
      secret: "12345678901234567890123456789012",
    })).resolves.toBe(true);

    expect(adapter.consume).toHaveBeenCalledTimes(3);
    expect(vi.mocked(adapter.consume).mock.calls.map(([input]) => input)).toEqual([
      expect.objectContaining({ limit: 5, windowSeconds: 900, now }),
      expect.objectContaining({ limit: 20, windowSeconds: 3600, now }),
      expect.objectContaining({ limit: 50, windowSeconds: 3600, now }),
    ]);
  });

  it("keeps email limiting when no trusted client IP is available", async () => {
    const adapter: AuthRateLimitAdapter = { consume: vi.fn(async () => true) };

    await applyAuthRateLimits(adapter, {
      email: normalizeEmail("Admin@Example.test"),
      now: new Date("2026-08-08T10:00:00.000Z"),
      secret: "12345678901234567890123456789012",
    });

    expect(adapter.consume).toHaveBeenCalledTimes(1);
  });
});
