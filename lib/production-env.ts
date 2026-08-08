import { z } from "zod";

import { parseEnv, type AppEnv } from "@/lib/env";

const productionDeploymentSchema = z.object({
  DATABASE_URL: z.string().url(),
  DIRECT_URL: z.string().url(),
  CRON_SECRET: z.string().min(32),
  NEXT_PUBLIC_SITE_URL: z.string().url(),
  NEXT_PUBLIC_R2_PUBLIC_URL: z.string().url(),
}).superRefine((env, context) => {
  for (const key of ["DATABASE_URL", "DIRECT_URL"] as const) {
    const url = new URL(env[key]);
    if (url.protocol !== "postgresql:" && url.protocol !== "postgres:") {
      context.addIssue({ code: "custom", path: [key], message: `${key} must be a PostgreSQL URL` });
    }
  }

  const siteUrl = new URL(env.NEXT_PUBLIC_SITE_URL);
  if (siteUrl.protocol !== "https:") {
    context.addIssue({ code: "custom", path: ["NEXT_PUBLIC_SITE_URL"], message: "NEXT_PUBLIC_SITE_URL must use HTTPS in production" });
  }

  const publicUrl = new URL(env.NEXT_PUBLIC_R2_PUBLIC_URL);

  if (publicUrl.protocol !== "https:" || publicUrl.hostname.endsWith(".r2.dev")) {
    context.addIssue({
      code: "custom",
      path: ["NEXT_PUBLIC_R2_PUBLIC_URL"],
      message: "NEXT_PUBLIC_R2_PUBLIC_URL must be an HTTPS custom domain, not an r2.dev development URL",
    });
  }
});

export type ProductionEnv = AppEnv & z.infer<typeof productionDeploymentSchema>;

/**
 * Validates the complete production deployment contract. Runtime request
 * handlers use parseEnv because DIRECT_URL is intentionally migration-only.
 */
export function parseProductionEnv(input: Record<string, string | undefined>): ProductionEnv {
  const runtime = parseEnv({ ...input, NODE_ENV: "production" });
  return { ...runtime, ...productionDeploymentSchema.parse(input) };
}
