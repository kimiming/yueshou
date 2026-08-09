import { describe, expect, it, vi } from "vitest";

import {
  MediaUploadIntentConflictError,
  completeUpload,
  createPendingUpload,
  type MediaRepository,
  type MediaUploadStorage,
} from "@/features/media/service";

const pngBytes = Uint8Array.from(Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=",
  "base64",
));
const editor = { id: "editor-1", role: "EDITOR" as const };
const upload = { name: "lab.png", type: "image/png" as const, size: pngBytes.byteLength };
const pendingKey = "media/pending/2026/08/123e4567-e89b-42d3-a456-426614174000.png";
const finalKey = "media/2026/08/123e4567-e89b-42d3-a456-426614174000.png";

const intent = {
  id: "intent-1",
  storageKey: pendingKey,
  finalStorageKey: finalKey,
  actorId: editor.id,
  filename: upload.name,
  mimeType: upload.type,
  extension: "png",
  sizeBytes: upload.size,
  expiresAt: new Date("2026-08-08T00:15:00.000Z"),
  consumedAt: null,
};

function repository(overrides: Partial<MediaRepository> = {}): MediaRepository {
  return {
    createUploadIntent: vi.fn(async (input) => ({ id: "intent-1", consumedAt: null, ...input })),
    findUploadIntent: vi.fn(async () => intent),
    consumeUploadIntent: vi.fn(async (input) => ({ id: "media-1", storageKey: input.storageKey })),
    queueUploadObjectDeletion: vi.fn(async () => undefined),
    getMediaAsset: vi.fn(async () => ({ id: "media-1", storageKey: finalKey })),
    countReferences: vi.fn(async () => ({ pages: 0, products: 0, articles: 0, settings: 0 })),
    archiveMediaAsset: vi.fn(async () => undefined),
    queueObjectDeletion: vi.fn(async () => undefined),
    ...overrides,
  };
}

function storage(overrides: Partial<MediaUploadStorage> = {}): MediaUploadStorage {
  return {
    presignUpload: vi.fn(async () => ({
      url: "https://uploads.example.test/signed",
      method: "PUT" as const,
      headers: { "content-type": upload.type },
    })),
    headObject: vi.fn(async () => ({ contentType: upload.type, contentLength: upload.size, etag: "etag" })),
    readPrivateObject: vi.fn(async () => pngBytes),
    putImmutableObject: vi.fn(async () => undefined),
    deleteObject: vi.fn(async () => undefined),
    ...overrides,
  };
}

describe("CMS media pending-to-final upload", () => {
  it("preallocates a cleanup-discoverable final key but presigns only a pending key", async () => {
    const repo = repository();
    await expect(createPendingUpload({
      repository: repo,
      storage: storage(),
      now: () => new Date("2026-08-08T00:00:00.000Z"),
      uuid: () => "123e4567-e89b-42d3-a456-426614174000",
    }, { actor: editor, upload })).resolves.toMatchObject({ key: pendingKey });
    expect(repo.createUploadIntent).toHaveBeenCalledWith(expect.objectContaining({
      storageKey: pendingKey,
      finalStorageKey: finalKey,
    }));
  });

  it("decodes actual bytes, writes sanitized bytes, and persists measured output metadata", async () => {
    const repo = repository();
    const objectStorage = storage();

    await expect(completeUpload({
      repository: repo,
      storage: objectStorage,
      now: () => new Date("2026-08-08T00:01:00.000Z"),
    }, { actor: editor, key: pendingKey, upload })).resolves.toMatchObject({
      id: "media-1",
      storageKey: finalKey,
    });

    expect(objectStorage.readPrivateObject).toHaveBeenCalledWith(pendingKey, 10 * 1024 * 1024 + 1);
    expect(objectStorage.putImmutableObject).toHaveBeenCalledWith(expect.objectContaining({
      key: finalKey,
      contentType: "image/png",
      body: expect.any(Uint8Array),
      sha256: expect.stringMatching(/^[a-f0-9]{64}$/),
    }));
    expect(repo.consumeUploadIntent).toHaveBeenCalledWith(expect.objectContaining({
      pendingStorageKey: pendingKey,
      storageKey: finalKey,
      mimeType: "image/png",
      width: 1,
      height: 1,
      sizeBytes: expect.any(Number),
    }));
    expect(objectStorage.deleteObject).toHaveBeenCalledWith(pendingKey);
  });

  it("queues both possible keys when a final write wins but the database CAS loses", async () => {
    const repo = repository({ consumeUploadIntent: vi.fn(async () => null) });
    await expect(completeUpload({
      repository: repo,
      storage: storage(),
      now: () => new Date("2026-08-08T00:01:00.000Z"),
    }, { actor: editor, key: pendingKey, upload })).rejects.toBeInstanceOf(MediaUploadIntentConflictError);

    expect(repo.queueUploadObjectDeletion).toHaveBeenCalledWith({
      storageKey: pendingKey,
      kind: "MEDIA_PENDING",
      sourceId: "intent-1",
    });
    expect(repo.queueUploadObjectDeletion).toHaveBeenCalledWith({
      storageKey: finalKey,
      kind: "MEDIA_FINAL",
      sourceId: "intent-1",
    });
  });
});
