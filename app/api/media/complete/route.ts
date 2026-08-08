import { prismaMediaRepository } from "@/features/media/repository";
import { createCompleteUploadHandler, createMediaRouteAuthorization } from "@/features/media/routes";
import { createMediaService } from "@/features/media/service";
import { requireUser } from "@/lib/auth/permissions";
import { parseEnv } from "@/lib/env";
import { createObjectStorage } from "@/lib/storage";

export const runtime = "nodejs";

export const POST = createCompleteUploadHandler({
  authorize: createMediaRouteAuthorization(requireUser),
  completeUpload: async (actor, input) => {
    const env = parseEnv(process.env);
    return createMediaService({ storage: createObjectStorage(env, env.STORAGE_BACKEND), repository: prismaMediaRepository })
      .completeUpload({ actor, key: input.key, upload: { name: input.name, type: input.type, size: input.size } });
  },
});
