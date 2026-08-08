import {
  DeleteObjectCommand,
  HeadObjectCommand,
  PutObjectCommand,
  S3Client,
  type S3ClientConfig,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

import type { ObjectStorage } from "./types";

export type S3StorageBackend = "r2" | "minio";

export type S3StorageConfig = {
  backend: S3StorageBackend;
  endpoint: string;
  region: string;
  bucket: string;
  accessKeyId: string;
  secretAccessKey: string;
};

type Presign = (
  client: S3Client,
  command: PutObjectCommand,
  options: { expiresIn: number },
) => Promise<string>;
type S3Sender = Pick<S3Client, "send">;

export function createS3ClientConfig(config: S3StorageConfig): S3ClientConfig {
  return {
    endpoint: config.endpoint,
    region: config.region,
    credentials: {
      accessKeyId: config.accessKeyId,
      secretAccessKey: config.secretAccessKey,
    },
    forcePathStyle: config.backend === "minio",
  };
}

export function createS3Storage(
  config: S3StorageConfig,
  dependencies: { presign?: Presign; client?: S3Sender } = {},
): ObjectStorage {
  const client = dependencies.client ?? new S3Client(createS3ClientConfig(config));
  const presign = dependencies.presign ?? getSignedUrl;

  return {
    async presignUpload(input) {
      const command = new PutObjectCommand({
        Bucket: config.bucket,
        Key: input.key,
        ContentType: input.contentType,
        ContentLength: input.contentLength,
      });

      return {
        url: await presign(client as S3Client, command, { expiresIn: 15 * 60 }),
        method: "PUT",
        headers: { "content-type": input.contentType },
      };
    },

    async headObject(key) {
      const result = await client.send(new HeadObjectCommand({ Bucket: config.bucket, Key: key }));
      return {
        contentType: result.ContentType,
        contentLength: result.ContentLength,
        etag: result.ETag,
      };
    },

    async deleteObject(key) {
      await client.send(new DeleteObjectCommand({ Bucket: config.bucket, Key: key }));
    },
  };
}
