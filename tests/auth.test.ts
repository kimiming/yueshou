import { createHmac } from "node:crypto";
import { describe, expect, it, vi } from "vitest";

import {
  applyAuthRateLimits,
  createCredentialAuthorizer,
  normalizeEmail,
  recordAuthenticationAudit,
  resolveAuthenticationIp,
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

  it("audits successful, failed, and throttled credential outcomes without passing passwords", async () => {
    const auditLogin = vi.fn(async (event: { outcome: "SUCCESS" | "FAILED" | "THROTTLED"; actorId?: string; email: string; ip: string; occurredAt: Date }) => { void event; });
    const user = {
      id: "admin-1",
      email: "admin@example.test",
      name: "Admin",
      passwordHash: "real-hash",
      role: "ADMIN" as const,
      updatedAt: new Date("2026-08-08T10:00:00.000Z"),
    };
    const authorizeSuccess = createCredentialAuthorizer({
      auditLogin,
      consumeRateLimit: vi.fn(async () => true),
      findActiveUserByEmail: vi.fn(async () => user),
      verify: vi.fn(async () => true),
    });
    const authorizeFailure = createCredentialAuthorizer({
      auditLogin,
      consumeRateLimit: vi.fn(async () => true),
      findActiveUserByEmail: vi.fn(async () => null),
      verify: vi.fn(async () => false),
    });
    const authorizeThrottled = createCredentialAuthorizer({
      auditLogin,
      consumeRateLimit: vi.fn(async () => false),
      findActiveUserByEmail: vi.fn(async () => user),
      verify: vi.fn(async () => true),
    });

    await authorizeSuccess({ email: " Admin@Example.test ", password: "success-secret" }, { ip: "203.0.113.8" });
    await authorizeFailure({ email: "missing@example.test", password: "failure-secret" }, { ip: "203.0.113.8" });
    await authorizeThrottled({ email: "admin@example.test", password: "throttled-secret" }, { ip: "203.0.113.8" });

    expect(auditLogin.mock.calls.map(([event]) => event)).toEqual([
      expect.objectContaining({ outcome: "SUCCESS", actorId: "admin-1", email: "admin@example.test", ip: "203.0.113.8" }),
      expect.objectContaining({ outcome: "FAILED", email: "missing@example.test", ip: "203.0.113.8" }),
      expect.objectContaining({ outcome: "THROTTLED", email: "admin@example.test", ip: "203.0.113.8" }),
    ]);
    expect(JSON.stringify(auditLogin.mock.calls)).not.toContain("success-secret");
    expect(JSON.stringify(auditLogin.mock.calls)).not.toContain("failure-secret");
    expect(JSON.stringify(auditLogin.mock.calls)).not.toContain("throttled-secret");
  });

  it("stores only keyed identity digests in authentication audit metadata", async () => {
    const create = vi.fn(async (input: { data: { actorId: string | null; action: string; entityType: string; entityId?: string; metadata: Record<string, string> } }) => { void input; return { id: "audit-1" }; });
    await recordAuthenticationAudit({ auditLog: { create } }, {
      outcome: "FAILED",
      email: "admin@example.test",
      ip: "203.0.113.8",
      occurredAt: new Date("2026-08-08T10:00:00.000Z"),
      secret: "12345678901234567890123456789012",
    });

    const persisted = JSON.stringify(create.mock.calls[0]?.[0]);
    expect(persisted).not.toContain("admin@example.test");
    expect(persisted).not.toContain("203.0.113.8");
    expect(create).toHaveBeenCalledWith({ data: expect.objectContaining({
      actorId: null,
      action: "AUTH_LOGIN_FAILED",
      entityType: "Authentication",
      metadata: expect.objectContaining({ emailDigest: expect.any(String), ipDigest: expect.any(String) }),
    }) });
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

    await expect(unknown(
      { email: "missing@example.test", password: "guess" },
      { ip: "203.0.113.8" },
    )).resolves.toBeNull();
    await expect(wrong(
      { email: "admin@example.test", password: "guess" },
      { ip: "203.0.113.8" },
    )).resolves.toBeNull();
    expect(unknownVerify).toHaveBeenCalledTimes(1);
    expect(unknownVerify.mock.calls[0]?.[0]).not.toBe("real-hash");
    expect(wrongVerify).toHaveBeenCalledOnce();
    expect(wrongVerify).toHaveBeenCalledWith("real-hash", "guess");
  });

  it("returns the same public result without password work when persistent throttling denies a login", async () => {
    const verify = vi.fn(async () => true);
    const findActiveUserByEmail = vi.fn(async () => ({
      id: "admin-1",
      email: "admin@example.test",
      name: "Admin",
      passwordHash: "real-hash",
      role: "ADMIN" as const,
      updatedAt: new Date("2026-08-08T10:00:00.000Z"),
    }));
    const authorize = createCredentialAuthorizer({
      findActiveUserByEmail,
      verify,
      consumeRateLimit: vi.fn(async () => false),
    });

    await expect(authorize(
      { email: "admin@example.test", password: "correct" },
      { ip: "203.0.113.8" },
    )).resolves.toBeNull();
    expect(findActiveUserByEmail).not.toHaveBeenCalled();
    expect(verify).not.toHaveBeenCalled();
  });

  it("fails closed before persistent, lookup, or password work when client IP is unavailable", async () => {
    const consumeRateLimit = vi.fn(async () => true);
    const findActiveUserByEmail = vi.fn();
    const verify = vi.fn();
    const authorize = createCredentialAuthorizer({ consumeRateLimit, findActiveUserByEmail, verify });

    await expect(authorize(
      { email: "admin@example.test", password: "guess" },
      {},
    )).resolves.toBeNull();
    expect(consumeRateLimit).not.toHaveBeenCalled();
    expect(findActiveUserByEmail).not.toHaveBeenCalled();
    expect(verify).not.toHaveBeenCalled();
  });
});

