const SAFE_PRISMA_FALLBACK_URL = "postgresql://postgres:prisma-generate-only@127.0.0.1:5432/yueshou";

function isPostgresUrl(value: string) {
  try {
    const url = new URL(value);
    return url.protocol === "postgresql:" || url.protocol === "postgres:";
  } catch {
    return false;
  }
}

export function prismaConfigurationUrl(input: Record<string, string | undefined>) {
  return input.DIRECT_URL || input.DATABASE_URL || SAFE_PRISMA_FALLBACK_URL;
}

export function assertMigrationEnv(input: Record<string, string | undefined>) {
  const directUrl = input.DIRECT_URL;
  if (!directUrl || !isPostgresUrl(directUrl)) throw new Error("DIRECT_URL must be a direct PostgreSQL URL for migrations");
  const url = new URL(directUrl);
  if (url.hostname.includes("pooler.supabase.com") || url.port === "6543" || url.searchParams.get("pgbouncer") === "true") {
    throw new Error("DIRECT_URL must not use a pooled or PgBouncer connection");
  }
  return directUrl;
}
