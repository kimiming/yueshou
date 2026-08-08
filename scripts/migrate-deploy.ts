import { execFileSync } from "node:child_process";

import { assertMigrationEnv } from "../lib/deployment/migration-env";

assertMigrationEnv(process.env);
execFileSync(process.platform === "win32" ? "pnpm.cmd" : "pnpm", ["exec", "prisma", "migrate", "deploy"], { stdio: "inherit" });
