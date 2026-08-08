import { describe, expect, it } from "vitest";

import { createMediaObjectKey, uploadSchema } from "@/features/media/schemas";

describe("uploadSchema", () => {
  it("rejects SVG uploads", () => {
    expect(uploadSchema.safeParse({ name: "x.svg", type: "image/svg+xml", size: 100 }).success).toBe(false);
  });

  it("accepts a WebP image below the size limit", () => {
    expect(uploadSchema.safeParse({ name: "lab.webp", type: "image/webp", size: 2_000_000 }).success).toBe(true);
  });

  it.each([
    ["photo.png", "image/jpeg"],
    ["photo.jpg", "image/png"],
    ["photo.avif", "image/webp"],
  ])("rejects a %s extension with the mismatched %s media type", (name, type) => {
    expect(uploadSchema.safeParse({ name, type, size: 100 }).success).toBe(false);
  });

  it("rejects files larger than 10 MB", () => {
    expect(uploadSchema.safeParse({ name: "large.png", type: "image/png", size: 10 * 1024 * 1024 + 1 }).success).toBe(false);
  });

  it("uses a random, date-partitioned key and the validated extension", () => {
    expect(
      createMediaObjectKey(
        { name: "sample.JPEG", type: "image/jpeg", size: 42 },
        new Date("2026-08-08T12:00:00.000Z"),
        () => "123e4567-e89b-12d3-a456-426614174000",
      ),
    ).toBe("media/2026/08/123e4567-e89b-12d3-a456-426614174000.jpeg");
  });
});
