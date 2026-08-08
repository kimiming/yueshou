import { afterEach, describe, expect, it, vi } from "vitest";

const { publishDueContent, invalidatePublishedEntity } = vi.hoisted(() => ({
  publishDueContent: vi.fn(async () => ({ articles: [], products: [] })),
  invalidatePublishedEntity: vi.fn(),
}));

vi.mock("@/features/admin/domain-repository", () => ({ publishDueContent }));
vi.mock("@/features/publishing/cache", () => ({ invalidatePublishedEntity }));

import { GET } from "@/app/api/internal/publish-scheduled/route";

describe("Vercel scheduled publication adapter", () => {
  const originalSecret = process.env.CRON_SECRET;

  afterEach(() => {
    publishDueContent.mockClear();
    invalidatePublishedEntity.mockClear();
    if (originalSecret === undefined) delete process.env.CRON_SECRET;
    else process.env.CRON_SECRET = originalSecret;
  });

  it("accepts Vercel's protected GET invocation without loosening POST HMAC authentication", async () => {
    process.env.CRON_SECRET = "a".repeat(32);
    const response = await GET(new Request("https://example.test/api/internal/publish-scheduled", {
      headers: { authorization: `Bearer ${process.env.CRON_SECRET}` },
    }));

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ articles: 0, products: 0 });
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(publishDueContent).toHaveBeenCalledOnce();
  });

  it("rejects an unauthenticated Vercel GET", async () => {
    process.env.CRON_SECRET = "a".repeat(32);
    const response = await GET(new Request("https://example.test/api/internal/publish-scheduled"));

    expect(response.status).toBe(401);
    expect(publishDueContent).not.toHaveBeenCalled();
  });
});
