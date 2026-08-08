import { execFileSync } from "node:child_process";
import { createE2eReleaseConfig } from "../lib/e2e/release-config";

export default function globalTeardown() {
  if (process.env.E2E_REQUIRED !== "1") return;
  const config = createE2eReleaseConfig(process.env);
  const environment = Object.assign({}, process.env, config.runtime) as NodeJS.ProcessEnv;
  execFileSync(process.platform === "win32" ? "pnpm.cmd" : "pnpm", ["prisma", "migrate", "reset", "--force", "--skip-seed"], { stdio: "inherit", env: environment });
}
