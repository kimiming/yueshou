import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const root = process.cwd();

describe("storage cleanup persistence and scheduling", () => {
  it("defines durable generic deletion jobs and bounded dead-letter media jobs", () => {
    const schema = readFileSync(join(root, "prisma/schema.prisma"), "utf8");
    expect(schema).toMatch(/enum StorageDeletionJobStatus[\s\S]*DEAD_LETTER/);
    expect(schema).toMatch(/model StorageDeletionJob[\s\S]*storageKey\s+String\s+@unique/);
    expect(schema).toMatch(/model StorageDeletionJob[\s\S]*maxAttempts\s+Int\s+@default\(8\)/);
    expect(schema).toMatch(/model MediaDeletionJob[\s\S]*maxAttempts\s+Int\s+@default\(8\)/);
    expect(schema).toMatch(/model MediaUploadIntent[\s\S]*finalStorageKey\s+String\?\s+@unique/);
  });

  it("runs storage maintenance on both deployment targets", () => {
    const vercel = readFileSync(join(root, "vercel.json"), "utf8");
    const cron = readFileSync(join(root, "deploy/ops/cron-runner.mjs"), "utf8");
    expect(vercel).toContain("/api/internal/storage-maintenance");
    expect(cron).toContain("/api/internal/storage-maintenance");
  });
});
