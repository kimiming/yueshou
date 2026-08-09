import { mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { describe, expect, it, vi } from "vitest";

import { runE2eDatabaseLifecycle } from "@/lib/e2e/database-lifecycle";
import {
  readE2eMutationFixture,
  resolveE2eMutationFixture,
} from "@/lib/e2e/mutation-fixture";
import { createE2eReleaseConfig } from "@/lib/e2e/release-config";

const valid = {
  E2E_REQUIRED: "1", E2E_MUTATION_TESTS: "1", E2E_CONFIRM_DATABASE_RESET: "RESET_YUESHOU_E2E",
  E2E_DATABASE_URL: "postgresql://tester:password@127.0.0.1:5432/yueshou_e2e",
  E2E_AUTH_SECRET: "a".repeat(64), E2E_INQUIRY_HASH_SECRET: "b".repeat(64),
  E2E_STORAGE_ENDPOINT: "http://127.0.0.1:9000", E2E_STORAGE_BUCKET: "yueshou-e2e",
  E2E_STORAGE_ACCESS_KEY_ID: "access", E2E_STORAGE_SECRET_ACCESS_KEY: "secret",
  E2E_ADMIN_EMAIL: "admin@example.test", E2E_ADMIN_PASSWORD: "A-test-password-123!",
};

describe("E2E release configuration", () => {
  it("fails closed when the explicit release flag or storage fixture is absent", () => {
    expect(() => createE2eReleaseConfig({ ...valid, E2E_REQUIRED: undefined })).toThrow(/E2E_REQUIRED=1/);
    expect(() => createE2eReleaseConfig({ ...valid, E2E_MUTATION_TESTS: undefined })).toThrow(/E2E_MUTATION_TESTS=1/);
    expect(() => createE2eReleaseConfig({ ...valid, E2E_STORAGE_BUCKET: undefined })).toThrow(/E2E_STORAGE_BUCKET/);
  });

  it("keeps ordinary test:e2e read-only even when every mutation variable is present", async () => {
    try {
      for (const [key, value] of Object.entries(valid)) vi.stubEnv(key, value);
      vi.stubEnv("E2E_REQUIRED", "");
      vi.resetModules();

      const fixture = await import("@/e2e/fixtures/database");

      expect(fixture.hasE2eMutationFixture).toBe(false);
    } finally {
      vi.unstubAllEnvs();
      vi.resetModules();
    }
  });

  it("rejects production-looking hosts and database names", () => {
    expect(() => createE2eReleaseConfig({ ...valid, E2E_DATABASE_URL: "postgresql://a:b@db.production.example:5432/yueshou_e2e" })).toThrow(/host/);
    expect(() => createE2eReleaseConfig({ ...valid, E2E_DATABASE_URL: "postgresql://a:b@127.0.0.1:5432/yueshou" })).toThrow(/_e2e/);
    expect(() => createE2eReleaseConfig({ ...valid, E2E_STORAGE_ENDPOINT: "https://objects.production.example" })).toThrow(/storage endpoint/i);
    expect(() => createE2eReleaseConfig({ ...valid, E2E_STORAGE_BUCKET: "yueshou-media" })).toThrow(/storage bucket/i);
  });

  it("requires an exact destructive-reset confirmation and returns a safe runtime environment", () => {
    const config = createE2eReleaseConfig(valid);
    expect(config.runtime.NODE_ENV).toBe("production");
    expect(config.runtime.DATABASE_URL).toBe(valid.E2E_DATABASE_URL);
    expect(config.databaseName).toBe("yueshou_e2e");
    expect(config).not.toHaveProperty("mutationFixture");
  });
});

describe("post-reset E2E mutation fixture", () => {
  it("resolves generated IDs from stable post-seed storage keys and slugs", async () => {
    const fixture = await resolveE2eMutationFixture({
      findPublishedMediaByStorageKey: vi.fn(async (storageKey) => ({
        id: storageKey.includes("logo") ? "media-logo" : "media-hero",
      })),
      findPublishedPageBySlug: vi.fn(async () => ({ id: "page-home" })),
      findPublishedArticleBySlug: vi.fn(async () => ({ id: "article-release", slug: "e2e-release-article" })),
    });

    expect(fixture).toEqual({
      logoMediaId: "media-logo",
      heroMediaId: "media-hero",
      homePageId: "page-home",
      articleId: "article-release",
      articleSlug: "e2e-release-article",
    });
  });

  it("fails closed when the post-seed fixture is incomplete", async () => {
    await expect(resolveE2eMutationFixture({
      findPublishedMediaByStorageKey: vi.fn(async () => null),
      findPublishedPageBySlug: vi.fn(async () => ({ id: "page-home" })),
      findPublishedArticleBySlug: vi.fn(async () => ({ id: "article-release", slug: "e2e-release-article" })),
    })).rejects.toThrow(/logo/i);
  });

  it("loads only a complete resolver-produced fixture file", async () => {
    const directory = await mkdtemp(join(tmpdir(), "yueshou-e2e-fixture-"));
    const path = join(directory, "fixture.json");
    await writeFile(path, JSON.stringify({
      logoMediaId: "media-logo",
      heroMediaId: "media-hero",
      homePageId: "page-home",
      articleId: "article-release",
      articleSlug: "e2e-release-article",
    }), "utf8");

    expect(readE2eMutationFixture(path)).toMatchObject({ articleSlug: "e2e-release-article" });
    await writeFile(path, JSON.stringify({ logoMediaId: "media-logo" }), "utf8");
    expect(() => readE2eMutationFixture(path)).toThrow(/fixture/i);
  });
});

describe("E2E database lifecycle", () => {
  it("authenticates the durable database marker before every reset and leaves a seeded fixture after teardown", async () => {
    const events: string[] = [];
    const lifecycle = {
      authenticate: async () => { events.push("authenticate"); },
      reset: () => { events.push("reset"); },
      seedDatabase: () => { events.push("seed-database"); },
      seedStorage: () => { events.push("seed-storage"); },
      resolveFixture: async () => {
        events.push("resolve-fixture");
        return { logoMediaId: "logo", heroMediaId: "hero", homePageId: "home", articleId: "article", articleSlug: "e2e-release-article" as const };
      },
    };

    await runE2eDatabaseLifecycle(lifecycle, "setup");
    await runE2eDatabaseLifecycle(lifecycle, "teardown");
    await runE2eDatabaseLifecycle(lifecycle, "setup");
    await runE2eDatabaseLifecycle(lifecycle, "teardown");

    expect(events).toEqual([
      "authenticate", "reset", "seed-database", "seed-storage", "resolve-fixture",
      "authenticate", "reset", "seed-database", "seed-storage", "resolve-fixture",
      "authenticate", "reset", "seed-database", "seed-storage", "resolve-fixture",
      "authenticate", "reset", "seed-database", "seed-storage", "resolve-fixture",
    ]);
  });

  it("does not reset when durable database authentication fails", async () => {
    const reset = vi.fn();
    await expect(runE2eDatabaseLifecycle({
      authenticate: async () => { throw new Error("marker missing"); },
      reset,
      seedDatabase: vi.fn(),
      seedStorage: vi.fn(),
      resolveFixture: vi.fn(),
    }, "setup")).rejects.toThrow("marker missing");
    expect(reset).not.toHaveBeenCalled();
  });
});
