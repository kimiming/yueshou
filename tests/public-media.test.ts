import { describe, expect, it, vi } from "vitest";

import { createPublicMediaHandler } from "@/features/media/public-delivery";

const mediaId = "cm00000000000000000000001";

describe("public media delivery", () => {
  it("redirects only an approved public asset to a short-lived inline signed URL", async () => {
    const findPublicMedia = vi.fn(async () => ({ storageKey: "media/hero.webp", filename: "hero.webp" }));
    const presignDownload = vi.fn(async () => ({ url: "https://objects.yueshou.test/signed", expiresAt: new Date() }));
    const handler = createPublicMediaHandler({ findPublicMedia, storage: { presignDownload } });

    const response = await handler(new Request(`https://www.yueshou.test/api/media/public/${mediaId}`), { params: Promise.resolve({ id: mediaId }) });

    expect(response.status).toBe(302);
    expect(response.headers.get("location")).toBe("https://objects.yueshou.test/signed");
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(findPublicMedia).toHaveBeenCalledWith(mediaId);
    expect(presignDownload).toHaveBeenCalledWith({ key: "media/hero.webp", filename: "hero.webp", expiresIn: 60, disposition: "inline" });
  });

  it("returns the same non-enumerating response for malformed, draft, private, and missing assets", async () => {
    const findPublicMedia = vi.fn(async () => null);
    const presignDownload = vi.fn();
    const handler = createPublicMediaHandler({ findPublicMedia, storage: { presignDownload } });

    for (const id of ["not-a-cuid", mediaId]) {
      const response = await handler(new Request("https://www.yueshou.test/api/media/public/anything"), { params: Promise.resolve({ id }) });
      expect(response.status).toBe(404);
      expect(response.headers.get("cache-control")).toBe("no-store");
    }
    expect(presignDownload).not.toHaveBeenCalled();
  });
});