describe("persistent authentication rate limiting", () => {
  it("canonicalizes identity and consumes trusted-IP, email, and pair buckets in that order", async () => {
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
      expect.objectContaining({ limit: 50, windowSeconds: 3600, now }),
      expect.objectContaining({ limit: 20, windowSeconds: 3600, now }),
      expect.objectContaining({ limit: 5, windowSeconds: 900, now }),
    ]);
  });

  it("short-circuits broader denied buckets before consuming narrower identities", async () => {
    const consume = vi.fn()
      .mockResolvedValueOnce(true)
      .mockResolvedValueOnce(false)
      .mockResolvedValueOnce(true);

    await expect(applyAuthRateLimits({ consume }, {
      email: "admin@example.test",
      ip: "203.0.113.8",
      now: new Date("2026-08-08T10:00:00.000Z"),
      secret: "12345678901234567890123456789012",
    })).resolves.toBe(false);

    expect(consume).toHaveBeenCalledTimes(2);
    expect(consume.mock.calls.map(([input]) => input.limit)).toEqual([50, 20]);
  });

  it.each([
    ["vercel", {}, "production"],
    ["vercel", { "x-vercel-forwarded-for": "malformed" }, "production"],
    ["nginx", {}, "production"],
    ["nginx", { "x-real-ip": "198.51.100.7, 203.0.113.8" }, "production"],
    ["direct", { "x-real-ip": "203.0.113.8" }, "production"],
  ] as const)("denies %s authentication without one canonical trusted IP", (proxyMode, headers, nodeEnv) => {
    expect(resolveAuthenticationIp({ proxyMode, headers, nodeEnv })).toBeUndefined();
  });

  it("uses an isolated development-only identity for direct mode", () => {
    expect(resolveAuthenticationIp({
      proxyMode: "direct",
      headers: { "x-real-ip": "203.0.113.8" },
      nodeEnv: "development",
    })).toBe("development-direct");
  });

  it.each([
    ["vercel", { "x-vercel-forwarded-for": "2001:0db8:0:0:0:0:0:1" }, "2001:db8::1"],
    ["nginx", { "x-real-ip": "203.0.113.8" }, "203.0.113.8"],
  ] as const)("creates pair, email, and IP buckets for valid %s logins", async (proxyMode, headers, expectedIp) => {
    const adapter: AuthRateLimitAdapter = { consume: vi.fn(async () => true) };
    const secret = "12345678901234567890123456789012";
    const email = normalizeEmail(" Admin@Example.TEST ");
    const ip = resolveAuthenticationIp({ proxyMode, headers, nodeEnv: "production" });
    const digest = (value: string) => createHmac("sha256", secret).update(value).digest("hex");

    expect(ip).toBe(expectedIp);
    await expect(applyAuthRateLimits(adapter, {
      email,
      ip: ip!,
      now: new Date("2026-08-08T10:00:00.000Z"),
      secret,
    })).resolves.toBe(true);
    expect(vi.mocked(adapter.consume).mock.calls.map(([input]) => input.key)).toEqual([
      digest(`auth:ip:${expectedIp}`),
      digest("auth:email:admin@example.test"),
      digest(`auth:pair:${expectedIp}\nadmin@example.test`),
    ]);
    expect(vi.mocked(adapter.consume).mock.calls.map(([input]) => input.key).join(" ")).not.toContain(expectedIp);
  });
});
