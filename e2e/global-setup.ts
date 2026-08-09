import { execFileSync } from "node:child_process";
import { Pool } from "pg";
import { runE2eDatabaseLifecycle } from "../lib/e2e/database-lifecycle";
import { createE2eReleaseConfig } from "../lib/e2e/release-config";

export default async function globalSetup() {
  if (process.env.E2E_REQUIRED !== "1") return;
  const config = createE2eReleaseConfig(process.env);
  const environment = Object.assign({}, process.env, config.runtime) as NodeJS.ProcessEnv;
  await runE2eDatabaseLifecycle({
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
    seed: () => execFileSync(process.platform === "win32" ? "pnpm.cmd" : "pnpm", ["db:seed"], { stdio: "inherit", env: environment }),
  }, "setup");
}
