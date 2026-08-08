import { prismaMediaRepository } from "@/features/media/repository";
import { createMediaRouteAuthorization, createPresignUploadHandler } from "@/features/media/routes";
import { createMediaService } from "@/features/media/service";
import { requireUser } from "@/lib/auth/permissions";
import { parseEnv } from "@/lib/env";
import { createObjectStorage } from "@/lib/storage";

export const runtime = "nodejs";

export const POST = createPresignUploadHandler({
  authorize: createMediaRouteAuthorization(requireUser),
  createPendingUpload: async (actor, upload) => {
    const env = parseEnv(process.env);
    return createMediaService({ storage: createObjectStorage(env, env.STORAGE_BACKEND), repository: prismaMediaRepository })
      .createPendingUpload({ actor, upload });
  },
});
