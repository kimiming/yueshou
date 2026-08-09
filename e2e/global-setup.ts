import { execFileSync } from "node:child_process";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";
import { Pool } from "pg";
import { runE2eDatabaseLifecycle } from "../lib/e2e/database-lifecycle";
import { resolveE2eMutationFixture, writeE2eMutationFixture } from "../lib/e2e/mutation-fixture";
import { createE2eReleaseConfig } from "../lib/e2e/release-config";

export default async function globalSetup() {
  if (process.env.E2E_REQUIRED !== "1") return;
  const config = createE2eReleaseConfig(process.env);
  const environment = Object.assign({}, process.env, config.runtime) as NodeJS.ProcessEnv;
  const fixture = await runE2eDatabaseLifecycle({
    authenticate: async () => {
      const pool = new Pool({ connectionString: config.runtime.DATABASE_URL });
      try {
        const identity = await pool.query<{ current_database: string; marker: string | null }>("select current_database(), obj_description(oid, 'pg_database') as marker from pg_database where datname = current_database()");
        if (identity.rows[0]?.current_database !== config.databaseName || identity.rows[0]?.marker !== "YUESHOU_E2E_RELEASE") {
          throw new Error("Disposable E2E database must have the durable YUESHOU_E2E_RELEASE database comment before reset");
        }
      } finally { await pool.end(); }
    },
    reset: () => execFileSync(process.platform === "win32" ? "pnpm.cmd" : "pnpm", ["prisma", "migrate", "reset", "--force"], { stdio: "inherit", env: environment }),
    seedDatabase: () => execFileSync(process.platform === "win32" ? "pnpm.cmd" : "pnpm", ["db:seed"], { stdio: "inherit", env: environment }),
    seedStorage: () => execFileSync(process.platform === "win32" ? "pnpm.cmd" : "pnpm", ["db:seed:e2e"], { stdio: "inherit", env: environment }),
    resolveFixture: async () => {
      const client = new PrismaClient({ adapter: new PrismaPg({ connectionString: config.runtime.DATABASE_URL }) });
      try {
        return await resolveE2eMutationFixture({
          findPublishedMediaByStorageKey: (storageKey) => client.mediaAsset.findFirst({ where: { storageKey, status: "PUBLISHED", deletedAt: null }, select: { id: true } }),
          findPublishedPageBySlug: (slug) => client.page.findFirst({ where: { slug, status: "PUBLISHED", deletedAt: null }, select: { id: true } }),
          findPublishedArticleBySlug: (slug) => client.article.findFirst({ where: { slug, status: "PUBLISHED", deletedAt: null }, select: { id: true, slug: true } }),
        });
      } finally {
        await client.$disconnect();
      }
    },
  }, "setup");
  writeE2eMutationFixture(config.fixtureFile, fixture);
}
