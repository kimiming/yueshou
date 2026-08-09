import { createPublicMediaHandler } from "@/features/media/public-delivery";
import { prisma } from "@/lib/db/prisma";
import { parseEnv } from "@/lib/env";
import { createObjectStorage } from "@/lib/storage";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  const env = parseEnv(process.env);
  return createPublicMediaHandler({
    findPublicMedia: (id) => prisma.mediaAsset.findFirst({
      where: { id, status: "PUBLISHED", visibility: "PUBLIC", deletedAt: null },
      select: { storageKey: true, filename: true },
    }),
    storage: createObjectStorage(env, env.STORAGE_BACKEND),
  })(request, context);
}
