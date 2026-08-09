import { execFileSync } from "node:child_process";
import { Pool } from "pg";
import { createE2eReleaseConfig } from "../lib/e2e/release-config";

export default async function globalSetup() {
  if (process.env.E2E_REQUIRED !== "1") return;
  const config = createE2eReleaseConfig(process.env);
  const pool = new Pool({ connectionString: config.runtime.DATABASE_URL });
  try {
    const current = await pool.query<{ current_database: string }>("select current_database()");
    if (current.rows[0]?.current_database !== config.databaseName) throw new Error("E2E database identity check failed");
    const identity = await pool.query<{ value: string }>('select "value" from "E2EReleaseSentinel" where "value" = $1', ["YUESHOU_E2E_RELEASE"]);
    if (identity.rows.length !== 1) throw new Error("Pre-provisioned E2E database sentinel is required before reset");
  } finally { await pool.end(); }
  const environment = Object.assign({}, process.env, config.runtime) as NodeJS.ProcessEnv;
  execFileSync(process.platform === "win32" ? "pnpm.cmd" : "pnpm", ["prisma", "migrate", "reset", "--force"], { stdio: "inherit", env: environment });
  execFileSync(process.platform === "win32" ? "pnpm.cmd" : "pnpm", ["db:seed"], { stdio: "inherit", env: environment });
  const sentinel = new Pool({ connectionString: config.runtime.DATABASE_URL });
  try {
    await sentinel.query('create table if not exists "E2EReleaseSentinel" ("value" text primary key)');
    await sentinel.query('insert into "E2EReleaseSentinel" ("value") values ($1) on conflict do nothing', ["YUESHOU_E2E_RELEASE"]);
    const result = await sentinel.query<{ value: string }>('select "value" from "E2EReleaseSentinel" where "value" = $1', ["YUESHOU_E2E_RELEASE"]);
    if (result.rows.length !== 1) throw new Error("E2E database sentinel check failed");
  } finally { await sentinel.end(); }
}
