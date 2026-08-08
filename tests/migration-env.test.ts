import { describe, expect, it } from "vitest";

import { assertMigrationEnv, prismaConfigurationUrl } from "@/lib/deployment/migration-env";

describe("Prisma deployment connection policy", () => {
  it("allows client generation to use a runtime URL or safe local fallback", () => {
    expect(prismaConfigurationUrl({ DATABASE_URL: "postgresql://postgres:password@db.yueshou.test:5432/postgres" })).toContain("db.yueshou.test");
    expect(prismaConfigurationUrl({})).toMatch(/^postgresql:\/\//);
  });

  it("requires a direct non-pooled PostgreSQL URL for migrations", () => {
    expect(assertMigrationEnv({ DIRECT_URL: "postgresql://postgres:password@db.project.supabase.co:5432/postgres" })).toBe("postgresql://postgres:password@db.project.supabase.co:5432/postgres");
    expect(() => assertMigrationEnv({})).toThrow("DIRECT_URL");
    expect(() => assertMigrationEnv({ DIRECT_URL: "postgresql://postgres:password@aws-0-us-east-1.pooler.supabase.com:6543/postgres?pgbouncer=true" })).toThrow("DIRECT_URL");
  });
});
