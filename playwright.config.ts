import { defineConfig, devices } from "@playwright/test";

import { createE2eReleaseConfig } from "./lib/e2e/release-config";

const release = process.env.E2E_REQUIRED === "1" ? createE2eReleaseConfig(process.env) : null;

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 2 : 1,
  reporter: [["html", { open: "never" }], ["./e2e/release-reporter.ts"]],
  use: {
    baseURL: "http://localhost:3000",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    // Only the local, disposable E2E server trusts this header. Production
    // receives it only from its configured Nginx proxy.
    extraHTTPHeaders: release ? { "x-real-ip": "127.0.0.1" } : {},
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
  // Browser journeys use a production build and an explicitly named,
  // disposable E2E database.  When that fixture is not configured the specs
  // explain their skip instead of starting a server against an unknown DB.
  globalSetup: release ? "./e2e/global-setup.ts" : undefined,
  globalTeardown: release ? "./e2e/global-teardown.ts" : undefined,
  webServer: release
    ? {
      command: "pnpm build && pnpm prepare:standalone && pnpm start:standalone",
      url: "http://localhost:3000",
      reuseExistingServer: false,
      env: release.runtime,
    }
    : undefined,
});
