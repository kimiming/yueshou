import { describe, expect, it, vi } from "vitest";

import { runE2eDatabaseLifecycle } from "@/lib/e2e/database-lifecycle";
import { createE2eReleaseConfig } from "@/lib/e2e/release-config";

const valid = {
  E2E_REQUIRED: "1", E2E_MUTATION_TESTS: "1", E2E_CONFIRM_DATABASE_RESET: "RESET_YUESHOU_E2E",
  E2E_DATABASE_URL: "postgresql://tester:password@127.0.0.1:5432/yueshou_e2e",
  E2E_AUTH_SECRET: "a".repeat(64), E2E_INQUIRY_HASH_SECRET: "b".repeat(64),
  E2E_STORAGE_ENDPOINT: "http://127.0.0.1:9000", E2E_STORAGE_BUCKET: "yueshou-e2e",
  E2E_STORAGE_ACCESS_KEY_ID: "access", E2E_STORAGE_SECRET_ACCESS_KEY: "secret",
  E2E_ADMIN_EMAIL: "admin@example.test", E2E_ADMIN_PASSWORD: "A-test-password-123!",
  E2E_PUBLIC_MEDIA_ID: "ck123456789012345678901234", E2E_HOME_PAGE_ID: "ck123456789012345678901235",
  E2E_HERO_MEDIA_ID: "ck123456789012345678901237",
  E2E_ARTICLE_ID: "ck123456789012345678901236", E2E_ARTICLE_SLUG: "e2e-article",
};

describe("E2E release configuration", () => {
  it("fails closed when the explicit release flag or mutation fixture is absent", () => {
    expect(() => createE2eReleaseConfig({ ...valid, E2E_REQUIRED: undefined })).toThrow(/E2E_REQUIRED=1/);
    expect(() => createE2eReleaseConfig({ ...valid, E2E_MUTATION_TESTS: undefined })).toThrow(/E2E_MUTATION_TESTS=1/);
    expect(() => createE2eReleaseConfig({ ...valid, E2E_HERO_MEDIA_ID: undefined })).toThrow(/E2E_HERO_MEDIA_ID/);
  });

  it("rejects production-looking hosts and database names", () => {
    expect(() => createE2eReleaseConfig({ ...valid, E2E_DATABASE_URL: "postgresql://a:b@db.production.example:5432/yueshou_e2e" })).toThrow(/host/);
    expect(() => createE2eReleaseConfig({ ...valid, E2E_DATABASE_URL: "postgresql://a:b@127.0.0.1:5432/yueshou" })).toThrow(/_e2e/);
  });

  it("requires an exact destructive-reset confirmation and returns a safe runtime environment", () => {
    const config = createE2eReleaseConfig(valid);
    expect(config.runtime.NODE_ENV).toBe("production");
    expect(config.runtime.DATABASE_URL).toBe(valid.E2E_DATABASE_URL);
    expect(config.databaseName).toBe("yueshou_e2e");
  });
});

describe("E2E database lifecycle", () => {
  it("authenticates the durable database marker before every reset and leaves a seeded fixture after teardown", async () => {
    const events: string[] = [];
    const lifecycle = {
      authenticate: async () => { events.push("authenticate"); },
      reset: () => { events.push("reset"); },
      seed: () => { events.push("seed"); },
    };

    await runE2eDatabaseLifecycle(lifecycle, "setup");
    await runE2eDatabaseLifecycle(lifecycle, "teardown");
    await runE2eDatabaseLifecycle(lifecycle, "setup");

    expect(events).toEqual([
      "authenticate", "reset", "seed",
      "authenticate", "reset", "seed",
      "authenticate", "reset", "seed",
    ]);
  });

  it("does not reset when durable database authentication fails", async () => {
    const reset = vi.fn();
    await expect(runE2eDatabaseLifecycle({
      authenticate: async () => { throw new Error("marker missing"); },
      reset,
      seed: vi.fn(),
    }, "setup")).rejects.toThrow("marker missing");
    expect(reset).not.toHaveBeenCalled();
  });
});
