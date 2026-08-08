import { describe, expect, it, vi } from "vitest";

import {
  POST as defaultCompletePost,
  createCompleteUploadHandler,
} from "@/app/api/media/complete/route";
import {
  POST as defaultPresignPost,
  createPresignUploadHandler,
} from "@/app/api/media/presign/route";

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
});
