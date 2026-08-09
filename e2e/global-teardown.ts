import { Pool } from "pg";
import { createE2eReleaseConfig } from "../lib/e2e/release-config";

export default async function globalTeardown() {
  if (process.env.E2E_REQUIRED !== "1") return;
  const config = createE2eReleaseConfig(process.env);
  const pool = new Pool({ connectionString: config.runtime.DATABASE_URL });
  try {
    const identity = await pool.query<{ value: string }>('select "value" from "E2EReleaseSentinel" where "value" = $1', ["YUESHOU_E2E_RELEASE"]);
    if (identity.rows.length !== 1) throw new Error("E2E sentinel missing; teardown refused");
    await pool.query("drop schema public cascade; create schema public");
  } finally { await pool.end(); }
}
