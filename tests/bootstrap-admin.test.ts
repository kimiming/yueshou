import { describe, expect, it, vi } from "vitest";

import { createBootstrapAdmin, parseBootstrapAdmin } from "../prisma/bootstrap-admin";

const valid = {
  INITIAL_ADMIN_EMAIL: "admin@yueshou.test",
  INITIAL_ADMIN_PASSWORD: "Strong!Passw0rd",
  BOOTSTRAP_ADMIN_CONFIRM: "I_UNDERSTAND_BOOTSTRAP_ADMIN",
};

describe("seed administrator bootstrap", () => {
  it("allows content-only seed when no bootstrap values were supplied", () => {
    expect(parseBootstrapAdmin({ NODE_ENV: "production" })).toBeNull();
  });

  it("requires a complete, explicitly confirmed, strong administrator credential set", () => {
    expect(parseBootstrapAdmin({ ...valid, NODE_ENV: "production" })).toEqual({ email: valid.INITIAL_ADMIN_EMAIL, password: valid.INITIAL_ADMIN_PASSWORD });
    expect(() => parseBootstrapAdmin({ ...valid, NODE_ENV: "production", BOOTSTRAP_ADMIN_CONFIRM: "yes" })).toThrow("BOOTSTRAP_ADMIN_CONFIRM");
    expect(() => parseBootstrapAdmin({ ...valid, NODE_ENV: "production", INITIAL_ADMIN_EMAIL: "not-an-email" })).toThrow("INITIAL_ADMIN_EMAIL");
    expect(() => parseBootstrapAdmin({ ...valid, NODE_ENV: "production", INITIAL_ADMIN_PASSWORD: "replace-me" })).toThrow("INITIAL_ADMIN_PASSWORD");
    expect(() => parseBootstrapAdmin({ ...valid, NODE_ENV: "production", INITIAL_ADMIN_PASSWORD: "Weakpass" })).toThrow("INITIAL_ADMIN_PASSWORD");
    expect(() => parseBootstrapAdmin({ NODE_ENV: "production", INITIAL_ADMIN_EMAIL: valid.INITIAL_ADMIN_EMAIL })).toThrow("INITIAL_ADMIN_PASSWORD");
  });

  it("creates exactly one new administrator and never updates, restores, or promotes an existing account", async () => {
    const transaction = {
      $executeRaw: vi.fn(async () => 0),
      $queryRaw: vi.fn(async () => []),
      user: {
        findFirst: vi.fn(async () => null),
        findUnique: vi.fn(async () => null),
        create: vi.fn(async () => ({ id: "admin-1" })),
      },
    };

    await createBootstrapAdmin(transaction as never, { email: valid.INITIAL_ADMIN_EMAIL, passwordHash: "argon2-hash" });

    expect(transaction.$executeRaw).toHaveBeenCalledTimes(1);
    expect(transaction.$queryRaw).not.toHaveBeenCalled();
    expect(transaction.user.create).toHaveBeenCalledWith({ data: { email: valid.INITIAL_ADMIN_EMAIL, passwordHash: "argon2-hash", role: "ADMIN" } });
    expect(transaction.user).not.toHaveProperty("upsert");
  });

  it.each([
    ["an existing administrator", { id: "admin-existing" }, null],
    ["an existing email", null, { id: "user-existing" }],
  ])("fails closed for %s without mutating users", async (_name, existingAdmin, existingEmail) => {
    const transaction = {
      $executeRaw: vi.fn(async () => 0),
      $queryRaw: vi.fn(async () => []),
      user: {
        findFirst: vi.fn(async () => existingAdmin),
        findUnique: vi.fn(async () => existingEmail),
        create: vi.fn(),
      },
    };

    await expect(createBootstrapAdmin(transaction as never, { email: valid.INITIAL_ADMIN_EMAIL, passwordHash: "argon2-hash" })).rejects.toThrow("bootstrap_admin_exists");
    expect(transaction.$executeRaw).toHaveBeenCalledTimes(1);
    expect(transaction.$queryRaw).not.toHaveBeenCalled();
    expect(transaction.user.create).not.toHaveBeenCalled();
  });
});
