import { describe, expect, it } from "vitest";

import { parseDockerProductionEnv } from "@/lib/deployment/docker-production-env";

const strongSecrets = {
  AUTH_SECRET: "a4d1f7c20e9b65385c1e8a3f0d7b2496e2b609d4a7c15f8379f3c5e10b6d842a",
  INQUIRY_HASH_SECRET: "6b0e3a8d1f4c7592d2f815a96c03be474e7b29c0f5a183d691d6c4e7b2f5083a",
  CRON_SECRET: "f3a61d8c205e974b8d4b0f25c7a913e61e79b3d6a40c8f25c205e8f14b6d973a",
} as const;

const completeDockerEnvironment = {
  NODE_ENV: "production",
  POSTGRES_DB: "yueshou",
  POSTGRES_USER: "yueshou_app",
  POSTGRES_PASSWORD: "Pg_7Qp9vK3mZ2xR8nT5cW4sL6hJ1dF0",
  MINIO_ROOT_USER: "yueshou_minio_admin",
  MINIO_ROOT_PASSWORD: "MinioRoot_7Qp9vK3mZ2xR8nT5cW4sL6",
  STORAGE_ACCESS_KEY_ID: "yueshou_scoped_storage",
  STORAGE_SECRET_ACCESS_KEY: "Storage_9vK3mZ2xR8nT5cW4sL6hJ1dF0pQ7",
  STORAGE_BUCKET: "yueshou-private-production",
  ...strongSecrets,
  NEXT_PUBLIC_SITE_URL: "https://www.yueshou.test",
  SERVER_NAME: "www.yueshou.test",
  STORAGE_HOST: "s3.yueshou.test",
  TLS_CERTS_DIR: "/srv/yueshou/tls",
  BACKUP_ENCRYPTION_PASSPHRASE: "Backup_3mZ2xR8nT5cW4sL6hJ1dF0pQ7vK9",
  BACKUP_INTERVAL_SECONDS: "86400",
  CRON_INTERVAL_SECONDS: "300",
} as const;

describe("Docker production environment", () => {
  it("accepts a complete distinct HTTPS PostgreSQL and MinIO target", () => {
    expect(parseDockerProductionEnv(completeDockerEnvironment)).toMatchObject({
      POSTGRES_DB: "yueshou",
      STORAGE_BUCKET: "yueshou-private-production",
      NEXT_PUBLIC_SITE_URL: "https://www.yueshou.test",
      SERVER_NAME: "www.yueshou.test",
      STORAGE_HOST: "s3.yueshou.test",
    });
  });

  it.each([
    ["POSTGRES_PASSWORD", "replace-with-a-long-url-safe-postgres-password"],
    ["MINIO_ROOT_PASSWORD", "short"],
    ["STORAGE_SECRET_ACCESS_KEY", completeDockerEnvironment.MINIO_ROOT_PASSWORD],
    ["BACKUP_ENCRYPTION_PASSPHRASE", completeDockerEnvironment.POSTGRES_PASSWORD],
    ["NEXT_PUBLIC_SITE_URL", "http://www.yueshou.test"],
    ["SERVER_NAME", "www.example.com"],
    ["STORAGE_HOST", completeDockerEnvironment.SERVER_NAME],
    ["TLS_CERTS_DIR", "./tls"],
    ["POSTGRES_PASSWORD", "contains@reserved:characters"],
    ["BACKUP_INTERVAL_SECONDS", "0"],
  ] as const)("rejects unsafe %s", (key, value) => {
    expect(() => parseDockerProductionEnv({ ...completeDockerEnvironment, [key]: value })).toThrow(key);
  });

  it("rejects repeated or duplicate application secrets", () => {
    expect(() => parseDockerProductionEnv({
      ...completeDockerEnvironment,
      AUTH_SECRET: "a".repeat(64),
    })).toThrow("AUTH_SECRET");
    expect(() => parseDockerProductionEnv({
      ...completeDockerEnvironment,
      CRON_SECRET: completeDockerEnvironment.INQUIRY_HASH_SECRET,
    })).toThrow("CRON_SECRET");
  });
});
