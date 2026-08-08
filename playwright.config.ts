import { defineConfig, devices } from "@playwright/test";

import { e2eServerEnvironment, hasE2eDatabase } from "./e2e/fixtures/database";

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 2 : 0,
  reporter: "html",
  use: {
    baseURL: "http://localhost:3000",
    trace: "on-first-retry",
    // Only the local, disposable E2E server trusts this header. Production
    // receives it only from its configured Nginx proxy.
    extraHTTPHeaders: hasE2eDatabase ? { "x-real-ip": "127.0.0.1" } : {},
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
  webServer: hasE2eDatabase
    ? {
      command: "pnpm build && pnpm start",
      url: "http://localhost:3000",
      reuseExistingServer: false,
      env: e2eServerEnvironment(),
    }
    : undefined,
});
