const required = ["E2E_DATABASE_URL", "E2E_AUTH_SECRET", "E2E_INQUIRY_HASH_SECRET", "E2E_STORAGE_ENDPOINT", "E2E_STORAGE_BUCKET", "E2E_STORAGE_ACCESS_KEY_ID", "E2E_STORAGE_SECRET_ACCESS_KEY", "E2E_ADMIN_EMAIL", "E2E_ADMIN_PASSWORD", "E2E_PUBLIC_MEDIA_ID", "E2E_HOME_PAGE_ID", "E2E_ARTICLE_ID", "E2E_ARTICLE_SLUG"] as const;

export function createE2eReleaseConfig(input: Record<string, string | undefined>) {
  if (input.E2E_REQUIRED !== "1") throw new Error("E2E_REQUIRED=1 is required for a release browser run");
  if (input.E2E_MUTATION_TESTS !== "1") throw new Error("E2E_MUTATION_TESTS=1 is required for a release browser run");
  if (input.E2E_CONFIRM_DATABASE_RESET !== "RESET_YUESHOU_E2E") throw new Error("E2E_CONFIRM_DATABASE_RESET must equal RESET_YUESHOU_E2E");
  const missing = required.filter((key) => !input[key]);
  if (missing.length) throw new Error(`Missing required E2E environment: ${missing.join(", ")}`);
  const databaseUrl = new URL(input.E2E_DATABASE_URL!);
  const databaseName = databaseUrl.pathname.slice(1);
  if (!databaseName.endsWith("_e2e")) throw new Error("E2E database name must end in _e2e");
  if (/prod|production|live/i.test(databaseUrl.hostname) || /prod|production|live/i.test(databaseName)) throw new Error("E2E database host/name must not look like production");
  const runtime = {
    NODE_ENV: "production", DATABASE_URL: input.E2E_DATABASE_URL!, AUTH_SECRET: input.E2E_AUTH_SECRET!, INQUIRY_HASH_SECRET: input.E2E_INQUIRY_HASH_SECRET!,
    INQUIRY_PROXY_MODE: "nginx", STORAGE_BACKEND: "minio", STORAGE_ENDPOINT: input.E2E_STORAGE_ENDPOINT!, STORAGE_REGION: input.E2E_STORAGE_REGION || "us-east-1",
    STORAGE_BUCKET: input.E2E_STORAGE_BUCKET!, STORAGE_ACCESS_KEY_ID: input.E2E_STORAGE_ACCESS_KEY_ID!, STORAGE_SECRET_ACCESS_KEY: input.E2E_STORAGE_SECRET_ACCESS_KEY!,
    NEXT_PUBLIC_SITE_URL: input.E2E_SITE_URL || "http://localhost:3000", INITIAL_ADMIN_EMAIL: input.E2E_ADMIN_EMAIL!, INITIAL_ADMIN_PASSWORD: input.E2E_ADMIN_PASSWORD!, BOOTSTRAP_ADMIN_CONFIRM: "I_UNDERSTAND_BOOTSTRAP_ADMIN",
  };
  return { databaseName, runtime };
}
