import { afterEach, describe, expect, it, vi } from "vitest";

const { runStorageMaintenance, createObjectStorage, parseEnv } = vi.hoisted(() => ({
  runStorageMaintenance: vi.fn(async () => ({
    sweep: { intentsQueued: 2, sessionsDeleted: 1, rateLimitsDeleted: 5 },
    deletion: { processed: 2, failed: 0, cancelled: 0 },
  })),
  createObjectStorage: vi.fn(() => ({ deleteObject: vi.fn() })),
  parseEnv: vi.fn(() => ({ STORAGE_BACKEND: "minio" })),
}));

vi.mock("@/features/storage-cleanup/service", () => ({ runStorageMaintenance }));
vi.mock("@/features/storage-cleanup/repository", () => ({ prismaStorageDeletionRepository: {} }));
vi.mock("@/lib/storage", () => ({ createObjectStorage }));
vi.mock("@/lib/env", () => ({ parseEnv }));

import { GET, POST } from "@/app/api/internal/storage-maintenance/route";

describe("storage maintenance cron route", () => {
  const originalSecret = process.env.CRON_SECRET;

  afterEach(() => {
    runStorageMaintenance.mockClear();
    if (originalSecret === undefined) delete process.env.CRON_SECRET;
    else process.env.CRON_SECRET = originalSecret;
  });

  it("fails closed without a valid signed Docker request", async () => {
    process.env.CRON_SECRET = "a".repeat(32);
    const response = await POST(new Request("https://example.test/api/internal/storage-maintenance", {
      method: "POST",
      headers: { authorization: `Bearer ${process.env.CRON_SECRET}` },
    }));
    expect(response.status).toBe(404);
    expect(runStorageMaintenance).not.toHaveBeenCalled();
  });

  it("runs bounded maintenance for Vercel GET requests", async () => {
    process.env.CRON_SECRET = "a".repeat(32);
    const response = await GET(new Request("https://example.test/api/internal/storage-maintenance", {
      headers: { authorization: `Bearer ${process.env.CRON_SECRET}` },
    }));
    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(runStorageMaintenance).toHaveBeenCalledWith(expect.objectContaining({
      sweepLimit: 100,
      deletionLimit: 25,
    }));
  });
});
