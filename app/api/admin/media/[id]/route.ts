import { createPublicMediaHandler } from "@/features/media/public-delivery";
import { requireUser } from "@/lib/auth/permissions";
import { prisma } from "@/lib/db/prisma";
import { parseEnv } from "@/lib/env";
import { createObjectStorage } from "@/lib/storage";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  await requireUser();
  const env = parseEnv(process.env);
  return createPublicMediaHandler({
    findPublicMedia: (id) => prisma.mediaAsset.findFirst({
      where: { id, deletedAt: null },
      select: { storageKey: true, filename: true },
    }),
    storage: createObjectStorage(env, env.STORAGE_BACKEND),
  })(request, context);
}
