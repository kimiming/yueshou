import { describe, expect, it, vi } from "vitest";

import {
  MediaAuthorizationError,
  MediaMetadataMismatchError,
  MediaUploadIntentConflictError,
  MediaUploadIntentExpiredError,
  MediaUploadIntentMismatchError,
  MediaUploadIntentReplayError,
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
const intent = {
  id: "intent-1",
  storageKey: objectKey,
  actorId: editor.id,
  filename: upload.name,
  mimeType: upload.type,
  extension: "webp",
  sizeBytes: upload.size,
  expiresAt: new Date("2026-08-08T00:15:00.000Z"),
  consumedAt: null,
};

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
    createUploadIntent: vi.fn(async (input) => ({ id: "intent-1", consumedAt: null, ...input })),
    findUploadIntent: vi.fn(async () => intent),
    consumeUploadIntent: vi.fn(async (input) => ({ id: "media-1", storageKey: input.storageKey })),
    getMediaAsset: vi.fn(async () => ({ id: "media-1", storageKey: objectKey })),
    countReferences: vi.fn(async () => ({ pages: 0, products: 0, articles: 0, settings: 0 })),
    archiveMediaAsset: vi.fn(async () => undefined),
    queueObjectDeletion: vi.fn(async () => undefined),
    ...overrides,
  };
}

describe("createPendingUpload", () => {
  it("permits authenticated editors and returns only the upload contract", async () => {
    const repository = createRepository();
    const result = await createPendingUpload(
      {
        storage: createStorage(),
        repository,
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
    expect(repository.createUploadIntent).toHaveBeenCalledWith({
      storageKey: objectKey,
      actorId: "editor-1",
      filename: "lab.webp",
      mimeType: "image/webp",
      extension: "webp",
      sizeBytes: 2_000_000,
      expiresAt: new Date("2026-08-08T00:15:00.000Z"),
    });
  });

  it("rejects unauthenticated callers", async () => {
    await expect(
      createPendingUpload({ storage: createStorage(), repository: createRepository() }, { actor: null, upload }),
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
      { storage: createStorage(), repository, now: () => new Date("2026-08-08T00:01:00.000Z") },
      { actor: editor, key: objectKey, upload },
    );

    expect(result).toMatchObject({ id: "media-1", storageKey: objectKey });
    expect(repository.consumeUploadIntent).toHaveBeenCalledTimes(1);
  });

  it("rejects a content-type mismatch without creating a media record", async () => {
    const repository = createRepository();
    const storage = createStorage({
      headObject: vi.fn(async () => ({ contentType: "image/png", contentLength: 2_000_000, etag: '"etag"' })),
    });

    await expect(
      completeUpload(
        { storage, repository, now: () => new Date("2026-08-08T00:01:00.000Z") },
        { actor: editor, key: objectKey, upload },
      ),
    ).rejects.toBeInstanceOf(MediaMetadataMismatchError);
    expect(repository.consumeUploadIntent).not.toHaveBeenCalled();
  });

  it("rejects a content-length mismatch without creating a media record", async () => {
    const repository = createRepository();
    const storage = createStorage({
      headObject: vi.fn(async () => ({ contentType: "image/webp", contentLength: 4, etag: '"etag"' })),
    });

    await expect(
      completeUpload(
        { storage, repository, now: () => new Date("2026-08-08T00:01:00.000Z") },
        { actor: editor, key: objectKey, upload },
      ),
    ).rejects.toBeInstanceOf(MediaMetadataMismatchError);
    expect(repository.consumeUploadIntent).not.toHaveBeenCalled();
  });

  it("rejects completing a WebP key as PNG", async () => {
    const repository = createRepository();
    await expect(
      completeUpload(
        { storage: createStorage(), repository, now: () => new Date("2026-08-08T00:01:00.000Z") },
        {
          actor: editor,
          key: objectKey,
          upload: { name: "lab.png", type: "image/png", size: 2_000_000 },
        },
      ),
    ).rejects.toBeInstanceOf(MediaUploadIntentMismatchError);
    expect(repository.consumeUploadIntent).not.toHaveBeenCalled();
  });

  it("rejects completion by a different authenticated actor", async () => {
    const repository = createRepository();
    await expect(
      completeUpload(
        { storage: createStorage(), repository, now: () => new Date("2026-08-08T00:01:00.000Z") },
        { actor: { id: "editor-2", role: "EDITOR" }, key: objectKey, upload },
      ),
    ).rejects.toBeInstanceOf(MediaUploadIntentMismatchError);
    expect(repository.consumeUploadIntent).not.toHaveBeenCalled();
  });

  it("rejects expired upload intents before inspecting storage", async () => {
    const repository = createRepository();
    const storage = createStorage();
    await expect(
      completeUpload(
        { storage, repository, now: () => new Date("2026-08-08T00:15:00.000Z") },
        { actor: editor, key: objectKey, upload },
      ),
    ).rejects.toBeInstanceOf(MediaUploadIntentExpiredError);
    expect(storage.headObject).not.toHaveBeenCalled();
  });

  it("rejects replaying a consumed upload intent", async () => {
    const repository = createRepository({
      findUploadIntent: vi.fn(async () => ({ ...intent, consumedAt: new Date("2026-08-08T00:02:00.000Z") })),
    });
    await expect(
      completeUpload(
        { storage: createStorage(), repository, now: () => new Date("2026-08-08T00:03:00.000Z") },
        { actor: editor, key: objectKey, upload },
      ),
    ).rejects.toBeInstanceOf(MediaUploadIntentReplayError);
  });

  it("reports an atomic consumption conflict when another completion wins", async () => {
    const repository = createRepository({ consumeUploadIntent: vi.fn(async () => null) });
    await expect(
      completeUpload(
        { storage: createStorage(), repository, now: () => new Date("2026-08-08T00:01:00.000Z") },
        { actor: editor, key: objectKey, upload },
      ),
    ).rejects.toBeInstanceOf(MediaUploadIntentConflictError);
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
