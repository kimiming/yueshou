import { describe, expect, it, vi } from "vitest";

import {
  POST as defaultCompletePost,
  createCompleteUploadHandler,
} from "@/app/api/media/complete/route";
import {
  POST as defaultPresignPost,
  createPresignUploadHandler,
} from "@/app/api/media/presign/route";
import {
  MediaAuthorizationError,
  MediaUploadIntentConflictError,
  MediaUploadIntentExpiredError,
  MediaUploadIntentMismatchError,
  MediaUploadIntentNotFoundError,
  MediaUploadIntentReplayError,
  completeUpload,
  type MediaRepository,
} from "@/features/media/service";
import type { ObjectStorage } from "@/lib/storage";

const uploadBody = { name: "lab.webp", type: "image/webp", size: 2_000_000 };
const objectKey = "media/2026/08/123e4567-e89b-42d3-a456-426614174000.webp";

describe("media route authorization", () => {
  it.each([
    ["presign", defaultPresignPost, uploadBody],
    ["complete", defaultCompletePost, { key: objectKey, ...uploadBody }],
  ])("fails closed by default for the %s route", async (_name, handler, body) => {
    const response = await handler(
      new Request("https://cms.example.test/api/media", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      }),
    );

    expect(response.status).toBe(401);
  });

  it("allows an injected authenticated editor to presign", async () => {
    const service = vi.fn(async () => ({
      key: objectKey,
      url: "https://uploads.example.test/signed",
      method: "PUT" as const,
      headers: { "content-type": "image/webp" },
    }));
    const handler = createPresignUploadHandler({
      authorize: async () => ({ id: "editor-1", role: "EDITOR" }),
      createPendingUpload: service,
    });

    const response = await handler(
      new Request("https://cms.example.test/api/media/presign", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(uploadBody),
      }),
    );

    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ key: objectKey });
  });

  it("allows an injected authenticated editor to complete", async () => {
    const handler = createCompleteUploadHandler({
      authorize: async () => ({ id: "editor-1", role: "EDITOR" }),
      completeUpload: async () => ({ id: "media-1", storageKey: objectKey }),
    });

    const response = await handler(
      new Request("https://cms.example.test/api/media/complete", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ key: objectKey, ...uploadBody }),
      }),
    );

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ id: "media-1", storageKey: objectKey });
  });

  it("rejects invalid upload metadata before calling the injected service", async () => {
    const service = vi.fn(async () => ({ key: objectKey }));
    const handler = createPresignUploadHandler({
      authorize: async () => ({ id: "editor-1", role: "EDITOR" }),
      createPendingUpload: service,
    });

    const response = await handler(
      new Request("https://cms.example.test/api/media/presign", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ name: "payload.svg", type: "image/svg+xml", size: 100 }),
      }),
    );

    expect(response.status).toBe(400);
    expect(service).not.toHaveBeenCalled();
  });

  it("maps a real metadata verification failure to a stable 409 response", async () => {
    const actor = { id: "editor-1", role: "EDITOR" as const };
    const storage: ObjectStorage = {
      presignUpload: vi.fn(),
      headObject: vi.fn(async () => ({ contentType: "image/png", contentLength: 2_000_000, etag: '"etag"' })),
      deleteObject: vi.fn(),
    };
    const repository = {
      findUploadIntent: vi.fn(async () => ({
        id: "intent-1",
        storageKey: objectKey,
        actorId: actor.id,
        filename: uploadBody.name,
        mimeType: uploadBody.type,
        extension: "webp",
        sizeBytes: uploadBody.size,
        expiresAt: new Date("2026-08-08T00:15:00.000Z"),
        consumedAt: null,
      })),
      consumeUploadIntent: vi.fn(),
    } as unknown as MediaRepository;
    const handler = createCompleteUploadHandler({
      authorize: async () => actor,
      completeUpload: (authorizedActor, body) =>
        completeUpload(
          { storage, repository, now: () => new Date("2026-08-08T00:01:00.000Z") },
          {
            actor: authorizedActor,
            key: body.key,
            upload: { name: body.name, type: "image/webp", size: body.size },
          },
        ),
    });

    const response = await handler(
      new Request("https://cms.example.test/api/media/complete", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ key: objectKey, ...uploadBody }),
      }),
    );

    expect(response.status).toBe(409);
    expect(await response.json()).toEqual({
      error: {
        code: "media_metadata_mismatch",
        message: "Stored object metadata does not match the upload intent",
      },
    });
  });

  it.each([
    [new MediaAuthorizationError(), 403, "media_forbidden"],
    [new MediaUploadIntentNotFoundError(), 404, "upload_intent_not_found"],
    [new MediaUploadIntentExpiredError(), 410, "upload_intent_expired"],
    [new MediaUploadIntentReplayError(), 409, "upload_intent_consumed"],
    [new MediaUploadIntentMismatchError(), 409, "upload_intent_mismatch"],
    [new MediaUploadIntentConflictError(), 409, "upload_intent_conflict"],
  ])("maps %s without leaking internal data", async (error, status, code) => {
    const handler = createCompleteUploadHandler({
      authorize: async () => ({ id: "editor-1", role: "EDITOR" }),
      completeUpload: async () => {
        throw error;
      },
    });
    const response = await handler(
      new Request("https://cms.example.test/api/media/complete", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ key: objectKey, ...uploadBody }),
      }),
    );
    const body = await response.json();

    expect(response.status).toBe(status);
    expect(body.error.code).toBe(code);
    expect(JSON.stringify(body)).not.toContain("credential");
  });
});
