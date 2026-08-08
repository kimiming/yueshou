import { afterEach, describe, expect, it, vi } from "vitest";

const { processDueMediaDeletionJobs, createObjectStorage, parseEnv } = vi.hoisted(() => ({
  processDueMediaDeletionJobs: vi.fn(async () => ({ processed: 1, failed: 0 })),
  createObjectStorage: vi.fn(() => ({ deleteObject: vi.fn() })),
  parseEnv: vi.fn(() => ({ STORAGE_BACKEND: "LOCAL" })),
}));

vi.mock("@/features/media/deletion-worker", () => ({ processDueMediaDeletionJobs }));
vi.mock("@/features/media/repository", () => ({ prismaMediaDeletionJobRepository: {} }));
vi.mock("@/lib/storage", () => ({ createObjectStorage }));
vi.mock("@/lib/env", () => ({ parseEnv }));

import { GET, POST } from "@/app/api/internal/media-deletion-jobs/route";

describe("media deletion cron route", () => {
  const originalSecret = process.env.CRON_SECRET;

  afterEach(() => {
    processDueMediaDeletionJobs.mockClear();
    if (originalSecret === undefined) delete process.env.CRON_SECRET;
    else process.env.CRON_SECRET = originalSecret;
  });

  it("fails closed without a matching signed POST request", async () => {
    process.env.CRON_SECRET = "a".repeat(32);

    const response = await POST(new Request("https://example.test/api/internal/media-deletion-jobs", { method: "POST", headers: { authorization: "Bearer wrong-secret" } }));

    expect(response.status).toBe(404);
    expect(processDueMediaDeletionJobs).not.toHaveBeenCalled();
  });

  it("processes one due job for Vercel's exact GET bearer secret without caching", async () => {
    process.env.CRON_SECRET = "a".repeat(32);

    const response = await GET(new Request("https://example.test/api/internal/media-deletion-jobs", { headers: { authorization: `Bearer ${process.env.CRON_SECRET}` } }));

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ processed: 1, failed: 0 });
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(processDueMediaDeletionJobs).toHaveBeenCalledOnce();
  });
});
