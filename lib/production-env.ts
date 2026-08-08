import { z } from "zod";

import { parseEnv, type AppEnv } from "@/lib/env";

function nibbleEntropy(secret: string): number {
  const frequencies = Array<number>(16).fill(0);
  for (const nibble of secret.toLowerCase()) frequencies[Number.parseInt(nibble, 16)] += 1;
  return frequencies.reduce((entropy, count) => {
    if (!count) return entropy;
    const probability = count / secret.length;
    return entropy - probability * Math.log2(probability);
  }, 0);
}

function hasSequentialHexRun(secret: string, minimumLength = 12): boolean {
  let ascending = 1;
  let descending = 1;
  for (let index = 1; index < secret.length; index += 1) {
    const previous = Number.parseInt(secret[index - 1], 16);
    const current = Number.parseInt(secret[index], 16);
    ascending = (current - previous + 16) % 16 === 1 ? ascending + 1 : 1;
    descending = (previous - current + 16) % 16 === 1 ? descending + 1 : 1;
    if (ascending >= minimumLength || descending >= minimumLength) return true;
  }
  return false;
}

const productionDeploymentSchema = z.object({
  DATABASE_URL: z.string().url(),
  DIRECT_URL: z.string().url().optional(),
  AUTH_SECRET: z.string().min(32),
  INQUIRY_HASH_SECRET: z.string().min(32),
  CRON_SECRET: z.string().min(32),
  NEXT_PUBLIC_SITE_URL: z.string().url(),
  NEXT_PUBLIC_R2_PUBLIC_URL: z.string().url().optional(),
  STORAGE_BACKEND: z.literal("r2"),
  STORAGE_ENDPOINT: z.string().url(),
  STORAGE_BUCKET: z.string().min(1),
  STORAGE_ACCESS_KEY_ID: z.string().min(1),
  STORAGE_SECRET_ACCESS_KEY: z.string().min(1),
}).superRefine((env, context) => {
  const placeholder = /(replace|example|change[-_ ]?me|placeholder|your[-_ ]?|<[^>]+>)/i;
  for (const [key, value] of Object.entries(env)) {
    if (placeholder.test(value)) context.addIssue({ code: "custom", path: [key], message: `${key} must not contain a placeholder value` });
  }

  for (const key of ["AUTH_SECRET", "INQUIRY_HASH_SECRET", "CRON_SECRET"] as const) {
    const secret = env[key];
    const repeatedPattern = Array.from({ length: Math.floor(secret.length / 2) }, (_, index) => index + 1)
      .some((length) => secret.length % length === 0 && secret === secret.slice(0, length).repeat(secret.length / length));
    const maxFrequency = Math.max(...Array.from(secret.toLowerCase()).reduce((counts, nibble) => counts.set(nibble, (counts.get(nibble) ?? 0) + 1), new Map<string, number>()).values()) / secret.length;
    if (!/^[a-f0-9]{64}$/i.test(secret) || nibbleEntropy(secret) < 3.5 || maxFrequency > 0.25 || repeatedPattern || hasSequentialHexRun(secret)) {
      context.addIssue({ code: "custom", path: [key], message: `${key} must be a distinct, high-entropy 64-character hexadecimal random secret` });
    }
  }

  for (const [left, right] of [["AUTH_SECRET", "INQUIRY_HASH_SECRET"], ["AUTH_SECRET", "CRON_SECRET"], ["INQUIRY_HASH_SECRET", "CRON_SECRET"]] as const) {
    if (env[left] === env[right]) context.addIssue({ code: "custom", path: [left], message: `${left} must differ from ${right}` });
  }

  for (const key of ["DATABASE_URL", "DIRECT_URL"] as const) {
    if (!env[key]) continue;
    const url = new URL(env[key]);
    if (url.protocol !== "postgresql:" && url.protocol !== "postgres:") {
      context.addIssue({ code: "custom", path: [key], message: `${key} must be a PostgreSQL URL` });
    }
  }

  const siteUrl = new URL(env.NEXT_PUBLIC_SITE_URL);
  if (siteUrl.protocol !== "https:") {
    context.addIssue({ code: "custom", path: ["NEXT_PUBLIC_SITE_URL"], message: "NEXT_PUBLIC_SITE_URL must use HTTPS in production" });
  }

  if (env.NEXT_PUBLIC_R2_PUBLIC_URL) {
    const publicUrl = new URL(env.NEXT_PUBLIC_R2_PUBLIC_URL);
    if (publicUrl.protocol !== "https:" || publicUrl.hostname.endsWith(".r2.dev")) {
      context.addIssue({
        code: "custom",
        path: ["NEXT_PUBLIC_R2_PUBLIC_URL"],
        message: "NEXT_PUBLIC_R2_PUBLIC_URL must be an HTTPS custom domain, not an r2.dev development URL",
      });
    }
  }

  const storageEndpoint = new URL(env.STORAGE_ENDPOINT);
  if (storageEndpoint.protocol !== "https:" || !storageEndpoint.hostname.endsWith(".r2.cloudflarestorage.com")) {
    context.addIssue({ code: "custom", path: ["STORAGE_ENDPOINT"], message: "STORAGE_ENDPOINT must be an HTTPS Cloudflare R2 S3 endpoint" });
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
