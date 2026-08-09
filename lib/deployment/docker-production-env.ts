import { isAbsolute } from "node:path";

import { z } from "zod";

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

function isStrongHexSecret(secret: string): boolean {
  if (!/^[a-f0-9]{64}$/i.test(secret)) return false;
  const characters = Array.from(secret.toLowerCase());
  const counts = characters.reduce(
    (result, character) => result.set(character, (result.get(character) ?? 0) + 1),
    new Map<string, number>(),
  );
  const maxFrequency = Math.max(...counts.values()) / secret.length;
  const repeatedPattern = Array.from({ length: Math.floor(secret.length / 2) }, (_, index) => index + 1)
    .some((length) => secret.length % length === 0 && secret === secret.slice(0, length).repeat(secret.length / length));
  return nibbleEntropy(secret) >= 3.5 && maxFrequency <= 0.25 && !repeatedPattern && !hasSequentialHexRun(secret);
}

function hasOpaqueSecretDiversity(secret: string): boolean {
  return new Set(secret).size >= 12 && !/(.)\1{7}/.test(secret);
}

const positiveSeconds = z.string().regex(/^[1-9]\d*$/).transform(Number);

const dockerProductionSchema = z.object({
  NODE_ENV: z.literal("production"),
  POSTGRES_DB: z.string().regex(/^[a-z][a-z0-9_]{2,62}$/),
  POSTGRES_USER: z.string().regex(/^[a-z][a-z0-9_]{2,62}$/),
  POSTGRES_PASSWORD: z.string().min(24).regex(/^[A-Za-z0-9._~-]+$/),
  MINIO_ROOT_USER: z.string().min(8),
  MINIO_ROOT_PASSWORD: z.string().min(24),
  STORAGE_ACCESS_KEY_ID: z.string().min(8),
  STORAGE_SECRET_ACCESS_KEY: z.string().min(32),
  STORAGE_BUCKET: z.string().regex(/^[a-z0-9][a-z0-9.-]{1,61}[a-z0-9]$/),
  AUTH_SECRET: z.string().refine(isStrongHexSecret),
  INQUIRY_HASH_SECRET: z.string().refine(isStrongHexSecret),
  CRON_SECRET: z.string().refine(isStrongHexSecret),
  NEXT_PUBLIC_SITE_URL: z.string().url(),
  SERVER_NAME: z.string().min(1),
  STORAGE_HOST: z.string().min(1),
  TLS_CERTS_DIR: z.string().min(1),
  BACKUP_ENCRYPTION_PASSPHRASE: z.string().min(32),
  BACKUP_INTERVAL_SECONDS: positiveSeconds,
  CRON_INTERVAL_SECONDS: positiveSeconds.default(300),
}).superRefine((environment, context) => {
  const placeholder = /(replace|example|change[-_ ]?me|placeholder|your[-_ ]?|<[^>]+>)/i;
  for (const [key, value] of Object.entries(environment)) {
    if (placeholder.test(String(value))) {
      context.addIssue({ code: "custom", path: [key], message: `${key} must not contain a placeholder value` });
    }
  }

  for (const key of ["MINIO_ROOT_PASSWORD", "STORAGE_SECRET_ACCESS_KEY", "BACKUP_ENCRYPTION_PASSPHRASE"] as const) {
    if (!hasOpaqueSecretDiversity(environment[key])) {
      context.addIssue({ code: "custom", path: [key], message: `${key} must be a high-entropy secret` });
    }
  }

  for (const [left, right] of [
    ["AUTH_SECRET", "INQUIRY_HASH_SECRET"],
    ["AUTH_SECRET", "CRON_SECRET"],
    ["INQUIRY_HASH_SECRET", "CRON_SECRET"],
  ] as const) {
    if (environment[left] === environment[right]) {
      context.addIssue({ code: "custom", path: [right], message: `${right} must differ from ${left}` });
    }
  }

  for (const [sensitiveKey, comparisonKey] of [
    ["STORAGE_SECRET_ACCESS_KEY", "MINIO_ROOT_PASSWORD"],
    ["BACKUP_ENCRYPTION_PASSPHRASE", "POSTGRES_PASSWORD"],
    ["BACKUP_ENCRYPTION_PASSPHRASE", "STORAGE_SECRET_ACCESS_KEY"],
  ] as const) {
    if (environment[sensitiveKey] === environment[comparisonKey]) {
      context.addIssue({ code: "custom", path: [sensitiveKey], message: `${sensitiveKey} must be unique` });
    }
  }
  if (environment.STORAGE_ACCESS_KEY_ID === environment.MINIO_ROOT_USER) {
    context.addIssue({ code: "custom", path: ["STORAGE_ACCESS_KEY_ID"], message: "Application storage credentials must not be MinIO root credentials" });
  }

  const siteUrl = new URL(environment.NEXT_PUBLIC_SITE_URL);
  if (siteUrl.protocol !== "https:") {
    context.addIssue({ code: "custom", path: ["NEXT_PUBLIC_SITE_URL"], message: "NEXT_PUBLIC_SITE_URL must use HTTPS" });
  }
  if (siteUrl.hostname !== environment.SERVER_NAME) {
    context.addIssue({ code: "custom", path: ["SERVER_NAME"], message: "SERVER_NAME must match NEXT_PUBLIC_SITE_URL" });
  }
  if (environment.STORAGE_HOST === environment.SERVER_NAME) {
    context.addIssue({ code: "custom", path: ["STORAGE_HOST"], message: "STORAGE_HOST must use a distinct HTTPS hostname" });
  }
  for (const key of ["SERVER_NAME", "STORAGE_HOST"] as const) {
    if (!/^(?=.{1,253}$)(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/i.test(environment[key])) {
      context.addIssue({ code: "custom", path: [key], message: `${key} must be a valid DNS hostname` });
    }
  }
  if (!isAbsolute(environment.TLS_CERTS_DIR) || environment.TLS_CERTS_DIR === "/") {
    context.addIssue({ code: "custom", path: ["TLS_CERTS_DIR"], message: "TLS_CERTS_DIR must be a specific absolute host path" });
  }
});

export type DockerProductionEnv = z.infer<typeof dockerProductionSchema>;

export function parseDockerProductionEnv(input: Record<string, string | undefined>): DockerProductionEnv {
  return dockerProductionSchema.parse(input);
}
