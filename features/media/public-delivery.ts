import { z } from "zod";

import type { PrivateDownloadStorage } from "@/lib/storage";

const mediaIdSchema = z.string().cuid();

export function createPublicMediaHandler(dependencies: {
  findPublicMedia(id: string): Promise<{ storageKey: string; filename: string } | null>;
  storage: Pick<PrivateDownloadStorage, "presignDownload">;
}) {
  return async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
    const parsed = mediaIdSchema.safeParse((await context.params).id);
    if (!parsed.success) return new Response(null, { status: 404, headers: { "cache-control": "no-store" } });
    const media = await dependencies.findPublicMedia(parsed.data);
    if (!media) return new Response(null, { status: 404, headers: { "cache-control": "no-store" } });
    const signed = await dependencies.storage.presignDownload({ key: media.storageKey, filename: media.filename, expiresIn: 60, disposition: "inline" });
    return new Response(null, { status: 302, headers: { location: signed.url, "cache-control": "no-store", "referrer-policy": "no-referrer" } });
  };
}
