import { describe, expect, it } from "vitest";

import {
  ImageValidationError,
  inspectAndSanitizeImage,
} from "@/features/media/image-validation";

const onePixelPng = Uint8Array.from(Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=",
  "base64",
));

describe("server-side CMS image validation", () => {
  it("decodes real bytes, measures dimensions, and returns a sanitized image", async () => {
    const result = await inspectAndSanitizeImage({
      bytes: onePixelPng,
      declaredMimeType: "image/png",
    });

    expect(result).toMatchObject({ mimeType: "image/png", width: 1, height: 1 });
    expect(result.bytes.byteLength).toBeGreaterThan(0);
    expect(Array.from(result.bytes.slice(0, 8))).toEqual([137, 80, 78, 71, 13, 10, 26, 10]);
  });

  it("rejects a decoded format that conflicts with the declared media type", async () => {
    await expect(inspectAndSanitizeImage({
      bytes: onePixelPng,
      declaredMimeType: "image/jpeg",
    })).rejects.toMatchObject({ code: "media_byte_type_mismatch" } satisfies Partial<ImageValidationError>);
  });

  it("rejects a payload over the configured decoded-pixel ceiling", async () => {
    await expect(inspectAndSanitizeImage({
      bytes: onePixelPng,
      declaredMimeType: "image/png",
      maxPixels: 0,
    })).rejects.toMatchObject({ code: "media_pixel_limit" } satisfies Partial<ImageValidationError>);
  });

  it("rejects truncated bytes even when their magic prefix looks like PNG", async () => {
    await expect(inspectAndSanitizeImage({
      bytes: onePixelPng.slice(0, 16),
      declaredMimeType: "image/png",
    })).rejects.toMatchObject({ code: "media_decode_failed" } satisfies Partial<ImageValidationError>);
  });
});
