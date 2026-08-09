import { readFile } from "node:fs/promises";

import { describe, expect, it } from "vitest";

import nextConfig, { r2ImageRemotePatterns } from "../next.config";

describe("cloud deployment configuration", () => {
  it("permits Next Image remote loading only from the configured R2 custom hostname", () => {
    expect(r2ImageRemotePatterns("https://media.yueshou.example")).toEqual([
      { protocol: "https", hostname: "media.yueshou.example", port: "", pathname: "/**" },
    ]);
    expect(r2ImageRemotePatterns("https://bucket.r2.dev")).toEqual([]);
    expect(nextConfig.images).toHaveProperty("remotePatterns");
  });

  it("declares the Vercel GET cron path for protected scheduled publication", async () => {
    const config = JSON.parse(await readFile("vercel.json", "utf8")) as { crons: Array<{ path: string; schedule: string }> };

    expect(config.crons).toContainEqual({ path: "/api/internal/publish-scheduled", schedule: "*/5 * * * *" });
    expect(config.crons).toContainEqual({ path: "/api/internal/media-deletion-jobs", schedule: "2-59/5 * * * *" });
  });

  it("pins database, storage, and native authentication handlers to the Node runtime", async () => {
    const routes = [
      "app/api/auth/[...nextauth]/route.ts",
      "app/api/media/presign/route.ts",
      "app/api/media/complete/route.ts",
      "app/api/internal/media-deletion-jobs/route.ts",
      "app/api/admin/inquiries/attachments/[id]/download/route.ts",
    ];

    for (const route of routes) {
      await expect(readFile(route, "utf8")).resolves.toContain('export const runtime = "nodejs"');
    }
  });

  it("documents deploy-safe Prisma commands, R2 CORS, and recovery operations", async () => {
    const [guide, packageJson] = await Promise.all([
      readFile("docs/deployment/vercel-supabase-r2.md", "utf8"),
      readFile("package.json", "utf8"),
    ]);

    for (const phrase of ["DATABASE_URL", "DIRECT_URL", "prisma migrate deploy", "prisma db seed", "CORS", "rollback", "backup", "CRON_SECRET"]) {
      expect(guide).toContain(phrase);
    }
    const scripts = JSON.parse(packageJson).scripts as Record<string, string>;
    expect(scripts["db:migrate:deploy"]).toContain("migrate-deploy");
    expect(scripts["db:seed"]).toBe("prisma db seed");
    expect(scripts["env:check:production"]).toContain("production-env");
    expect(scripts["build:production"]).toContain("env:check:production");
  });
});
