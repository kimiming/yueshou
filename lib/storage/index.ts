import type { AppEnv } from "@/lib/env";

import { createS3Storage, type S3StorageBackend } from "./s3-storage";

export * from "./s3-storage";
export * from "./types";

export function createObjectStorage(env: AppEnv, backend: S3StorageBackend) {
  return createS3Storage({
    backend,
    endpoint: env.STORAGE_ENDPOINT,
    region: env.STORAGE_REGION,
    bucket: env.STORAGE_BUCKET,
    accessKeyId: env.STORAGE_ACCESS_KEY_ID,
    secretAccessKey: env.STORAGE_SECRET_ACCESS_KEY,
  });
}
