import { describe, expect, it, vi } from "vitest";

import {
  MediaAuthorizationError,
  MediaMetadataMismatchError,
  archiveMediaAsset,
  completeUpload,
  createMediaService,
  createPendingUpload,
  type MediaRepository,
} from "@/features/media/service";
import type { ObjectStorage } from "@/lib/storage";

const admin = { id: "admin-1", role: "ADMIN" as const };
const editor = { id: "editor-1", role: "EDITOR" as const };
const upload = { name: "lab.webp", type: "image/webp" as const, size: 2_000_000 };
const objectKey = "media/2026/08/123e4567-e89b-42d3-a456-426614174000.webp";

function createStorage(overrides: Partial<ObjectStorage> = {}): ObjectStorage {
  return {
    presignUpload: vi.fn(async () => ({
      url: "https://uploads.example.test/signed",
      method: "PUT" as const,
      headers: { "content-type": "image/webp" },
    })),
    headObject: vi.fn(async () => ({
      contentType: "image/webp",
      contentLength: 2_000_000,
      etag: '"etag"',
    })),
    deleteObject: vi.fn(async () => undefined),
    ...overrides,
  };
}

function createRepository(overrides: Partial<MediaRepository> = {}): MediaRepository {
  return {
    createMediaAsset: vi.fn(async (input) => ({ id: "media-1", ...input })),
    getMediaAsset: vi.fn(async () => ({ id: "media-1", storageKey: objectKey })),
    countReferences: vi.fn(async () => ({ pages: 0, products: 0, articles: 0, settings: 0 })),
    archiveMediaAsset: vi.fn(async () => undefined),
    queueObjectDeletion: vi.fn(async () => undefined),
    ...overrides,
  };
}

describe("createPendingUpload", () => {
  it("permits authenticated editors and returns only the upload contract", async () => {
    const result = await createPendingUpload(
      {
        storage: createStorage(),
        now: () => new Date("2026-08-08T00:00:00.000Z"),
        uuid: () => "123e4567-e89b-42d3-a456-426614174000",
      },
      { actor: editor, upload },
    );

    expect(result).toEqual({
      key: objectKey,
      url: "https://uploads.example.test/signed",
      method: "PUT",
      headers: { "content-type": "image/webp" },
    });
    expect(JSON.stringify(result)).not.toContain("credential");
  });

  it("rejects unauthenticated callers", async () => {
    await expect(
      createPendingUpload({ storage: createStorage() }, { actor: null, upload }),
    ).rejects.toBeInstanceOf(MediaAuthorizationError);
  });
});

describe("createMediaService", () => {
  it("binds injected storage and repository dependencies without creating a global runtime", async () => {
    const service = createMediaService({
      storage: createStorage(),
      repository: createRepository(),
      now: () => new Date("2026-08-08T00:00:00.000Z"),
      uuid: () => "123e4567-e89b-42d3-a456-426614174000",
    });

    await expect(service.createPendingUpload({ actor: editor, upload })).resolves.toMatchObject({
      key: objectKey,
      method: "PUT",
    });
  });
});

describe("completeUpload", () => {
  it("creates a media record only after object metadata matches", async () => {
    const repository = createRepository();
    const result = await completeUpload(
      { storage: createStorage(), repository },
      { actor: editor, key: objectKey, upload },
    );

    expect(result).toMatchObject({ id: "media-1", storageKey: objectKey });
  });

  it("rejects a content-type mismatch without creating a media record", async () => {
    const repository = createRepository();
    const storage = createStorage({
      headObject: vi.fn(async () => ({ contentType: "image/png", contentLength: 2_000_000, etag: '"etag"' })),
    });

    await expect(
      completeUpload(
        { storage, repository },
        { actor: admin, key: objectKey, upload },
      ),
    ).rejects.toBeInstanceOf(MediaMetadataMismatchError);
    expect(repository.createMediaAsset).not.toHaveBeenCalled();
  });

  it("rejects a content-length mismatch without creating a media record", async () => {
    const repository = createRepository();
    const storage = createStorage({
      headObject: vi.fn(async () => ({ contentType: "image/webp", contentLength: 4, etag: '"etag"' })),
    });

    await expect(
      completeUpload(
        { storage, repository },
        { actor: admin, key: objectKey, upload },
      ),
    ).rejects.toBeInstanceOf(MediaMetadataMismatchError);
    expect(repository.createMediaAsset).not.toHaveBeenCalled();
  });
});

describe("archiveMediaAsset", () => {
  it("rejects destructive archive requests from editors", async () => {
    await expect(
      archiveMediaAsset(
        { repository: createRepository(), now: () => new Date("2026-08-08T00:00:00.000Z") },
        { actor: editor, mediaAssetId: "media-1" },
      ),
    ).rejects.toBeInstanceOf(MediaAuthorizationError);
  });

  it("archives but retains an object referenced by any managed content", async () => {
    const repository = createRepository({
      countReferences: vi.fn(async () => ({ pages: 1, products: 0, articles: 0, settings: 0 })),
    });

    const result = await archiveMediaAsset(
      { repository, now: () => new Date("2026-08-08T00:00:00.000Z") },
      { actor: admin, mediaAssetId: "media-1" },
    );

    expect(result).toEqual({ archived: true, retained: true, deleteAfter: null });
    expect(repository.queueObjectDeletion).not.toHaveBeenCalled();
  });

  it("queues an unreferenced object for deletion in 30 days", async () => {
    const repository = createRepository();

    const result = await archiveMediaAsset(
      { repository, now: () => new Date("2026-08-08T00:00:00.000Z") },
      { actor: admin, mediaAssetId: "media-1" },
    );

    expect(result).toEqual({
      archived: true,
      retained: false,
      deleteAfter: new Date("2026-09-07T00:00:00.000Z"),
    });
    expect(repository.queueObjectDeletion).toHaveBeenCalledWith({
      actorId: "admin-1",
      mediaAssetId: "media-1",
      storageKey: objectKey,
      deleteAfter: new Date("2026-09-07T00:00:00.000Z"),
    });
  });
});
