import "dotenv/config";

import { defineConfig, env } from "prisma/config";

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
    seed: "tsx prisma/seed.ts",
  },
  datasource: {
    // Runtime uses DATABASE_URL through the PrismaPg adapter. Schema changes
    // must bypass Supabase's transaction pooler with the direct URL.
    url: env("DIRECT_URL"),
  },
});
