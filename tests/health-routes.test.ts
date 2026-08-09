import { describe, expect, it, vi } from "vitest";

const { queryRaw } = vi.hoisted(() => ({ queryRaw: vi.fn() }));

vi.mock("@/lib/db/prisma", () => ({ prisma: { $queryRaw: queryRaw } }));

import { GET as health } from "@/app/api/health/route";
import { GET as ready } from "@/app/api/ready/route";

describe("deployment probes", () => {
  it("answers liveness without requiring a database connection", async () => {
    const response = await health();

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ status: "ok" });
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(queryRaw).not.toHaveBeenCalled();
  });

  it("returns readiness only when PostgreSQL is queryable", async () => {
    queryRaw.mockResolvedValueOnce([{ ok: 1 }]);
    const healthy = await ready();
    expect(healthy.status).toBe(200);
    await expect(healthy.json()).resolves.toEqual({ status: "ready" });

    queryRaw.mockRejectedValueOnce(new Error("database offline"));
    const unavailable = await ready();
    expect(unavailable.status).toBe(503);
    await expect(unavailable.json()).resolves.toEqual({ status: "unavailable" });
  });

  it("fails readiness within its bounded timeout when the database promise hangs", async () => {
    vi.useFakeTimers();
    queryRaw.mockImplementationOnce(() => new Promise(() => undefined));
    const responsePromise = ready();

    await vi.advanceTimersByTimeAsync(2_000);
    const response = await responsePromise;
    expect(response.status).toBe(503);
    vi.useRealTimers();
  });
});
