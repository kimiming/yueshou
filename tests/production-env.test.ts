import { readFile } from "node:fs/promises";
import { parse as parseDotenv } from "dotenv";

import { describe, expect, it } from "vitest";

import { parseProductionEnv } from "@/lib/production-env";

const completeCloudEnvironment = {
  NODE_ENV: "production",
  DATABASE_URL: "postgresql://postgres:pooled-password@aws-0-us-east-1.pooler.supabase.com:6543/postgres?pgbouncer=true",
  DIRECT_URL: "postgresql://postgres:direct-password@db.project-ref.supabase.co:5432/postgres",
  AUTH_SECRET: "a".repeat(32),
  INQUIRY_HASH_SECRET: "b".repeat(32),
  CRON_SECRET: "c".repeat(32),
  INQUIRY_PROXY_MODE: "vercel",
  STORAGE_BACKEND: "r2",
  STORAGE_ENDPOINT: "https://account-id.r2.cloudflarestorage.com",
  STORAGE_REGION: "auto",
  STORAGE_BUCKET: "yueshou-private-production",
  STORAGE_ACCESS_KEY_ID: "r2-access-key",
  STORAGE_SECRET_ACCESS_KEY: "r2-secret-key",
  NEXT_PUBLIC_SITE_URL: "https://www.yueshou.test",
  NEXT_PUBLIC_R2_PUBLIC_URL: "https://media.yueshou.test",
};

describe("production cloud environment", () => {
  it.each([
    "DATABASE_URL",
    "AUTH_SECRET",
    "INQUIRY_HASH_SECRET",
    "CRON_SECRET",
    "STORAGE_ENDPOINT",
    "STORAGE_BUCKET",
    "STORAGE_ACCESS_KEY_ID",
    "STORAGE_SECRET_ACCESS_KEY",
    "NEXT_PUBLIC_SITE_URL",
    "NEXT_PUBLIC_R2_PUBLIC_URL",
  ] as const)("fails fast when %s is missing", (key) => {
    const input = { ...completeCloudEnvironment, [key]: undefined };

    expect(() => parseProductionEnv(input)).toThrow(key);
  });

  it("accepts a complete Supabase and R2 production fixture", () => {
    expect(parseProductionEnv(completeCloudEnvironment)).toMatchObject({
      DATABASE_URL: completeCloudEnvironment.DATABASE_URL,
      DIRECT_URL: completeCloudEnvironment.DIRECT_URL,
      STORAGE_BACKEND: "r2",
      INQUIRY_PROXY_MODE: "vercel",
    });
  });

  it("does not require a migration-only direct URL for Vercel build validation", () => {
    const runtimeOnlyEnvironment = { ...completeCloudEnvironment, DIRECT_URL: undefined };

    expect(parseProductionEnv(runtimeOnlyEnvironment)).toMatchObject({ DATABASE_URL: completeCloudEnvironment.DATABASE_URL });
  });

  it("rejects weak secrets, direct proxying, and R2 development URLs", () => {
    expect(() => parseProductionEnv({ ...completeCloudEnvironment, AUTH_SECRET: "short" })).toThrow("AUTH_SECRET");
    expect(() => parseProductionEnv({ ...completeCloudEnvironment, CRON_SECRET: "short" })).toThrow("CRON_SECRET");
    expect(() => parseProductionEnv({ ...completeCloudEnvironment, INQUIRY_PROXY_MODE: "direct" })).toThrow("INQUIRY_PROXY_MODE");
    expect(() => parseProductionEnv({ ...completeCloudEnvironment, NEXT_PUBLIC_R2_PUBLIC_URL: "https://bucket.r2.dev" })).toThrow("NEXT_PUBLIC_R2_PUBLIC_URL");
    expect(() => parseProductionEnv({ ...completeCloudEnvironment, NEXT_PUBLIC_SITE_URL: "http://www.yueshou.example" })).toThrow("NEXT_PUBLIC_SITE_URL");
    expect(() => parseProductionEnv({ ...completeCloudEnvironment, DATABASE_URL: "https://database.example" })).toThrow("DATABASE_URL");
    expect(() => parseProductionEnv({ ...completeCloudEnvironment, DIRECT_URL: "https://database.example" })).toThrow("DIRECT_URL");
  });

  it("rejects placeholder values, duplicate secrets, non-R2 storage, and an insecure storage endpoint", () => {
    expect(() => parseProductionEnv({ ...completeCloudEnvironment, STORAGE_ACCESS_KEY_ID: "replace-with-key" })).toThrow("STORAGE_ACCESS_KEY_ID");
    expect(() => parseProductionEnv({ ...completeCloudEnvironment, AUTH_SECRET: completeCloudEnvironment.CRON_SECRET })).toThrow("AUTH_SECRET");
    expect(() => parseProductionEnv({ ...completeCloudEnvironment, STORAGE_BACKEND: "minio" })).toThrow("STORAGE_BACKEND");
    expect(() => parseProductionEnv({ ...completeCloudEnvironment, STORAGE_ENDPOINT: "http://account-id.r2.cloudflarestorage.com" })).toThrow("STORAGE_ENDPOINT");
  });

  it("documents all production values without committing secrets", async () => {
    const example = await readFile(".env.example", "utf8");

    for (const key of Object.keys(completeCloudEnvironment)) {
      expect(example).toContain(`${key}=`);
    }
    expect(example).not.toContain(completeCloudEnvironment.AUTH_SECRET);
    expect(example).not.toContain(completeCloudEnvironment.STORAGE_SECRET_ACCESS_KEY);
  });

  it("intentionally rejects the non-secret placeholder template", async () => {
    const template = parseDotenv(await readFile(".env.example", "utf8"));

    expect(() => parseProductionEnv(template)).toThrow();
  });
});
