import "dotenv/config";

import { defineConfig } from "prisma/config";

import { prismaConfigurationUrl } from "./lib/deployment/migration-env";

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
    seed: "tsx prisma/seed.ts",
  },
  datasource: {
    // Generation/builds need no database connection. Migration preflight is
    // enforced by scripts/migrate-deploy.ts before it invokes Prisma.
    url: prismaConfigurationUrl(process.env),
  },
});
