import { DeleteObjectCommand, GetObjectCommand, HeadObjectCommand, PutObjectCommand, type S3Client } from "@aws-sdk/client-s3";
import { describe, expect, it, vi } from "vitest";

import { createS3Storage, type S3StorageBackend } from "@/lib/storage/s3-storage";

const fixtures: Array<{ backend: S3StorageBackend; forcePathStyle: boolean }> = [
  { backend: "r2", forcePathStyle: false },
  { backend: "minio", forcePathStyle: true },
];

describe.each(fixtures)("$backend object storage contract", ({ backend, forcePathStyle }) => {
  it("real presigning omits empty-body checksums and signs the required content type", async () => {
    const storage = createS3Storage({
      backend,
      endpoint: "https://objects.example.test",
      region: "auto",
      bucket: "media",
      accessKeyId: "test-access-key",
      secretAccessKey: "test-secret-key",
    });

    const result = await storage.presignUpload({
      key: "media/2026/08/123e4567-e89b-42d3-a456-426614174000.webp",
      contentType: "image/webp",
      contentLength: 321,
    });
    const url = new URL(result.url);

    expect(url.searchParams.get("x-amz-checksum-crc32")).toBeNull();
    expect(url.searchParams.get("x-amz-sdk-checksum-algorithm")).toBeNull();
    expect(url.searchParams.get("X-Amz-SignedHeaders")?.split(";")).toEqual(
      expect.arrayContaining(["content-length", "content-type", "host"]),
    );
    expect(result.headers).toEqual({ "content-type": "image/webp" });
  });

  it("configures addressing for the backend without exposing credentials", async () => {
    const observed: { client?: S3Client; command?: PutObjectCommand } = {};
    const presign = vi.fn(async (client: S3Client, command: PutObjectCommand) => {
      observed.client = client;
      observed.command = command;
      return "https://uploads.example.test/signed";
    });
    const storage = createS3Storage(
      {
        backend,
        endpoint: "https://objects.example.test",
        region: "auto",
        bucket: "media",
        accessKeyId: "access-secret",
        secretAccessKey: "credential-secret",
      },
      { presign },
    );

    const result = await storage.presignUpload({
      key: "media/2026/08/id.webp",
      contentType: "image/webp",
      contentLength: 100,
    });

    expect(result).toEqual({
      url: "https://uploads.example.test/signed",
      method: "PUT",
      headers: { "content-type": "image/webp" },
    });
    expect(observed.client?.config.forcePathStyle).toBe(forcePathStyle);
    expect(JSON.stringify(result)).not.toContain("secret");
    expect(observed.command).toBeInstanceOf(PutObjectCommand);
    expect(observed.command?.input).toMatchObject({
      Bucket: "media",
      Key: "media/2026/08/id.webp",
      ContentType: "image/webp",
      ContentLength: 100,
    });
  });

  it("reads normalized metadata and deletes through the configured bucket", async () => {
    const commands: unknown[] = [];
    const client = {
      send: vi.fn(async (command: unknown) => {
        commands.push(command);
        if (command instanceof HeadObjectCommand) {
          return { ContentType: "image/avif", ContentLength: 321, ETag: '"etag-value"' };
        }
        return {};
      }),
    };
    const storage = createS3Storage(
      {
        backend,
        endpoint: "https://objects.example.test",
        region: "auto",
        bucket: "media",
        accessKeyId: "access-secret",
        secretAccessKey: "credential-secret",
      },
      { client },
    );

    await expect(storage.headObject("media/2026/08/id.avif")).resolves.toEqual({
      contentType: "image/avif",
      contentLength: 321,
      etag: '"etag-value"',
    });
    await expect(storage.deleteObject("media/2026/08/id.avif")).resolves.toBeUndefined();
    expect(commands[0]).toBeInstanceOf(HeadObjectCommand);
    expect((commands[0] as HeadObjectCommand).input).toEqual({ Bucket: "media", Key: "media/2026/08/id.avif" });
    expect(commands[1]).toBeInstanceOf(DeleteObjectCommand);
    expect((commands[1] as DeleteObjectCommand).input).toEqual({ Bucket: "media", Key: "media/2026/08/id.avif" });
  });

  it("reads private bytes with a hard cap and writes the final object immutably", async () => {
    const commands: unknown[] = [];
    const client = { send: vi.fn(async (command: unknown) => {
      commands.push(command);
      if (command instanceof GetObjectCommand) return { Body: { async *[Symbol.asyncIterator]() { yield new Uint8Array([1, 2]); yield new Uint8Array([3]); } } };
      return {};
    }) };
    const storage = createS3Storage({ backend, endpoint: "https://objects.example.test", region: "auto", bucket: "private", accessKeyId: "key", secretAccessKey: "secret" }, { client });
    await expect(storage.readPrivateObject("inquiry/temp.pdf", 3)).resolves.toEqual(new Uint8Array([1, 2, 3]));
    await storage.putImmutableObject({ key: `inquiry/final/${"a".repeat(64)}.pdf`, body: new Uint8Array([1, 2, 3]), contentType: "application/pdf", sha256: "a".repeat(64) });
    expect(commands[0]).toBeInstanceOf(GetObjectCommand);
    expect((commands[1] as PutObjectCommand).input).toMatchObject({ IfNoneMatch: "*", Metadata: { sha256: "a".repeat(64) } });
  });

  it("signs a five-minute private GET without exposing storage credentials", async () => {
    const commands: unknown[] = [];
    const presign = vi.fn(async (_client: S3Client, command: PutObjectCommand | GetObjectCommand, options: { expiresIn: number }) => {
      commands.push(command);
      expect(options.expiresIn).toBe(300);
      return "https://objects.example.test/signed-download";
    });
    const storage = createS3Storage(
      { backend, endpoint: "https://objects.example.test", region: "auto", bucket: "private", accessKeyId: "access-secret", secretAccessKey: "credential-secret" },
      { presign, now: () => new Date("2026-08-08T10:00:00.000Z") },
    );

    await expect(storage.presignDownload({ key: "inquiry/final/abc.pdf", filename: "brief\r\n.pdf", expiresIn: 300 })).resolves.toEqual({
      url: "https://objects.example.test/signed-download",
      expiresAt: new Date("2026-08-08T10:05:00.000Z"),
    });
    expect(commands[0]).toBeInstanceOf(GetObjectCommand);
    expect((commands[0] as GetObjectCommand).input.ResponseContentDisposition).not.toMatch(/[\r\n]/);
    expect(JSON.stringify(await storage.presignDownload({ key: "inquiry/final/abc.pdf", filename: "brief.pdf", expiresIn: 300 }))).not.toContain("credential-secret");
  });
});
